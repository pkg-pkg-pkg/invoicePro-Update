
export type PrintFormat = 'A4_PORTRAIT' | 'A4_LANDSCAPE' | 'A5_PORTRAIT' | 'A5_LANDSCAPE' | 'THERMAL_80' | 'THERMAL_58';

export interface CompanyInfo {
  name: string;
  address: string;
  gstin?: string;
  logo?: string; // base64 or path
  signature?: string; // base64 or path
}

export interface InvoiceItem {
  name: string;
  hsn?: string;
  qty: number;
  rate: number;
  taxPercent: number; // 0/5/12/18/28
  amount: number; // inclusive of tax if needed
  cgst?: number;
  sgst?: number;
  igst?: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string; // ISO
  customerName: string;
  customerGSTIN?: string;
  items: InvoiceItem[];
  subtotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  grandTotal: number;
  amountInWords: string;
  declaration?: string;
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
    body { font-family: Arial, sans-serif; font-size: ${fontSize}px; color: #000; line-height: 1.3; }
    .invoice-container { width: ${bodyWidth}; margin: 0 auto; padding: ${isThermal ? 2 : 0}mm; }
    .header { display: flex; align-items: center; gap: ${isThermal ? 6 : 12}px; }
    .logo { max-height: ${isThermal ? 40 : 60}px; }
    .title { font-size: ${fontSize + (isThermal ? 2 : 3)}px; font-weight: 700; }
    .muted { color: #444; font-size: ${isThermal ? fontSize - 1 : fontSize}px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #ddd; padding: ${isThermal ? 3 : 8}px; text-align: left; font-size: ${isThermal ? fontSize - 1 : fontSize}px; }
    th { background: #f5f5f5; font-weight: 600; }
    .totals td { font-weight: 600; }
    .section { margin-top: ${isThermal ? 4 : 12}px; }
    .signature { text-align: right; margin-top: ${isThermal ? 8 : 24}px; }
  `;
};

export function buildInvoiceHTML(format: PrintFormat, company: CompanyInfo, data: InvoiceData, opts: PrintOptions): string {
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

  const headerLogo = opts.logoPosition === 'top-left' ? `<div class="header">${logoHtml}<div><div class="title">${company.name}</div><div class="muted">${company.address}</div><div>GSTIN: ${company.gstin||'-'}</div></div></div>` : `<div style="text-align:center">${logoHtml}<div class="title">${company.name}</div><div class="muted">${company.address}</div><div>GSTIN: ${company.gstin||'-'}</div></div>`;

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
              <td><strong>Invoice No:</strong> ${data.invoiceNumber}</td>
              <td><strong>Date:</strong> ${new Date(data.invoiceDate).toLocaleDateString('en-IN')}</td>
            </tr>
            <tr>
              <td><strong>Customer:</strong> ${data.customerName}</td>
              <td><strong>Customer GSTIN:</strong> ${data.customerGSTIN || '-'}</td>
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

        <div class="section"><strong>Amount in Words:</strong> ${data.amountInWords}</div>
        ${declarationHtml}

        <div class="signature">
          <div>Authorized Signatory</div>
          ${signatureHtml || ''}
        </div>
      </div>
    </body>
  </html>
  `;
}

export function openPrintPreview(html: string) {
  try {
    localStorage.setItem('pve_print_html', html);
    const base = window.location.origin;
    const target = `${base}/#/print`;
    window.open(target, '_blank', 'noopener,noreferrer');
  } catch (e) {
    console.error('Print preview error', e);
  }
}

export async function downloadPDF(html: string, fileName: string, landscape = false): Promise<string | null> {
  // If Electron IPC is available via preload, use it; otherwise fallback
  try {
    const w: any = window as any;
    if (w.electron && typeof w.electron.invoke === 'function') {
      const path = await w.electron.invoke('print:pdf', { html, fileName, landscape });
      return path || null;
    }
  } catch (e) {
    console.warn('Electron PDF IPC not available', e);
  }
  // Fallback: open preview and let user use system Print to PDF
  openPrintPreview(html);
  return null;
}

export function systemPrint() {
  try {
    window.print();
  } catch (e) {
    console.error('System print failed', e);
  }
}
