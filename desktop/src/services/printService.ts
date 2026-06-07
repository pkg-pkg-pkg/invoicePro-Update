import { renderInvoiceTemplate } from '../templates/invoice/invoiceTemplateRenderer';
import { getInvoiceTemplateId } from './companySettingsService';
import { openWhatsAppChat } from './whatsappIntegration';

export type PrintFormat = 'A4_PORTRAIT' | 'A4_LANDSCAPE' | 'A5_PORTRAIT' | 'A5_LANDSCAPE' | 'THERMAL_80' | 'THERMAL_58';

export interface CompanyInfo {
  name: string;
  address: string;
  gstin?: string;
  phone?: string;
  email?: string;
  website?: string;
  city?: string;
  pinCode?: string;
  bank?: string;
  accountNo?: string;
  ifsc?: string;
  logo?: string; // base64 or path
  signature?: string; // base64 or path
}

export interface InvoiceItem {
  name: string;
  hsn?: string;
  qty: number;
  unit?: string;
  rate: number;
  discount?: number;
  taxPercent: number; // 0/5/12/18/28
  amount: number; // inclusive of tax if needed
  cgst?: number;
  sgst?: number;
  igst?: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string; // ISO
  dueDate?: string;
  customerName: string;
  customerGSTIN?: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  discountTotal?: number;
  roundOff?: number;
  grandTotal: number;
  amountInWords: string;
  buyerAddress?: string;
  sellerAddress?: string;
  billToAddress?: string;
  shipToAddress?: string;
  shipToName?: string;
  shipToGstin?: string;
  customerSealLabel?: string;
  declaration?: string;
  termsAndConditions?: string;
  ewayBillBlock?: string;
}

export interface PrintOptions {
  showTaxBreakup: boolean;
  showSignature: boolean;
  showDeclaration: boolean;
  logoPosition: 'top-left' | 'top-center';
  fontSize: 'normal' | 'compact';
  margin: 'small' | 'normal';
}

const cssBase = (format: PrintFormat, opts: PrintOptions) => {
  const isThermal = format === 'THERMAL_80' || format === 'THERMAL_58';
  const width = format === 'THERMAL_80' ? 80 : format === 'THERMAL_58' ? 58 : 210; // mm
  const fontSize = isThermal ? 10 : opts.fontSize === 'compact' ? 12 : 14;
  const margin = opts.margin === 'small' ? 6 : 12;
  const bodyWidth = isThermal ? `${width}mm` : 'auto';
  let pageSize = '';
  if (format.startsWith('A4')) {
    pageSize = `@page { size: A4 ${format === 'A4_LANDSCAPE' ? 'landscape' : 'portrait'}; margin: ${margin}mm; }`;
  } else if (format.startsWith('A5')) {
    pageSize = `@page { size: A5 ${format === 'A5_LANDSCAPE' ? 'landscape' : 'portrait'}; margin: ${margin}mm; }`;
  }
  return `
    ${pageSize}
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: "Segoe UI", Arial, sans-serif; font-size: ${fontSize}px; color: #111827; line-height: 1.35; background: #fff; }
    .invoice-container { width: ${bodyWidth}; margin: 0 auto; padding: ${isThermal ? 2 : 0}mm; }
    .header { display: flex; align-items: flex-start; justify-content: space-between; gap: ${isThermal ? 6 : 12}px; border-bottom: 2px solid #1f4e79; padding-bottom: 8px; }
    .logo { max-height: ${isThermal ? 40 : 60}px; }
    .title { font-size: ${fontSize + (isThermal ? 2 : 4)}px; font-weight: 800; color: #1f4e79; letter-spacing: 0.3px; }
    .muted { color: #4b5563; font-size: ${isThermal ? fontSize - 1 : fontSize}px; }
    .invoice-badge { background: #1f4e79; color: #fff; font-weight: 700; padding: 6px 10px; border-radius: 4px; font-size: ${isThermal ? fontSize : fontSize + 1}px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d1d5db; padding: ${isThermal ? 3 : 7}px; text-align: left; font-size: ${isThermal ? fontSize - 1 : fontSize}px; }
    th { background: #eef4fb; color: #1f4e79; font-weight: 700; }
    .totals td { font-weight: 600; }
    .section { margin-top: ${isThermal ? 4 : 12}px; }
    .signature { text-align: right; margin-top: ${isThermal ? 8 : 24}px; }
    .amount-box { background: #f9fafb; border: 1px solid #d1d5db; border-radius: 4px; padding: 8px; margin-top: ${isThermal ? 4 : 10}px; }
  `;
};

export async function buildInvoiceHTML(
  format: PrintFormat,
  company: CompanyInfo,
  data: InvoiceData,
  opts: PrintOptions,
  templateId?: string
): Promise<string> {
  const selectedTemplate = templateId || getInvoiceTemplateId();
  return renderInvoiceTemplate(selectedTemplate, format, company, data, opts);
}

/** @deprecated Legacy single-format builder; kept for reference. Use buildInvoiceHTML. */
export function buildInvoiceHTMLLegacy(format: PrintFormat, company: CompanyInfo, data: InvoiceData, opts: PrintOptions): string {
  const css = cssBase(format, opts);
  const logoHtml = company.logo && opts.logoPosition ? `<img class="logo" src="${company.logo}" alt="Logo" />` : '';
  const signatureHtml = opts.showSignature && company.signature ? `<img style="max-height:70px" src="${company.signature}" alt="Signature" />` : '';
  const taxColumns = opts.showTaxBreakup ? `<th>CGST</th><th>SGST</th><th>IGST</th>` : '';
  const taxCells = (item: InvoiceItem) => opts.showTaxBreakup ? `<td>${(item.cgst||0).toFixed(2)}</td><td>${(item.sgst||0).toFixed(2)}</td><td>${(item.igst||0).toFixed(2)}</td>` : '';

  const itemsHtml = data.items.map((it, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${it.name}${it.hsn ? ` <span class="muted">(HSN: ${it.hsn})</span>` : ''}</td>
      <td>${it.qty}</td>
      <td>${it.rate.toFixed(2)}</td>
      <td>${it.taxPercent}%</td>
      ${taxCells(it)}
      <td>${it.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  const declarationHtml = opts.showDeclaration && data.declaration ? `<div class="section"><strong>Declaration:</strong><br/>${data.declaration}</div>` : '';

  const headerLogo = opts.logoPosition === 'top-left'
    ? `<div class="header"><div style="display:flex;align-items:flex-start;gap:10px;">${logoHtml}<div><div class="title">${company.name}</div><div class="muted">${company.address}</div><div class="muted">GSTIN: ${company.gstin||'-'}</div></div></div><div class="invoice-badge">TAX INVOICE</div></div>`
    : `<div style="text-align:center">${logoHtml}<div class="title">${company.name}</div><div class="muted">${company.address}</div><div class="muted">GSTIN: ${company.gstin||'-'}</div></div>`;

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Invoice ${data.invoiceNumber}</title>
      <style>${css}</style>
    </head>
    <body>
      <div class="invoice-container">
        ${headerLogo}

        <div class="section">
          <table>
            <tr>
              <td style="width:60%"><strong>Buyer:</strong> ${data.customerName}</td>
              <td><strong>Invoice No:</strong> ${data.invoiceNumber}</td>
            </tr>
            <tr>
              <td><strong>Customer GSTIN:</strong> ${data.customerGSTIN || '-'}</td>
              <td><strong>Date:</strong> ${new Date(data.invoiceDate).toLocaleDateString('en-IN')}</td>
            </tr>
            <tr>
              <td><strong>Buyer Address:</strong> ${data.buyerAddress || data.billToAddress || '-'}</td>
              <td><strong>Ship To:</strong> ${data.shipToAddress || data.billToAddress || '-'}</td>
            </tr>
            <tr>
              <td><strong>Seller Address:</strong> ${data.sellerAddress || company.address || '-'}</td>
              <td><strong>Bill To:</strong> ${data.billToAddress || data.buyerAddress || '-'}</td>
            </tr>
          </table>
        </div>

        <div class="section">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Tax %</th>
                ${taxColumns}
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>

        <div class="section">
          <table>
            <tr class="totals"><td colspan="${opts.showTaxBreakup ? 4 : 3}">Subtotal</td><td colspan="${opts.showTaxBreakup ? 2 : 1}">${data.subtotal.toFixed(2)}</td></tr>
            ${opts.showTaxBreakup ? `<tr><td colspan="4">CGST</td><td colspan="2">${data.cgstTotal.toFixed(2)}</td></tr>`:''}
            ${opts.showTaxBreakup ? `<tr><td colspan="4">SGST</td><td colspan="2">${data.sgstTotal.toFixed(2)}</td></tr>`:''}
            ${opts.showTaxBreakup ? `<tr><td colspan="4">IGST</td><td colspan="2">${data.igstTotal.toFixed(2)}</td></tr>`:''}
            <tr class="totals"><td colspan="${opts.showTaxBreakup ? 4 : 3}">Total</td><td colspan="${opts.showTaxBreakup ? 2 : 1}"><strong>₹ ${data.grandTotal.toFixed(2)}</strong></td></tr>
          </table>
        </div>

        <div class="amount-box"><strong>Amount in Words:</strong> ${data.amountInWords || '-'}</div>
        <div class="section">
          <table>
            <tr>
              <td><strong>Seller Bank:</strong> ${company.bank || '-'}</td>
              <td><strong>Account No:</strong> ${company.accountNo || '-'}</td>
              <td><strong>IFSC:</strong> ${company.ifsc || '-'}</td>
            </tr>
          </table>
        </div>
        ${declarationHtml}

        <div class="signature" style="display:flex;justify-content:space-between;gap:24px;">
          <div style="text-align:left;">
            <div><strong>${data.customerSealLabel || 'Customer Seal & Signature'}</strong></div>
            <div style="border-top:1px solid #777;min-width:220px;margin-top:30px;padding-top:4px;"></div>
          </div>
          <div style="text-align:right;">
            <div>Authorized Signatory</div>
            ${signatureHtml || ''}
            <div style="border-top:1px solid #777;min-width:220px;margin-top:8px;padding-top:4px;"></div>
          </div>
        </div>
      </div>
    </body>
  </html>
  `;
}

/** Wrap invoice HTML with a simple toolbar for Electron preview windows. */
export function wrapPrintPreviewDocument(html: string): string {
  if (html.includes('pve-print-toolbar')) return html;
  const toolbar = `
    <div id="pve-print-toolbar" style="position:sticky;top:0;z-index:9999;display:flex;gap:8px;align-items:center;justify-content:space-between;padding:10px 14px;background:#1f4e79;color:#fff;font-family:Segoe UI,Arial,sans-serif;font-size:14px;box-shadow:0 2px 6px rgba(0,0,0,.15);">
      <strong>Print Preview</strong>
      <div style="display:flex;gap:8px;">
        <button type="button" onclick="window.print()" style="cursor:pointer;padding:6px 14px;border:none;border-radius:4px;background:#fff;color:#1f4e79;font-weight:600;">Print</button>
        <button type="button" onclick="window.close()" style="cursor:pointer;padding:6px 14px;border:1px solid #fff;border-radius:4px;background:transparent;color:#fff;">Close</button>
      </div>
    </div>`;
  if (/<body[^>]*>/i.test(html)) {
    return html.replace(/<body([^>]*)>/i, `<body$1>${toolbar}`);
  }
  return `<!doctype html><html><head><meta charset="utf-8" /></head><body>${toolbar}${html}</body></html>`;
}

export async function openPrintPreview(html: string): Promise<void> {
  try {
    localStorage.setItem('pve_print_html', html);
    const w: any = window as any;
    if (w.electronAPI && typeof w.electronAPI.openPrintPreview === 'function') {
      await w.electronAPI.openPrintPreview({ html });
      return;
    }
    const base = window.location.origin;
    const target = `${base}/#/print`;
    const popup = window.open(target, '_blank', 'noopener,noreferrer');
    if (!popup) {
      alert('Unable to open print preview. Please allow popups and try again.');
    }
  } catch (e) {
    console.error('Print preview error', e);
  }
}

export async function downloadPDF(html: string, fileName: string, landscape = false): Promise<string | null> {
  // If Electron IPC is available via preload, use it; otherwise fallback
  try {
    const w: any = window as any;
    if (w.electronAPI && typeof w.electronAPI.printToPDF === 'function') {
      const path = await w.electronAPI.printToPDF({ html, fileName, landscape });
      return path || null;
    }
  } catch (e) {
    console.warn('Electron PDF IPC not available', e);
  }
  // Fallback: open preview and let user use system Print to PDF
  openPrintPreview(html);
  return null;
}

export async function printInvoice(html: string): Promise<boolean> {
  await openPrintPreview(html);
  return true;
}

export async function openExternalUrl(url: string): Promise<void> {
  const w: any = window as any;
  if (w.electronAPI?.openExternalUrl) {
    try {
      const ok = await w.electronAPI.openExternalUrl(url);
      if (ok) return;
    } catch (e) {
      console.warn('openExternalUrl IPC failed', e);
    }
    throw new Error(
      'Could not open link. Restart PVE InvoicePro and ensure WhatsApp Desktop is installed.'
    );
  }
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (!opened) {
    throw new Error('Could not open link. Allow pop-ups or install WhatsApp Desktop.');
  }
}

export function buildInvoiceWhatsAppMessage(
  voucherNumber: string,
  voucherDate: string,
  grandTotal: number
): string {
  const amount = Number(grandTotal || 0).toFixed(2);
  const date = new Date(voucherDate).toLocaleDateString('en-IN');
  return `Invoice ${voucherNumber}\nDate: ${date}\nAmount: ₹${amount}\nThank you for your business!`;
}

export async function shareInvoiceOnWhatsApp(
  voucherNumber: string,
  voucherDate: string,
  grandTotal: number,
  phone?: string
): Promise<void> {
  const message = buildInvoiceWhatsAppMessage(voucherNumber, voucherDate, grandTotal);
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    throw new Error('Customer phone number is required to share on WhatsApp.');
  }
  const result = await openWhatsAppChat(digits, message);
  if (!result.ok) {
    throw new Error(result.error || 'WhatsApp is not connected. Install WhatsApp Desktop or use WhatsApp Web.');
  }
}

export function systemPrint() {
  try {
    window.print();
  } catch (e) {
    console.error('System print failed', e);
  }
}
