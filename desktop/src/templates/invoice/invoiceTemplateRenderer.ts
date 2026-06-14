import type { CompanyInfo, InvoiceData, PrintFormat, PrintOptions } from '../../services/printService';
import { renderTaxStandardInvoice } from './taxInvoiceTemplateRenderer';

/** Renders the single universal GST tax invoice format. */
export const renderInvoiceTemplate = async (
  format: PrintFormat,
  company: CompanyInfo,
  data: InvoiceData,
  opts: PrintOptions
): Promise<string> => {
  return renderTaxStandardInvoice(format, company, data, opts, data);
};
