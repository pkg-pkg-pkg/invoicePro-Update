import type { LedgerAccount, LedgerGroup } from '../../types/masters';
import type { Voucher, VoucherLine, VoucherType } from '../../types/vouchers';
import { STANDARD_SUBGROUP_IDS, assertAssignableLedgerGroup, isStructuralParentGroup } from '../../constants/chartOfAccounts';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { ledgerGroupService } from '../masters/ledgerGroupService';
import { ledgerTransactionService } from '../masters/ledgerTransactionService';
import { voucherService } from '../vouchers/voucherService';
import { billReferenceService, type BillReferenceSettlementAudit } from '../settlement/billReferenceService';

const ROUND = (n: number) => Number(n.toFixed(2));
const TOLERANCE = 0.02;

export type AuditedVoucherType =
  | 'SALES'
  | 'PURCHASE'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'JOURNAL'
  | 'SALES_RETURN'
  | 'PURCHASE_RETURN';

export const VOUCHER_TYPE_AUDIT_META: Record<
  AuditedVoucherType,
  { label: string; postingLogic: string }
> = {
  SALES: {
    label: 'Sales Invoice',
    postingLogic: 'Dr Debtor (Customer)\nCr Sales Account\nCr CGST Output / SGST Output (or IGST Output)',
  },
  PURCHASE: {
    label: 'Purchase Bill',
    postingLogic: 'Dr Purchase Account\nDr CGST Input / SGST Input (or IGST Input)\nCr Creditor (Supplier)',
  },
  PAYMENT: {
    label: 'Payment Voucher',
    postingLogic: 'Dr Debtor / Creditor / Expense\nCr Cash-in-Hand / Bank Account',
  },
  RECEIPT: {
    label: 'Receipt Voucher',
    postingLogic: 'Dr Cash-in-Hand / Bank Account\nCr Debtor / Creditor / Income',
  },
  JOURNAL: {
    label: 'Journal Voucher',
    postingLogic: 'Balanced multi-line Dr/Cr entries across any valid ledger groups',
  },
  SALES_RETURN: {
    label: 'Credit Note (Sales Return)',
    postingLogic: 'Cr Sales Returns\nCr GST Output (reverse)\nDr Debtor (Customer)',
  },
  PURCHASE_RETURN: {
    label: 'Debit Note (Purchase Return)',
    postingLogic: 'Dr Purchase Returns\nDr GST Input (reverse)\nCr Creditor (Supplier)',
  },
};

export type VoucherPostingLine = {
  side: 'Dr' | 'Cr';
  ledgerName: string;
  groupName: string;
  amount: number;
};

export type VoucherIntegrityRow = {
  voucherId: string;
  voucherNumber: string;
  date: string;
  voucherType: AuditedVoucherType;
  valid: boolean;
  issues: string[];
  postingLines: VoucherPostingLine[];
  postingSummary: string;
  totalDebit: number;
  totalCredit: number;
};

export type VoucherTypeSummary = {
  voucherType: AuditedVoucherType;
  label: string;
  postingLogic: string;
  totalVouchers: number;
  validCount: number;
  invalidCount: number;
  valid: boolean;
  issuesFound: string[];
};

export type FinancialDerivationCheck = {
  id: string;
  label: string;
  valid: boolean;
  detail: string;
};

export type AccountingIntegrityAudit = {
  generatedAt: string;
  typeSummaries: VoucherTypeSummary[];
  voucherRows: VoucherIntegrityRow[];
  financialChecks: FinancialDerivationCheck[];
  settlementAudit: BillReferenceSettlementAudit;
  overallValid: boolean;
};

function isAuditedType(type: VoucherType): type is AuditedVoucherType {
  return type in VOUCHER_TYPE_AUDIT_META;
}

function groupAncestors(groupId: string, groupMap: Map<string, LedgerGroup>): string[] {
  const ids: string[] = [];
  let current: string | null | undefined = groupId;
  while (current) {
    ids.push(current);
    current = groupMap.get(current)?.parentGroupId ?? null;
  }
  return ids;
}

function touchesGroup(ledgerGroupId: string, targets: string[], groupMap: Map<string, LedgerGroup>): boolean {
  const ancestors = groupAncestors(ledgerGroupId, groupMap);
  return targets.some((t) => ancestors.includes(t));
}

function groupTypeOf(ledgerGroupId: string, groupMap: Map<string, LedgerGroup>): LedgerGroup['type'] | null {
  const g = groupMap.get(ledgerGroupId);
  return g?.type ?? null;
}

function formatPostingLine(
  side: 'Dr' | 'Cr',
  ledger: LedgerAccount | undefined,
  groupMap: Map<string, LedgerGroup>,
  amount: number
): VoucherPostingLine {
  const group = ledger ? groupMap.get(ledger.groupId) : undefined;
  return {
    side,
    ledgerName: ledger?.name ?? 'Unknown',
    groupName: group?.name ?? ledger?.groupId ?? '—',
    amount: ROUND(amount),
  };
}

function validateGroupPlacement(ledger: LedgerAccount, groupMap: Map<string, LedgerGroup>): string | null {
  const group = groupMap.get(ledger.groupId);
  if (!group) return `Ledger "${ledger.name}" has unknown group`;
  if (group.isActive === false) return `Ledger "${ledger.name}" is in inactive group "${group.name}"`;
  if (isStructuralParentGroup(group.id)) {
    return `Ledger "${ledger.name}" posted to structural group "${group.name}" (not a leaf sub-group)`;
  }
  try {
    assertAssignableLedgerGroup(group);
  } catch (e) {
    return (e as Error).message;
  }
  return null;
}

function auditVoucherPattern(
  type: AuditedVoucherType,
  resolved: Array<{ line: VoucherLine; ledger: LedgerAccount }>,
  groupMap: Map<string, LedgerGroup>
): string[] {
  const issues: string[] = [];
  const debits = resolved.filter(({ line }) => (line.debit ?? 0) > 0);
  const credits = resolved.filter(({ line }) => (line.credit ?? 0) > 0);

  const hasDebitIn = (targets: string[]) =>
    debits.some(({ ledger }) => touchesGroup(ledger.groupId, targets, groupMap));
  const hasCreditIn = (targets: string[]) =>
    credits.some(({ ledger }) => touchesGroup(ledger.groupId, targets, groupMap));

  const debtor = [STANDARD_SUBGROUP_IDS.sundryDebtors];
  const creditor = [STANDARD_SUBGROUP_IDS.sundryCreditors];
  const sales = [STANDARD_SUBGROUP_IDS.salesAccounts, 'grp-service-income'];
  const purchase = [STANDARD_SUBGROUP_IDS.purchaseAccounts, 'grp-cogs'];
  const gstOut = [STANDARD_SUBGROUP_IDS.dutiesTaxes];
  const gstIn = [STANDARD_SUBGROUP_IDS.dutiesTaxes];
  const cashBank = [STANDARD_SUBGROUP_IDS.cashInHand, STANDARD_SUBGROUP_IDS.bankAccounts, 'grp-cash-bank'];
  const expense = [
    STANDARD_SUBGROUP_IDS.purchaseAccounts,
    STANDARD_SUBGROUP_IDS.directExpenses,
    STANDARD_SUBGROUP_IDS.indirectExpenses,
    'grp-admin-expenses',
    'grp-cogs',
  ];
  const income = [
    STANDARD_SUBGROUP_IDS.salesAccounts,
    STANDARD_SUBGROUP_IDS.directIncome,
    STANDARD_SUBGROUP_IDS.indirectIncome,
    'grp-service-income',
    'grp-other-income',
  ];

  switch (type) {
    case 'SALES':
      if (!hasDebitIn(debtor)) issues.push('Missing Dr to Sundry Debtors (customer)');
      if (!hasCreditIn(sales)) issues.push('Missing Cr to Sales / Income account');
      break;
    case 'PURCHASE':
      if (!hasCreditIn(creditor)) issues.push('Missing Cr to Sundry Creditors (supplier)');
      if (!hasDebitIn(purchase)) issues.push('Missing Dr to Purchase / Direct Expense account');
      break;
    case 'PAYMENT':
      if (!hasCreditIn(cashBank)) issues.push('Missing Cr to Cash / Bank (money out)');
      if (!hasDebitIn([...debtor, ...creditor, ...expense])) {
        issues.push('Missing Dr to Debtor, Creditor, or Expense ledger');
      }
      break;
    case 'RECEIPT':
      if (!hasDebitIn(cashBank)) issues.push('Missing Dr to Cash / Bank (money in)');
      if (!hasCreditIn([...debtor, ...creditor, ...income])) {
        issues.push('Missing Cr to Debtor, Creditor, or Income ledger');
      }
      break;
    case 'JOURNAL':
      if (debits.length === 0 || credits.length === 0) {
        issues.push('Journal must have at least one Dr and one Cr line');
      }
      break;
    case 'SALES_RETURN':
      if (!hasDebitIn(debtor)) issues.push('Credit Note: expected Dr to Sundry Debtors');
      if (!hasCreditIn([...sales, ...income])) issues.push('Credit Note: expected Cr to Sales / Returns account');
      break;
    case 'PURCHASE_RETURN':
      if (!hasCreditIn(creditor)) issues.push('Debit Note: expected Cr to Sundry Creditors');
      if (!hasDebitIn([...purchase, ...expense])) issues.push('Debit Note: expected Dr to Purchase / Returns account');
      break;
    default:
      break;
  }

  for (const { line, ledger } of resolved) {
    const gt = groupTypeOf(ledger.groupId, groupMap);
    if (type === 'SALES' && (line.credit ?? 0) > 0 && touchesGroup(ledger.groupId, gstOut, groupMap)) {
      continue;
    }
    if (type === 'PURCHASE' && (line.debit ?? 0) > 0 && touchesGroup(ledger.groupId, gstIn, groupMap)) {
      continue;
    }
    if (gt === 'EXPENSE' && (type === 'SALES' || type === 'RECEIPT' || type === 'SALES_RETURN')) {
      const isExpenseLine = touchesGroup(ledger.groupId, expense, groupMap);
      if (isExpenseLine && type === 'SALES') {
        issues.push(`Sales voucher posts to expense group ledger "${ledger.name}"`);
      }
    }
    if (gt === 'INCOME' && (type === 'PURCHASE' || type === 'PURCHASE_RETURN')) {
      if (touchesGroup(ledger.groupId, income, groupMap)) {
        issues.push(`Purchase voucher posts to income group ledger "${ledger.name}"`);
      }
    }
  }

  return issues;
}

async function auditOneVoucher(
  voucher: Voucher,
  ledgerMap: Map<string, LedgerAccount>,
  groupMap: Map<string, LedgerGroup>,
  transactionsByVoucher: Map<string, { debit: number; credit: number; count: number }>
): Promise<VoucherIntegrityRow | null> {
  if (!isAuditedType(voucher.type)) return null;
  if (voucher.status !== 'ACTIVE' || voucher.isDeleted) return null;

  const issues: string[] = [];
  const postingLines: VoucherPostingLine[] = [];

  if (!voucher.lines?.length) {
    issues.push('Voucher has no accounting lines');
  }

  const resolved: Array<{ line: VoucherLine; ledger: LedgerAccount }> = [];
  let totalDebit = 0;
  let totalCredit = 0;

  for (let i = 0; i < (voucher.lines?.length ?? 0); i += 1) {
    const line = voucher.lines[i];
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    totalDebit += debit;
    totalCredit += credit;

    if (!line.ledgerId) {
      issues.push(`Line ${i + 1}: missing ledger`);
      continue;
    }
    if (debit <= 0 && credit <= 0) issues.push(`Line ${i + 1}: zero amount`);
    if (debit > 0 && credit > 0) issues.push(`Line ${i + 1}: both Dr and Cr on same line`);

    const ledger = ledgerMap.get(line.ledgerId);
    if (!ledger || ledger.isActive === false) {
      issues.push(`Line ${i + 1}: ledger missing or inactive (${line.ledgerId})`);
      continue;
    }

    const groupIssue = validateGroupPlacement(ledger, groupMap);
    if (groupIssue) issues.push(groupIssue);

    resolved.push({ line, ledger });
    if (debit > 0) postingLines.push(formatPostingLine('Dr', ledger, groupMap, debit));
    if (credit > 0) postingLines.push(formatPostingLine('Cr', ledger, groupMap, credit));
  }

  totalDebit = ROUND(totalDebit);
  totalCredit = ROUND(totalCredit);

  if (Math.abs(totalDebit - totalCredit) > TOLERANCE) {
    issues.push(`Unbalanced: Dr ₹${totalDebit} ≠ Cr ₹${totalCredit}`);
  }

  issues.push(...auditVoucherPattern(voucher.type, resolved, groupMap));

  const txnAgg = transactionsByVoucher.get(voucher.id);
  if (!txnAgg || txnAgg.count === 0) {
    issues.push('No ledger transactions found for this voucher');
  } else {
    if (Math.abs(txnAgg.debit - totalDebit) > TOLERANCE) {
      issues.push(`Posted Dr ₹${ROUND(txnAgg.debit)} does not match voucher Dr ₹${totalDebit}`);
    }
    if (Math.abs(txnAgg.credit - totalCredit) > TOLERANCE) {
      issues.push(`Posted Cr ₹${ROUND(txnAgg.credit)} does not match voucher Cr ₹${totalCredit}`);
    }
  }

  const postingSummary = postingLines
    .map((p) => `${p.side} ${p.ledgerName} (${p.groupName}) ₹${p.amount.toLocaleString('en-IN')}`)
    .join('\n');

  return {
    voucherId: voucher.id,
    voucherNumber: voucher.number,
    date: voucher.date,
    voucherType: voucher.type,
    valid: issues.length === 0,
    issues,
    postingLines,
    postingSummary,
    totalDebit,
    totalCredit,
  };
}

async function runFinancialChecks(
  transactions: Awaited<ReturnType<typeof ledgerTransactionService.list>>,
  groupMap: Map<string, LedgerGroup>,
  ledgers: LedgerAccount[]
): Promise<FinancialDerivationCheck[]> {
  let totalDr = 0;
  let totalCr = 0;
  let incomeNet = 0;
  let expenseNet = 0;
  let assetNet = 0;
  let liabilityNet = 0;
  let invalidGroupTxns = 0;

  const ledgerMap = new Map(ledgers.map((l) => [l.id, l]));

  for (const txn of transactions) {
    const dr = Number(txn.debit ?? 0);
    const cr = Number(txn.credit ?? 0);
    totalDr += dr;
    totalCr += cr;

    const ledger = ledgerMap.get(txn.ledgerId);
    if (!ledger) {
      invalidGroupTxns += 1;
      continue;
    }
    const gt = groupTypeOf(ledger.groupId, groupMap);
    if (!gt) {
      invalidGroupTxns += 1;
      continue;
    }
    const net = dr - cr;
    if (gt === 'INCOME') incomeNet += -net;
    if (gt === 'EXPENSE') expenseNet += net;
    if (gt === 'ASSET') assetNet += net;
    if (gt === 'LIABILITY') liabilityNet += -net;

    const g = groupMap.get(ledger.groupId);
    if (g) {
      try {
        assertAssignableLedgerGroup(g);
      } catch {
        invalidGroupTxns += 1;
      }
    }
  }

  totalDr = ROUND(totalDr);
  totalCr = ROUND(totalCr);
  incomeNet = ROUND(incomeNet);
  expenseNet = ROUND(expenseNet);
  assetNet = ROUND(assetNet);
  liabilityNet = ROUND(liabilityNet);

  const tbBalanced = Math.abs(totalDr - totalCr) <= TOLERANCE;

  return [
    {
      id: 'trial_balance',
      label: 'Trial Balance from postings',
      valid: tbBalanced,
      detail: tbBalanced
        ? `Total Dr ₹${totalDr.toLocaleString('en-IN')} = Cr ₹${totalCr.toLocaleString('en-IN')} (${transactions.length} lines)`
        : `Dr ₹${totalDr.toLocaleString('en-IN')} ≠ Cr ₹${totalCr.toLocaleString('en-IN')}`,
    },
    {
      id: 'pl_derivation',
      label: 'P&L derivable from Income/Expense groups',
      valid: invalidGroupTxns === 0,
      detail: `Income ₹${incomeNet.toLocaleString('en-IN')} − Expense ₹${expenseNet.toLocaleString('en-IN')} = Net ₹${ROUND(incomeNet - expenseNet).toLocaleString('en-IN')}${invalidGroupTxns ? `; ${invalidGroupTxns} posting(s) with invalid groups` : ''}`,
    },
    {
      id: 'bs_derivation',
      label: 'Balance Sheet derivable from Asset/Liability groups',
      valid: invalidGroupTxns === 0,
      detail: `Assets (net Dr) ₹${assetNet.toLocaleString('en-IN')} | Liabilities (net Cr) ₹${liabilityNet.toLocaleString('en-IN')}${invalidGroupTxns ? `; ${invalidGroupTxns} invalid group posting(s)` : ''}`,
    },
    {
      id: 'postings_only_tb',
      label: 'Trial Balance can be generated from postings alone',
      valid: tbBalanced && transactions.length > 0,
      detail:
        transactions.length === 0
          ? 'No ledger transactions stored'
          : tbBalanced
            ? 'All voucher postings aggregate to balanced trial balance'
            : 'Posting totals do not balance',
    },
  ];
}

export const accountingIntegrityAuditService = {
  async runAudit(): Promise<AccountingIntegrityAudit> {
    const [vouchers, ledgers, groups, transactions] = await Promise.all([
      voucherService.list(),
      ledgerAccountService.list({ includeInactive: true }),
      ledgerGroupService.list({ includeInactive: true }),
      ledgerTransactionService.list(),
    ]);

    const ledgerMap = new Map(ledgers.map((l) => [l.id, l]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));

    const transactionsByVoucher = new Map<string, { debit: number; credit: number; count: number }>();
    for (const txn of transactions) {
      const key = txn.voucherId;
      if (!key) continue;
      const prev = transactionsByVoucher.get(key) ?? { debit: 0, credit: 0, count: 0 };
      prev.debit += Number(txn.debit ?? 0);
      prev.credit += Number(txn.credit ?? 0);
      prev.count += 1;
      transactionsByVoucher.set(key, prev);
    }

    const voucherRows: VoucherIntegrityRow[] = [];
    for (const voucher of vouchers) {
      const row = await auditOneVoucher(voucher, ledgerMap, groupMap, transactionsByVoucher);
      if (row) voucherRows.push(row);
    }

    const typeSummaries: VoucherTypeSummary[] = (
      Object.keys(VOUCHER_TYPE_AUDIT_META) as AuditedVoucherType[]
    ).map((voucherType) => {
      const meta = VOUCHER_TYPE_AUDIT_META[voucherType];
      const rows = voucherRows.filter((r) => r.voucherType === voucherType);
      const invalid = rows.filter((r) => !r.valid);
      const issueSet = new Set<string>();
      invalid.forEach((r) => r.issues.forEach((i) => issueSet.add(i)));
      return {
        voucherType,
        label: meta.label,
        postingLogic: meta.postingLogic,
        totalVouchers: rows.length,
        validCount: rows.length - invalid.length,
        invalidCount: invalid.length,
        valid: invalid.length === 0,
        issuesFound: Array.from(issueSet).slice(0, 12),
      };
    });

    const financialChecks = await runFinancialChecks(transactions, groupMap, ledgers);
    const settlementAudit = await billReferenceService.runSettlementAudit();
    const overallValid =
      typeSummaries.every((t) => t.valid || t.totalVouchers === 0) &&
      financialChecks.every((c) => c.valid) &&
      settlementAudit.valid;

    return {
      generatedAt: new Date().toISOString(),
      typeSummaries,
      voucherRows,
      financialChecks,
      settlementAudit,
      overallValid,
    };
  },
};
