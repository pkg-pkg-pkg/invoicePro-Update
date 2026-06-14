import type { CompanyInfo, InvoiceData, InvoiceItem, PrintFormat, PrintOptions } from '../../services/printService';
import { amountToWordsINR } from '../../services/voucherPrintBuilder';
import { getActiveCompanyProfileRow } from '../../services/companyProfileDbService';
import { buildUpiQrHtmlBlock } from '../../services/upiQrService';
import { extractStateFromGSTIN, getStateCodes } from '../../utils/gstinUtils';
import taxStandardHtml from './invoice-tax-standard.html?raw';
import {
  blank,
  escapeHtml,
  fmtDateDDMonYY,
  fmtMoneyIN,
  renderTemplateString,
} from './invoiceTemplateEngine';

export type TaxInvoicePrintExtras = {
  freightTotal?: number;
  paymentMode?: string;
  referenceNo?: string;
  referenceDate?: string;
  buyerOrderNo?: string;
  buyerOrderDate?: string;
  otherReferences?: string;
  termsOfDelivery?: string;
  companyState?: string;
  companyStateCode?: string;
  buyerState?: string;
  buyerStateCode?: string;
  consigneeContactPerson?: string;
  buyerContactPerson?: string;
  prevBalance?: number;
  bankBranch?: string;
  bankAccountHolder?: string;
  jurisdictionNote?: string;
};

const pageCssForFormat = (format: PrintFormat): string => {
  if (format === 'A5_PORTRAIT') {
    return '@page { size: A5 portrait; margin: 8mm; } body { font-size: 7px; }';
  }
  return '@page { size: A4 portrait; margin: 8mm; } body { font-size: 10px; }';
};

const stateCodeFromGstin = (gstin?: string): string => {
  const g = String(gstin || '').trim().toUpperCase();
  if (!/^\d{2}/.test(g)) return '';
  const code = g.slice(0, 2);
  return getStateCodes()[code] ? code : '';
};

const stateCodeFromName = (state?: string): string => {
  const raw = String(state || '').trim();
  if (!raw) return '';
  if (/^\d{2}$/.test(raw) && getStateCodes()[raw]) return raw;
  const codes = getStateCodes();
  const match = Object.entries(codes).find(([, name]) => name.toLowerCase() === raw.toLowerCase());
  return match ? match[0] : '';
};

const resolveStateCodes = (
  sellerGstin: string,
  buyerGstin: string,
  sellerState?: string,
  buyerState?: string,
  sellerCode?: string,
  buyerCode?: string
): { sellerCode: string; buyerCode: string } => {
  const s =
    String(sellerCode || '').trim() ||
    stateCodeFromGstin(sellerGstin) ||
    stateCodeFromName(sellerState);
  const b =
    String(buyerCode || '').trim() ||
    stateCodeFromGstin(buyerGstin) ||
    stateCodeFromName(buyerState);
  return { sellerCode: s, buyerCode: b };
};

const stateNameFromCode = (code: string): string => {
  if (!code) return '';
  return getStateCodes()[code] || '';
};

const stateLine = (state?: string, gstin?: string): string => {
  const code = stateCodeFromGstin(gstin) || stateCodeFromName(state) || String(state || '').trim();
  const name = stateNameFromCode(code) || String(state || '').trim();
  if (!name && !code) return '';
  return `State Name: ${name}${code ? `, Code: ${code}` : ''}`;
};

const lineIf = (label: string, value: unknown): string => {
  const v = blank(value);
  return v ? `${label}${v}` : '';
};

const metaRow = (label: string, value: string, extra?: string): string => {
  if (extra) {
    return `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td><td>Dated</td><td>${escapeHtml(extra)}</td></tr>`;
  }
  return `<tr><td>${escapeHtml(label)}</td><td colspan="3">${escapeHtml(value)}</td></tr>`;
};

const partyBlock = (opts: {
  name: string;
  address: string;
  state?: string;
  gstin?: string;
  contactPerson?: string;
  mobile?: string;
}): string => {
  const parts = [
    opts.name ? `<div class="bold">${escapeHtml(opts.name)}</div>` : '',
    opts.address ? `<div>${escapeHtml(opts.address)}</div>` : '',
    stateLine(opts.state, opts.gstin) ? `<div>${escapeHtml(stateLine(opts.state, opts.gstin))}</div>` : '',
    lineIf('Contact person: ', opts.contactPerson) ? `<div>${escapeHtml(lineIf('Contact person: ', opts.contactPerson))}</div>` : '',
    lineIf('Contact: ', opts.mobile) ? `<div>${escapeHtml(lineIf('Contact: ', opts.mobile))}</div>` : '',
  ].filter(Boolean);
  return parts.join('');
};

const moneyCell = (amount: number): string => (amount ? fmtMoneyIN(amount) : '');

const buildItemRows = (items: InvoiceItem[]): string => {
  if (!items.length) return '';
  return items
    .map((it, idx) => {
      const taxPct = Number(it.taxPercent || 0);
      const rateEx = Number(it.rate || 0);
      const rateIncl = Number(it.rateInclusive ?? rateEx * (1 + taxPct / 100));
      const qty = Number(it.qty || 0);
      const unit = blank(it.unit) || 'PCS';
      const discPct = Number(it.discountPercent ?? 0);
      const discAmt = Number(it.discountAmount ?? 0);
      const lineDiscTotal = Number(it.discount ?? discAmt * qty);
      const mrp = Number(it.mrp ?? 0);
      const taxable = Number(it.amount || 0);
      const lineTax = Number(it.taxAmount ?? (Number(it.cgst || 0) + Number(it.sgst || 0) + Number(it.igst || 0)));
      const lineTotal = taxable + lineTax;
      return `<tr>
        <td class="center">${idx + 1}</td>
        <td>${escapeHtml(it.name)}</td>
        <td class="center">${escapeHtml(blank(it.hsn))}</td>
        <td class="center">${taxPct ? `${fmtMoneyIN(taxPct)}%` : ''}</td>
        <td class="center">${qty ? `${qty} ${escapeHtml(unit)}` : ''}</td>
        <td class="num">${mrp ? fmtMoneyIN(mrp) : ''}</td>
        <td class="num">${rateEx ? fmtMoneyIN(rateEx) : ''}</td>
        <td class="num">${rateIncl ? fmtMoneyIN(rateIncl) : ''}</td>
        <td class="center">${discPct ? `${fmtMoneyIN(discPct)}%` : ''}</td>
        <td class="num">${lineDiscTotal ? fmtMoneyIN(lineDiscTotal) : discAmt ? fmtMoneyIN(discAmt) : ''}</td>
        <td class="num">${lineTotal ? fmtMoneyIN(lineTotal) : taxable ? fmtMoneyIN(taxable) : ''}</td>
      </tr>`;
    })
    .join('');
};

const buildHsnTableHeader = (useIgst: boolean): string => {
  if (useIgst) {
    return `<tr>
      <th>HSN/SAC</th>
      <th class="num">Taxable Value</th>
      <th class="center">IGST Rate</th>
      <th class="num">IGST Amt</th>
      <th class="num">Total Tax Amount</th>
    </tr>`;
  }
  return `<tr>
    <th>HSN/SAC</th>
    <th class="num">Taxable Value</th>
    <th class="center">CGST Rate</th>
    <th class="num">CGST Amt</th>
    <th class="center">SGST Rate</th>
    <th class="num">SGST Amt</th>
    <th class="num">Total Tax Amount</th>
  </tr>`;
};

const buildHsnSummary = (items: InvoiceItem[], useIgst: boolean): string => {
  const map = new Map<string, { taxable: number; cgst: number; sgst: number; igst: number; rate: number }>();
  for (const it of items) {
    const hsn = blank(it.hsn);
    if (!hsn) continue;
    const taxPct = Number(it.taxPercent || 0);
    const taxable = Number(it.amount || 0);
    const cgst = Number(it.cgst || 0);
    const sgst = Number(it.sgst || 0);
    const igst = Number(it.igst || 0);
    const prev = map.get(hsn) || { taxable: 0, cgst: 0, sgst: 0, igst: 0, rate: taxPct };
    prev.taxable += taxable;
    prev.cgst += cgst;
    prev.sgst += sgst;
    prev.igst += igst;
    if (!prev.rate && taxPct) prev.rate = taxPct;
    map.set(hsn, prev);
  }
  if (!map.size) return '';
  let totalTaxable = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalIgst = 0;
  const rows = [...map.entries()].map(([hsn, v]) => {
    totalTaxable += v.taxable;
    totalCgst += v.cgst;
    totalSgst += v.sgst;
    totalIgst += v.igst;
    const totalTax = v.cgst + v.sgst + v.igst;
    if (useIgst) {
      const rateLabel = v.rate ? `${fmtMoneyIN(v.rate)}%` : '';
      return `<tr>
        <td>${escapeHtml(hsn)}</td>
        <td class="num">${moneyCell(v.taxable)}</td>
        <td class="center">${rateLabel}</td>
        <td class="num">${moneyCell(v.igst)}</td>
        <td class="num">${moneyCell(totalTax)}</td>
      </tr>`;
    }
    const halfRate = v.rate ? `${fmtMoneyIN(v.rate / 2)}%` : '';
    return `<tr>
      <td>${escapeHtml(hsn)}</td>
      <td class="num">${moneyCell(v.taxable)}</td>
      <td class="center">${halfRate}</td>
      <td class="num">${moneyCell(v.cgst)}</td>
      <td class="center">${halfRate}</td>
      <td class="num">${moneyCell(v.sgst)}</td>
      <td class="num">${moneyCell(totalTax)}</td>
    </tr>`;
  });
  const grandTax = totalCgst + totalSgst + totalIgst;
  if (useIgst) {
    rows.push(`<tr class="bold">
      <td>Total</td>
      <td class="num">${moneyCell(totalTaxable)}</td>
      <td></td>
      <td class="num">${moneyCell(totalIgst)}</td>
      <td class="num">${moneyCell(grandTax)}</td>
    </tr>`);
  } else {
    rows.push(`<tr class="bold">
      <td>Total</td>
      <td class="num">${moneyCell(totalTaxable)}</td>
      <td></td><td class="num">${moneyCell(totalCgst)}</td>
      <td></td><td class="num">${moneyCell(totalSgst)}</td>
      <td class="num">${moneyCell(grandTax)}</td>
    </tr>`);
  }
  return rows.join('');
};

export async function renderTaxStandardInvoice(
  format: PrintFormat,
  company: CompanyInfo,
  data: InvoiceData,
  opts: PrintOptions,
  extras: TaxInvoicePrintExtras = {}
): Promise<string> {
  const ext = data as InvoiceData & TaxInvoicePrintExtras & { customerPhone?: string };
  const row = await getActiveCompanyProfileRow().catch(() => null);
  const bankBranch = extras.bankBranch || row?.bank_branch || '';
  const bankHolder = extras.bankAccountHolder || row?.owner_name || company.name;
  const companyGstin = blank(company.gstin);
  const { sellerCode, buyerCode } = resolveStateCodes(
    companyGstin,
    blank(data.customerGSTIN),
    extras.companyState || extractStateFromGSTIN(companyGstin || '') || company.city,
    extras.buyerState,
    extras.companyStateCode,
    extras.buyerStateCode
  );
  const isInterState =
    sellerCode && buyerCode ? sellerCode !== buyerCode : Number(data.igstTotal || 0) > 0.005;
  const useIgst = isInterState;

  const freight = Number(extras.freightTotal ?? ext.freightTotal ?? 0);
  const roundOff = Number(data.roundOff ?? 0);
  const totalTax = Number(data.cgstTotal || 0) + Number(data.sgstTotal || 0) + Number(data.igstTotal || 0);
  const totalQty = data.items.reduce((s, it) => s + Number(it.qty || 0), 0);
  const unitSet = new Set(
    data.items.map((it) => blank((it as InvoiceItem & { unit?: string }).unit)).filter(Boolean)
  );
  const totalQtyLabel = totalQty ? `${totalQty} ${unitSet.size === 1 ? [...unitSet][0] : 'PCS'}` : '';

  const summaryRows = [
    data.subtotal
      ? `<tr class="summary"><td colspan="10" class="num">Subtotal</td><td class="num">${moneyCell(data.subtotal)}</td></tr>`
      : '',
    Number(data.discountTotal || 0) > 0
      ? `<tr class="summary"><td colspan="10" class="num">Total Discount</td><td class="num">(${fmtMoneyIN(Number(data.discountTotal))})</td></tr>`
      : '',
    !useIgst && data.cgstTotal
      ? `<tr class="summary"><td colspan="10" class="num">CGST</td><td class="num">${moneyCell(data.cgstTotal)}</td></tr>`
      : '',
    !useIgst && data.sgstTotal
      ? `<tr class="summary"><td colspan="10" class="num">SGST</td><td class="num">${moneyCell(data.sgstTotal)}</td></tr>`
      : '',
    useIgst && data.igstTotal
      ? `<tr class="summary"><td colspan="10" class="num">IGST</td><td class="num">${moneyCell(data.igstTotal)}</td></tr>`
      : '',
    totalTax > 0
      ? `<tr class="summary"><td colspan="10" class="num">Total GST</td><td class="num">${moneyCell(totalTax)}</td></tr>`
      : '',
    freight
      ? `<tr class="summary"><td colspan="10" class="num">Freight &amp; Expenses</td><td class="num">${moneyCell(freight)}</td></tr>`
      : '',
    roundOff
      ? `<tr class="summary"><td colspan="10" class="num">Less : Round Off</td><td class="num">(${roundOff < 0 ? '-' : ''})${fmtMoneyIN(Math.abs(roundOff))}</td></tr>`
      : '',
  ]
    .filter(Boolean)
    .join('');

  const billAmt = Number(data.grandTotal || 0);
  const prevBal = Number(extras.prevBalance ?? ext.prevBalance ?? NaN);
  const netBal = Number.isFinite(prevBal) ? prevBal + billAmt : NaN;

  const totalRow = `<tr class="total-row">
    <td colspan="4" class="bold">Total</td>
    <td class="center bold">${escapeHtml(totalQtyLabel)}</td>
    <td colspan="6"></td>
    <td class="num bold">₹ ${moneyCell(billAmt)}</td>
  </tr>`;

  const balanceBlock = [
    Number.isFinite(prevBal) ? `Prev. Balance : <span class="dr">${moneyCell(prevBal)} Dr</span>` : '',
    billAmt ? `Bill Amt. : <span class="dr">${moneyCell(billAmt)} Dr</span>` : '',
    Number.isFinite(netBal) ? `Net Balance : <span class="dr">${moneyCell(netBal)} Dr</span>` : '',
  ]
    .filter(Boolean)
    .join('<br/>');

  const metaRows = [
    metaRow('Invoice No.', blank(data.invoiceNumber)),
    metaRow('Dated', fmtDateDDMonYY(data.invoiceDate)),
    metaRow('Mode/Terms of Payment', blank(extras.paymentMode ?? ext.paymentMode)),
    metaRow(
      'Reference No. & Date',
      blank(extras.referenceNo ?? ext.referenceNo),
      fmtDateDDMonYY(extras.referenceDate ?? ext.referenceDate ?? '')
    ),
    metaRow(
      "Buyer's Order No.",
      blank(extras.buyerOrderNo ?? ext.buyerOrderNo),
      fmtDateDDMonYY(extras.buyerOrderDate ?? ext.buyerOrderDate ?? '')
    ),
    metaRow('Other References', blank(extras.otherReferences ?? ext.otherReferences)),
    metaRow('Terms of Delivery', blank(extras.termsOfDelivery ?? ext.termsOfDelivery)),
  ].join('');

  const city = blank(company.city);
  const jurisdictionDefault = city ? `SUBJECT TO ${city.toUpperCase()} JURISDICTION` : '';

  const upiId = String(row?.upi_id || '').trim();
  const upiPayeeName = String(row?.upi_payee_name || row?.company_name || company.name || '').trim();
  const upiQrBlock = await buildUpiQrHtmlBlock({
    upiId,
    payeeName: upiPayeeName,
    companyName: company.name,
    amount: billAmt,
    invoiceNumber: blank(data.invoiceNumber),
    documentLabel: 'Invoice',
  });

  const vars: Record<string, string> = {
    page_css: pageCssForFormat(format),
    company_logo_html:
      company.logo && opts.logoPosition
        ? `<img class="logo" src="${company.logo}" alt="" />`
        : '',
    company_name: escapeHtml(blank(company.name)),
    company_address: escapeHtml(blank(company.address)),
    company_contact_lines: escapeHtml(
      [lineIf('Mob: ', company.phone)].filter(Boolean).join(', ')
    ),
    company_gstin_line: companyGstin ? escapeHtml(`GSTIN/UIN: ${companyGstin}`) : '',
    company_state_line: escapeHtml(
      stateLine(extras.companyState || extractStateFromGSTIN(companyGstin || '') || company.city, companyGstin)
    ),
    company_email_line: company.email ? escapeHtml(`E-Mail: ${company.email}`) : '',
    company_website_line: company.website ? escapeHtml(company.website) : '',
    invoice_no: escapeHtml(blank(data.invoiceNumber)),
    invoice_meta_rows: metaRows,
    consignee_block: partyBlock({
      name: blank((data as InvoiceData & { shipToName?: string }).shipToName) || data.customerName,
      address: blank(data.shipToAddress || data.billToAddress),
      state: extras.buyerState,
      gstin: data.customerGSTIN,
      contactPerson: extras.consigneeContactPerson,
      mobile: ext.customerPhone,
    }),
    buyer_block: partyBlock({
      name: data.customerName,
      address: blank(data.billToAddress || data.buyerAddress),
      state: extras.buyerState,
      gstin: data.customerGSTIN,
      contactPerson: extras.buyerContactPerson,
      mobile: ext.customerPhone,
    }),
    items_rows: buildItemRows(data.items),
    summary_rows: summaryRows,
    total_row: totalRow,
    amount_in_words: escapeHtml(
      data.amountInWords ? `INR ${data.amountInWords.replace(/^INR\s*/i, '')}` : ''
    ),
    hsn_table_header: buildHsnTableHeader(useIgst),
    hsn_summary_rows: buildHsnSummary(data.items, useIgst),
    tax_amount_in_words: escapeHtml(
      totalTax ? `INR ${amountToWordsINR(totalTax).replace(/ Rupees Only$/i, '')}` : ''
    ),
    declaration_text: escapeHtml(
      data.declaration && opts.showDeclaration ? data.declaration : ''
    ),
    balance_summary: balanceBlock,
    bank_details: [
      bankHolder ? `A/c Holder's Name : ${escapeHtml(bankHolder)}` : '',
      company.bank ? `Bank Name : ${escapeHtml(company.bank)}` : '',
      company.accountNo ? `A/c No. : ${escapeHtml(company.accountNo)}` : '',
      bankBranch || company.ifsc
        ? `Branch &amp; IFS Code : ${escapeHtml([bankBranch, company.ifsc].filter(Boolean).join(' & '))}`
        : '',
    ]
      .filter(Boolean)
      .join('<br/>'),
    signature_html:
      opts.showSignature && company.signature
        ? `<img style="max-height:48px" src="${company.signature}" alt="" />`
        : '',
    jurisdiction_line: escapeHtml(
      extras.jurisdictionNote || ext.jurisdictionNote || jurisdictionDefault
    ),
    upi_qr_block: upiQrBlock,
  };

  return renderTemplateString(taxStandardHtml, vars);
}
