import { renderInvoiceTemplate } from '../templates/invoice/invoiceTemplateRenderer';
import type { InvoicePaperSize } from '../templates/invoice/invoiceTemplatesConfig';
import { normalizePaperSize } from '../templates/invoice/invoiceTemplatesConfig';
import { openWhatsAppChat } from './whatsappIntegration';
import { buildUpiPayUri, readCompanyUpiProfile } from './upiQrService';
import { getWhatsAppTemplate, renderWhatsAppTemplate } from './whatsappMessageTemplates';
import { getNormalizedCompanyProfile } from '../utils/companyProfile';

export type PrintFormat = 'A4_PORTRAIT' | 'A5_PORTRAIT';

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
  logo?: string;
  signature?: string;
}

export interface InvoiceItem {
  name: string;
  hsn?: string;
  qty: number;
  unit?: string;
  mrp?: number;
  rate: number;
  rateInclusive?: number;
  discount?: number;
  discountPercent?: number;
  discountAmount?: number;
  taxPercent: number;
  taxAmount?: number;
  amount: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
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
  freightTotal?: number;
  paymentMode?: string;
  referenceNo?: string;
  referenceDate?: string;
  buyerOrderNo?: string;
  buyerOrderDate?: string;
  otherReferences?: string;
  termsOfDelivery?: string;
  buyerState?: string;
  buyerStateCode?: string;
  consigneeContactPerson?: string;
  buyerContactPerson?: string;
  prevBalance?: number;
  bankBranch?: string;
  bankAccountHolder?: string;
  jurisdictionNote?: string;
}

export interface PrintOptions {
  showTaxBreakup: boolean;
  showSignature: boolean;
  showDeclaration: boolean;
  logoPosition: 'top-left' | 'top-center';
  fontSize: 'normal' | 'compact';
  margin: 'small' | 'normal';
}

export const DEFAULT_INVOICE_PRINT_OPTIONS: PrintOptions = {
  showTaxBreakup: true,
  showSignature: true,
  showDeclaration: true,
  logoPosition: 'top-left',
  fontSize: 'normal',
  margin: 'normal',
};

export function paperSizeToFormat(pageSize: string | InvoicePaperSize): PrintFormat {
  return normalizePaperSize(pageSize) === 'A5' ? 'A5_PORTRAIT' : 'A4_PORTRAIT';
}

export async function buildInvoiceHTML(
  format: PrintFormat,
  company: CompanyInfo,
  data: InvoiceData,
  opts: PrintOptions = DEFAULT_INVOICE_PRINT_OPTIONS
): Promise<string> {
  return renderInvoiceTemplate(format, company, data, opts);
}

export async function openPrintPreview(
  html: string,
  opts?: { pageSize?: InvoicePaperSize | string }
): Promise<void> {
  try {
    localStorage.setItem('pve_print_html', html);
    const w: any = window as any;
    if (w.electronAPI && typeof w.electronAPI.openPrintPreview === 'function') {
      const pageSize = normalizePaperSize(opts?.pageSize);
      await w.electronAPI.openPrintPreview({ html, pageSize });
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

export async function downloadPDF(
  html: string,
  fileName: string,
  _landscape = false,
  pageSize: InvoicePaperSize | string = 'A4'
): Promise<string | null> {
  try {
    const w: any = window as any;
    if (w.electronAPI && typeof w.electronAPI.printToPDF === 'function') {
      const path = await w.electronAPI.printToPDF({
        html,
        fileName,
        landscape: false,
        pageSize: normalizePaperSize(pageSize),
      });
      return path || null;
    }
  } catch (e) {
    console.warn('Electron PDF IPC not available', e);
  }
  await openPrintPreview(html, { pageSize: normalizePaperSize(pageSize) });
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
  const company = getNormalizedCompanyProfile();
  return renderWhatsAppTemplate(getWhatsAppTemplate('invoice'), {
    customerName: 'Customer',
    documentType: 'Invoice',
    invoiceNumber: voucherNumber,
    invoiceDate: date,
    amount,
    companyName: company.businessName || company.name || 'Your Company',
  });
}

export interface ShareInvoiceWhatsAppOptions {
  invoiceNumber: string;
  invoiceDate: string;
  grandTotal: number;
  phone?: string;
  customerName?: string;
  documentType?: string;
  outstandingAmount?: number;
  dueDate?: string;
  pdfPath?: string | null;
  includePaymentLink?: boolean;
}

export async function buildInvoiceWhatsAppShareMessage(
  options: ShareInvoiceWhatsAppOptions
): Promise<string> {
  const company = getNormalizedCompanyProfile();
  const upi = await readCompanyUpiProfile();
  const amount = Number(options.grandTotal || 0).toFixed(2);
  const date = new Date(options.invoiceDate).toLocaleDateString('en-IN');
  const paymentLink =
    options.includePaymentLink !== false && upi.upiId
      ? buildUpiPayUri({
          upiId: upi.upiId,
          payeeName: upi.payeeName || company.businessName || company.name || 'Merchant',
          amount: Number(options.grandTotal || 0),
          invoiceNumber: options.invoiceNumber,
        })
      : '';
  const outstanding =
    options.outstandingAmount != null && Number(options.outstandingAmount) > 0
      ? Number(options.outstandingAmount).toFixed(2)
      : '';
  const pdfNote = options.pdfPath
    ? `PDF saved: ${options.pdfPath}`
    : '';

  return renderWhatsAppTemplate(getWhatsAppTemplate('invoice'), {
    customerName: options.customerName || 'Customer',
    documentType: options.documentType || 'Invoice',
    invoiceNumber: options.invoiceNumber,
    invoiceDate: date,
    amount,
    paymentLink,
    pdfNote,
    outstandingAmount: outstanding,
    dueDate: options.dueDate
      ? new Date(options.dueDate).toLocaleDateString('en-IN')
      : '',
    companyName: company.businessName || company.name || 'Your Company',
  });
}

export async function shareInvoiceOnWhatsApp(
  voucherNumber: string,
  voucherDate: string,
  grandTotal: number,
  phone?: string,
  extras?: Omit<ShareInvoiceWhatsAppOptions, 'invoiceNumber' | 'invoiceDate' | 'grandTotal' | 'phone'>
): Promise<void> {
  const message = await buildInvoiceWhatsAppShareMessage({
    invoiceNumber: voucherNumber,
    invoiceDate: voucherDate,
    grandTotal,
    phone,
    ...extras,
  });
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) {
    throw new Error('Customer phone number is required to share on WhatsApp.');
  }
  const result = await openWhatsAppChat(digits, message);
  if (!result.ok) {
    throw new Error(result.error || 'WhatsApp is not connected. Install WhatsApp Desktop or use WhatsApp Web.');
  }
  const { trackFeatureUsage } = await import('./privacy/featureAnalyticsService');
  trackFeatureUsage('whatsappShare');
}
