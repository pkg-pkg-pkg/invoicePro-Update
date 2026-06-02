import type { CompanyInfo, InvoiceData, InvoiceItem, PrintFormat, PrintOptions } from '../../services/printService';
import { buildUpiQrHtmlBlock, readCompanyUpiId } from '../../services/upiQrService';
import { getTemplateById, type InvoiceTemplateId } from './invoiceTemplatesConfig';
import { escapeHtml, fmtDateIN, fmtMoney, renderTemplateString } from './invoiceTemplateEngine';

const FOOTER_NOTE = 'This is a computer generated invoice.';

const pageCssForFormat = (format: PrintFormat): string => {
  if (format === 'A4_LANDSCAPE') {
    return '@page { size: A4 landscape; margin: 15mm; }';
  }
  if (format === 'A5_PORTRAIT') {
    return '@page { size: A5 portrait; margin: 12mm; }';
  }
  if (format === 'A5_LANDSCAPE') {
    return '@page { size: A5 landscape; margin: 12mm; }';
  }
  if (format === 'THERMAL_80') {
    return '@page { size: 80mm auto; margin: 4mm; } body { font-size: 10px; }';
  }
  if (format === 'THERMAL_58') {
    return '@page { size: 58mm auto; margin: 3mm; } body { font-size: 9px; }';
  }
  return '@page { size: A4 portrait; margin: 15mm; }';
};

const buildCompanyContact = (company: CompanyInfo): string => {
  const parts = [
    company.phone ? `Ph: ${company.phone}` : '',
    company.email ? `Email: ${company.email}` : '',
    (company as CompanyInfo & { website?: string }).website
      ? `Web: ${(company as CompanyInfo & { website?: string }).website}`
      : '',
  ].filter(Boolean);
  return parts.join(' · ') || '-';
};

const buildItemsRows = (items: InvoiceItem[], showTax: boolean): string => {
  if (!items.length) {
    return `<tr><td colspan="${showTax ? 11 : 8}" style="text-align:center;padding:12px;">No items</td></tr>`;
  }
  return items
    .map((it, idx) => {
      const hsn = it.hsn ? `<br/><span style="color:#6b7280;font-size:10px;">HSN: ${escapeHtml(it.hsn)}</span>` : '';
      const taxCells = showTax
        ? `<td class="num">${fmtMoney(it.cgst || 0)}</td><td class="num">${fmtMoney(it.sgst || 0)}</td><td class="num">${fmtMoney(it.igst || 0)}</td>`
        : '';
      const ext = it as InvoiceItem & { unit?: string; discount?: number };
      return `<tr>
        <td>${idx + 1}</td>
        <td>${escapeHtml(it.name)}${hsn}</td>
        <td class="num">${fmtMoney(it.qty)}</td>
        <td>${escapeHtml(ext.unit || 'Nos')}</td>
        <td class="num">${fmtMoney(it.rate)}</td>
        <td class="num">${fmtMoney(ext.discount || 0)}</td>
        <td class="num">${fmtMoney(it.taxPercent)}%</td>
        ${taxCells}
        <td class="num">${fmtMoney(it.amount)}</td>
      </tr>`;
    })
    .join('');
};

const optionalTotalRow = (label: string, amount: number): string => {
  if (!amount || Math.abs(amount) < 0.005) return '';
  return `<tr><td>${label}</td><td>${fmtMoney(amount)}</td></tr>`;
};

const buildBankBlock = (company: CompanyInfo): string => {
  if (!company.bank && !company.accountNo && !company.ifsc) return '';
  return `<strong>Bank Details</strong><br/>
    Bank: ${escapeHtml(company.bank || '-')}<br/>
    A/C: ${escapeHtml(company.accountNo || '-')}<br/>
    IFSC: ${escapeHtml(company.ifsc || '-')}`;
};

const buildTermsBlock = (data: InvoiceData, opts: PrintOptions): string => {
  const terms = (data as InvoiceData & { termsAndConditions?: string }).termsAndConditions;
  if (!opts.showDeclaration && !terms) return '';
  const parts: string[] = [];
  if (terms) {
    parts.push(`<strong>Terms &amp; Conditions</strong><br/>${escapeHtml(terms).replace(/\n/g, '<br/>')}`);
  } else if (data.declaration && opts.showDeclaration) {
    parts.push(`<strong>Declaration</strong><br/>${escapeHtml(data.declaration)}`);
  }
  return parts.join('<br/><br/>');
};

export const renderInvoiceTemplate = async (
  templateId: InvoiceTemplateId | string,
  format: PrintFormat,
  company: CompanyInfo,
  data: InvoiceData,
  opts: PrintOptions,
  upiQrBlock?: string
): Promise<string> => {
  const tpl = getTemplateById(templateId);
  const showTax = opts.showTaxBreakup;
  const extData = data as InvoiceData & {
    dueDate?: string;
    customerPhone?: string;
    discountTotal?: number;
    roundOff?: number;
    termsAndConditions?: string;
    shipToName?: string;
    shipToGstin?: string;
  };

  const logoHtml =
    company.logo && opts.logoPosition
      ? `<img class="logo" src="${company.logo}" alt="Logo" />`
      : '';
  const signatureHtml =
    opts.showSignature && company.signature
      ? `<img style="max-height:64px" src="${company.signature}" alt="Signature" />`
      : '';

  const shipName = extData.shipToName || data.customerName;
  const shipAddress = data.shipToAddress || data.billToAddress || data.buyerAddress || '-';
  const shipGstin = extData.shipToGstin || data.customerGSTIN || '-';
  const upi_qr_block =
    upiQrBlock ??
    (await buildUpiQrHtmlBlock({
      upiId: readCompanyUpiId(),
      companyName: company.name,
      amount: data.grandTotal,
      invoiceNumber: data.invoiceNumber,
    }));

  const vars: Record<string, string> = {
    page_css: pageCssForFormat(format),
    company_logo_html: logoHtml,
    company_name: escapeHtml(company.name),
    company_gstin: escapeHtml(company.gstin || '-'),
    company_address: escapeHtml(company.address || '-'),
    company_contact: escapeHtml(buildCompanyContact(company)),
    invoice_no: escapeHtml(data.invoiceNumber),
    invoice_date: escapeHtml(fmtDateIN(data.invoiceDate)),
    due_date: escapeHtml(extData.dueDate ? fmtDateIN(extData.dueDate) : '-'),
    bill_to_name: escapeHtml(data.customerName),
    bill_to_address: escapeHtml(data.billToAddress || data.buyerAddress || '-'),
    bill_to_gstin: escapeHtml(data.customerGSTIN || '-'),
    bill_to_phone: escapeHtml(extData.customerPhone || '-'),
    ship_to_name: escapeHtml(shipName),
    ship_to_address: escapeHtml(shipAddress),
    ship_to_gstin: escapeHtml(shipGstin),
    items_rows: buildItemsRows(data.items, showTax),
    subtotal: fmtMoney(data.subtotal),
    cgst_total: fmtMoney(data.cgstTotal),
    sgst_total: fmtMoney(data.sgstTotal),
    igst_total: fmtMoney(data.igstTotal),
    discount_row: optionalTotalRow('Discount', Number(extData.discountTotal || 0)),
    round_off_row: optionalTotalRow('Round Off', Number(extData.roundOff || 0)),
    grand_total: fmtMoney(data.grandTotal),
    amount_in_words: escapeHtml(data.amountInWords || '-'),
    bank_block: buildBankBlock(company),
    upi_qr_block,
    terms_block: buildTermsBlock(data, opts),
    signature_html: signatureHtml,
    footer_note: FOOTER_NOTE,
    page_number: 'Page 1 of 1',
  };

  return renderTemplateString(tpl.html, vars);
};

/** Sample invoice for template previews in Settings */
export const buildSampleInvoiceHtml = async (templateId: InvoiceTemplateId): Promise<string> => {
  const company: CompanyInfo = {
    name: 'PVE Demo Traders',
    address: '12, Main Road, Ranchi, Jharkhand - 834001',
    gstin: '20AAAAA0000A1Z5',
    phone: '+91 98765 43210',
    email: 'billing@pvedemo.in',
    bank: 'State Bank of India',
    accountNo: '12345678901',
    ifsc: 'SBIN0001234',
  };
  const data: InvoiceData = {
    invoiceNumber: 'INV-0001',
    invoiceDate: new Date().toISOString(),
    customerName: 'AM Electronics',
    customerGSTIN: '20BBBBB0000B1Z5',
    buyerAddress: 'Shop 4, Market Complex, Ranchi',
    billToAddress: 'Shop 4, Market Complex, Ranchi',
    shipToAddress: 'Shop 4, Market Complex, Ranchi',
    items: [
      {
        name: 'PILOT MALE FEMALE',
        hsn: '9018',
        qty: 10,
        rate: 29.66,
        taxPercent: 18,
        amount: 296.6,
        cgst: 26.7,
        sgst: 26.7,
        igst: 0,
      },
    ],
    subtotal: 296.6,
    cgstTotal: 26.7,
    sgstTotal: 26.7,
    igstTotal: 0,
    grandTotal: 350.01,
    amountInWords: 'Three Hundred Fifty Rupees and One Paisa Only',
    declaration: 'Payment due within 15 days.',
  };
  const opts: PrintOptions = {
    showTaxBreakup: true,
    showSignature: true,
    showDeclaration: true,
    logoPosition: 'top-left',
    fontSize: 'normal',
    margin: 'normal',
  };
  return renderInvoiceTemplate(templateId, 'A4_PORTRAIT', company, data, opts, '');
};
