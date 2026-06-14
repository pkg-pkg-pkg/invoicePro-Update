import ExcelJS from 'exceljs';
import type { Party } from '../../types/party';
import type { LedgerStatement } from '../reports/ledgerReportService';
import { ledgerReportService } from '../reports/ledgerReportService';
import { partyService } from '../masters/partyService';
import { voucherService } from '../vouchers/voucherService';
import { billReferenceService } from '../settlement/billReferenceService';
import type { BillReferenceAdjustment } from '../../types/billReference';
import type { BillReference } from '../../types/billReference';
import { downloadPDF } from '../printService';
import { openWhatsAppChat } from '../whatsappIntegration';
import { getNormalizedCompanyProfile } from '../../utils/companyProfile';
import { readCompanyUpiProfile } from '../upiQrService';
import { renderWhatsAppTemplate, getWhatsAppTemplate } from '../whatsappMessageTemplates';
import { customersApi } from './customersApi';
import { logCustomerAudit, currentAuditUserName } from './customerAuditService';
import { resolveVoucherNumberLabel } from '../../utils/voucherNavigation';

export type StatementDatePreset = 'CURRENT_FY' | 'PREVIOUS_FY' | 'CUSTOM' | 'OUTSTANDING_ONLY';

export type CustomerStatementFilters = {
  fromDate?: string;
  toDate?: string;
  preset?: StatementDatePreset;
  outstandingOnly?: boolean;
};

export type EnrichedStatementRow = {
  id: string;
  date: string;
  voucherType: string;
  voucherId: string;
  voucherNumber: string;
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
};

export type CustomerLedgerPackage = {
  party: Party;
  statement: LedgerStatement;
  rows: EnrichedStatementRow[];
  openReferences: BillReference[];
  totalDebit: number;
  totalCredit: number;
  outstandingAmount: number;
  filters: CustomerStatementFilters;
};

const formatMoney = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatBalance = (value: number) => {
  const abs = formatMoney(Math.abs(value));
  return value >= 0 ? `${abs} Dr` : `${abs} Cr`;
};

export async function resolvePartyLedgerId(partyId: string): Promise<string> {
  const party = await partyService.getById(partyId);
  if (!party) throw new Error('Customer not found');
  const ledgerId =
    party.ledgerId ?? (await partyService.ensureLedgerForParty(party.id)) ?? null;
  if (!ledgerId) throw new Error('Could not resolve customer ledger account.');
  return ledgerId;
}

export async function loadCustomerLedgerPackage(
  partyId: string,
  filters: CustomerStatementFilters = {}
): Promise<CustomerLedgerPackage> {
  const party = await partyService.getById(partyId);
  if (!party) throw new Error('Customer not found');

  const ledgerId = await resolvePartyLedgerId(partyId);
  const statement = await ledgerReportService.getStatement(ledgerId, {
    fromDate: filters.fromDate,
    toDate: filters.toDate,
  });

  const vouchers = await voucherService.list();
  const voucherById = new Map(vouchers.map((v) => [v.id, v]));
  await billReferenceService.ensureMigrated();
  const [partyRefs, adjustments] = await Promise.all([
    billReferenceService.list().then((rows) => rows.filter((r) => r.partyId === ledgerId)),
    billReferenceService.listAdjustments(),
  ]);
  const refById = new Map(partyRefs.map((r) => [r.id, r]));
  const adjBySettlement = new Map<string, BillReferenceAdjustment[]>();
  for (const adj of adjustments) {
    if (adj.partyId !== ledgerId) continue;
    const list = adjBySettlement.get(adj.settlementVoucherId) ?? [];
    list.push(adj);
    adjBySettlement.set(adj.settlementVoucherId, list);
  }

  let rows: EnrichedStatementRow[] = statement.transactions.map((txn) => {
    const voucher = voucherById.get(txn.voucherId);
    let description = String(txn.meta?.narration ?? voucher?.narration ?? txn.voucherType);

    if (voucher?.type === 'SALES') {
      const invRef = partyRefs.find((r) => r.voucherId === voucher.id && r.referenceType === 'NEW_REF');
      if (invRef) {
        description = `Invoice ${invRef.referenceNo} · Pending ₹${formatMoney(invRef.pendingAmount)}`;
      }
    }

    if (voucher && (voucher.type === 'RECEIPT' || voucher.type === 'PAYMENT')) {
      const adjs = adjBySettlement.get(voucher.id) ?? [];
      if (adjs.length > 0) {
        const detail = adjs
          .map((a) => {
            const ref = refById.get(a.referenceId);
            return `${ref?.referenceNo ?? a.referenceId}: ₹${formatMoney(a.amount)}`;
          })
          .join(', ');
        description = `${voucher.type === 'RECEIPT' ? 'Receipt' : 'Payment'} · Adjustment ${detail}`;
      } else if (String(voucher.narration ?? '').includes('SETTLEMODE=ADVANCE')) {
        description = 'Advance received';
      } else if (String(voucher.narration ?? '').includes('SETTLEMODE=ON_ACCOUNT')) {
        description = 'On account receipt';
      }
    }

    const meta = txn.meta as { voucherNumber?: string } | null | undefined;
    return {
      id: txn.id,
      date: txn.date.slice(0, 10),
      voucherType: txn.voucherType,
      voucherId: txn.voucherId,
      voucherNumber: resolveVoucherNumberLabel(meta?.voucherNumber ?? voucher?.number ?? null, txn.voucherId),
      description,
      debit: txn.debit,
      credit: txn.credit,
      runningBalance: txn.runningBalance,
    };
  });

  if (filters.outstandingOnly) {
    rows = rows.filter((r) => r.runningBalance > 0.005);
  }

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0);
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0);
  const billOutstanding = await billReferenceService.getPartyOutstanding(ledgerId);
  const outstandingAmount = billOutstanding > 0.01 ? billOutstanding : Math.max(0, statement.closingBalance);
  const openReferences = partyRefs
    .filter((r) => r.pendingAmount > 0.01)
    .sort((a, b) => a.voucherDate.localeCompare(b.voucherDate));

  return {
    party,
    statement,
    rows,
    openReferences,
    totalDebit,
    totalCredit,
    outstandingAmount,
    filters,
  };
}

function buildStatementHtml(pkg: CustomerLedgerPackage): string {
  const company = getNormalizedCompanyProfile();
  const generatedAt = new Date().toLocaleString('en-IN');
  const from = pkg.filters.fromDate || 'Start';
  const to = pkg.filters.toDate || 'Latest';

  const tableRows = pkg.rows
    .map(
      (r) =>
        `<tr>
          <td>${r.date}</td>
          <td>${r.voucherType}</td>
          <td>${r.voucherNumber}</td>
          <td>${r.description}</td>
          <td align="right">${r.debit ? formatMoney(r.debit) : ''}</td>
          <td align="right">${r.credit ? formatMoney(r.credit) : ''}</td>
          <td align="right">${formatBalance(r.runningBalance)}</td>
        </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Ledger Statement — ${pkg.party.name}</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;padding:24px;color:#0F172A;font-size:11px}
h1{font-size:18px;color:#0B1F3A;border-bottom:3px solid #C9A227;padding-bottom:8px}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:16px 0}
.box{border:1px solid #D6DFEA;border-radius:8px;padding:12px;background:#F8FAFC}
table{width:100%;border-collapse:collapse;margin-top:16px}
th{background:#132D54;color:#fff;text-align:left;padding:8px;font-size:10px}
td{border-bottom:1px solid #E2E8F0;padding:6px;vertical-align:top}
.summary{margin-top:16px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.summary div{border:1px solid #E2E8F0;border-radius:6px;padding:8px;background:#fff}
.footer{margin-top:20px;font-size:10px;color:#64748B}
</style></head><body>
<h1>Customer Ledger Statement</h1>
<div class="meta">
  <div class="box"><strong>${company.businessName || company.name}</strong><br/>${company.address || ''}<br/>GSTIN: ${company.gstin || '—'}</div>
  <div class="box"><strong>${pkg.party.name}</strong><br/>Mobile: ${pkg.party.mobile || '—'}<br/>GSTIN: ${pkg.party.gstin || '—'}</div>
</div>
<p><strong>Period:</strong> ${from} to ${to}</p>
<table>
<thead><tr><th>Date</th><th>Type</th><th>Voucher No</th><th>Description</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
<tbody>${tableRows || '<tr><td colspan="7">No transactions</td></tr>'}</tbody>
</table>
<div class="summary">
  <div><div>Opening</div><strong>${formatBalance(pkg.statement.openingBalance)}</strong></div>
  <div><div>Total Debit</div><strong>₹${formatMoney(pkg.totalDebit)}</strong></div>
  <div><div>Total Credit</div><strong>₹${formatMoney(pkg.totalCredit)}</strong></div>
  <div><div>Outstanding</div><strong>₹${formatMoney(pkg.outstandingAmount)}</strong></div>
</div>
<p class="footer">Generated ${generatedAt} — PVE InvoicePro 360</p>
</body></html>`;
}

export async function exportCustomerStatementPdf(
  pkg: CustomerLedgerPackage,
  fileName?: string
): Promise<string | null> {
  const html = buildStatementHtml(pkg);
  const name = fileName || `Statement_${pkg.party.name.replace(/\W+/g, '_')}.pdf`;
  const path = await downloadPDF(html, name);
  logCustomerAudit({
    customerId: pkg.party.id,
    customerName: pkg.party.name,
    action: 'STATEMENT_EXPORTED',
    userName: currentAuditUserName(),
    meta: { format: 'pdf' },
  });
  return path;
}

export async function exportCustomerStatementExcel(pkg: CustomerLedgerPackage, fileName?: string) {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Statement');
  ws.addRow(['Customer', pkg.party.name]);
  ws.addRow(['Mobile', pkg.party.mobile]);
  ws.addRow(['GSTIN', pkg.party.gstin || '']);
  ws.addRow(['From', pkg.filters.fromDate || '']);
  ws.addRow(['To', pkg.filters.toDate || '']);
  ws.addRow([]);
  ws.addRow(['Date', 'Voucher Type', 'Voucher No', 'Description', 'Debit', 'Credit', 'Running Balance']);
  for (const r of pkg.rows) {
    ws.addRow([r.date, r.voucherType, r.voucherNumber, r.description, r.debit, r.credit, r.runningBalance]);
  }
  ws.addRow([]);
  ws.addRow(['Opening', pkg.statement.openingBalance]);
  ws.addRow(['Closing', pkg.statement.closingBalance]);
  ws.addRow(['Outstanding', pkg.outstandingAmount]);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `Statement_${pkg.party.name.replace(/\W+/g, '_')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  logCustomerAudit({
    customerId: pkg.party.id,
    customerName: pkg.party.name,
    action: 'STATEMENT_EXPORTED',
    userName: currentAuditUserName(),
    meta: { format: 'excel' },
  });
}

export function exportCustomerStatementCsv(pkg: CustomerLedgerPackage, fileName?: string) {
  const escape = (v: unknown) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    ['Customer', pkg.party.name].map(escape).join(','),
    ['Date', 'Voucher Type', 'Voucher No', 'Description', 'Debit', 'Credit', 'Running Balance'].join(','),
    ...pkg.rows.map((r) =>
      [r.date, r.voucherType, r.voucherNumber, r.description, r.debit, r.credit, r.runningBalance]
        .map(escape)
        .join(',')
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `Statement_${pkg.party.name.replace(/\W+/g, '_')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  logCustomerAudit({
    customerId: pkg.party.id,
    customerName: pkg.party.name,
    action: 'STATEMENT_EXPORTED',
    userName: currentAuditUserName(),
    meta: { format: 'csv' },
  });
}

export function buildStatementWhatsAppMessage(party: Party, outstandingAmount: number): string {
  const company = getNormalizedCompanyProfile();
  return `Dear ${party.name},

Please find your latest account statement.

Outstanding Balance:
₹${formatMoney(outstandingAmount)}

Regards,
${company.businessName || company.name}

Generated by PVE InvoicePro 360`;
}

export function buildOutstandingReminderWhatsAppMessage(party: Party, outstandingAmount: number): string {
  const company = getNormalizedCompanyProfile();
  return renderWhatsAppTemplate(getWhatsAppTemplate('outstanding'), {
    customerName: party.name,
    outstandingAmount: formatMoney(outstandingAmount),
    companyName: company.businessName || company.name,
  });
}

export async function sendStatementOnWhatsApp(partyId: string, filters: CustomerStatementFilters = {}) {
  const pkg = await loadCustomerLedgerPackage(partyId, filters);
  const phone = String(pkg.party.whatsapp || pkg.party.mobile || '').trim();
  if (!phone.replace(/\D/g, '')) {
    throw new Error('Customer mobile number is missing. Add mobile/WhatsApp in Party Master.');
  }
  await exportCustomerStatementPdf(pkg);
  const message = buildStatementWhatsAppMessage(pkg.party, pkg.outstandingAmount);
  const result = await openWhatsAppChat(phone, message);
  if (!result.ok) throw new Error(result.error || 'Could not open WhatsApp.');
  logCustomerAudit({
    customerId: pkg.party.id,
    customerName: pkg.party.name,
    action: 'STATEMENT_SENT_WHATSAPP',
    userName: currentAuditUserName(),
  });
}

export async function sendOutstandingReminderOnWhatsApp(partyId: string) {
  const party = await partyService.getById(partyId);
  if (!party) throw new Error('Customer not found');
  const phone = String(party.whatsapp || party.mobile || '').trim();
  if (!phone.replace(/\D/g, '')) {
    throw new Error('Customer mobile number is missing.');
  }
  const outstanding = await customersApi.customerOutstanding(party);
  const upi = await readCompanyUpiProfile();
  let message = buildOutstandingReminderWhatsAppMessage(party, outstanding);
  if (upi.upiId) {
    message += `\n\nUPI:\n${upi.upiId}`;
  }
  const result = await openWhatsAppChat(phone, message);
  if (!result.ok) throw new Error(result.error || 'Could not open WhatsApp.');
  logCustomerAudit({
    customerId: party.id,
    customerName: party.name,
    action: 'REMINDER_SENT',
    userName: currentAuditUserName(),
    meta: { outstanding: String(outstanding) },
  });
}

export type BulkReminderResult = { selected: number; sent: number; skipped: number; errors: string[] };

export async function sendBulkOutstandingReminders(partyIds: string[]): Promise<BulkReminderResult> {
  const result: BulkReminderResult = { selected: partyIds.length, sent: 0, skipped: 0, errors: [] };
  for (const id of partyIds) {
    try {
      await sendOutstandingReminderOnWhatsApp(id);
      result.sent += 1;
      await new Promise((r) => setTimeout(r, 800));
    } catch (err) {
      const msg = (err as Error).message || 'Failed';
      if (msg.includes('mobile')) result.skipped += 1;
      else result.errors.push(msg);
    }
  }
  return result;
}
