/** Universal tax invoice — paper size is chosen only at print/PDF time. */
export type InvoicePaperSize = 'A4' | 'A5';

export const DEFAULT_INVOICE_PAPER_SIZE: InvoicePaperSize = 'A4';

export function normalizePaperSize(size: string | undefined): InvoicePaperSize {
  return String(size || 'A4').toUpperCase() === 'A5' ? 'A5' : 'A4';
}
