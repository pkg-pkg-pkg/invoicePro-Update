import type { PrintExportAction } from '../components/invoice/PrintExportSetupDialog';
import type { InvoiceTemplateId } from '../templates/invoice/invoiceTemplatesConfig';
import type { Voucher } from '../types/vouchers';
import {
  getInvoicePrintLayout,
  getInvoiceTemplateId,
  loadCompanySettingsFromDisk,
  shouldSkipPrintSetupDialog,
} from './companySettingsService';
import { downloadPDF, openPrintPreview, shareInvoiceOnWhatsApp } from './printService';
import { resolvePartyPhone } from './whatsappOutstandingReminder';

export type PrintBuildInput = {
  templateId: InvoiceTemplateId;
  pageSize: string;
  orientation: string;
};

export type PrintBuildResult = {
  html: string;
  fileName: string;
  landscape: boolean;
};

export async function resolveVoucherCustomerPhone(
  voucher: Voucher,
  customerName: string
): Promise<string | null> {
  const line = voucher.lines.find((l) => (l.debit ?? 0) > 0);
  if (!line) return null;
  return resolvePartyPhone(line.ledgerId, customerName);
}

export async function runInvoicePrintExportAction(options: {
  action: PrintExportAction;
  forceSetup?: boolean;
  onNeedSetup: (action: PrintExportAction) => void;
  buildPackage: (input: PrintBuildInput) => Promise<PrintBuildResult> | PrintBuildResult;
  whatsAppMeta?: {
    invoiceNumber: string;
    invoiceDate: string;
    grandTotal: number;
    phone?: string | null;
  };
}): Promise<{ ok: boolean; error?: string }> {
  await loadCompanySettingsFromDisk();

  if (options.action === 'whatsapp') {
    const phone = String(options.whatsAppMeta?.phone || '').trim();
    if (!phone.replace(/\D/g, '')) {
      return {
        ok: false,
        error: 'Customer mobile number is missing. Add mobile/WhatsApp in Party Master.',
      };
    }
    try {
      await shareInvoiceOnWhatsApp(
        options.whatsAppMeta!.invoiceNumber,
        options.whatsAppMeta!.invoiceDate,
        options.whatsAppMeta!.grandTotal,
        phone
      );
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not open WhatsApp.',
      };
    }
  }

  if (!options.forceSetup && shouldSkipPrintSetupDialog()) {
    const layout = getInvoicePrintLayout();
    const built = await Promise.resolve(
      options.buildPackage({
        templateId: getInvoiceTemplateId(),
        pageSize: layout.pageSize,
        orientation: layout.orientation,
      })
    );
    if (options.action === 'print') {
      await openPrintPreview(built.html);
      return { ok: true };
    }
    if (options.action === 'download') {
      await downloadPDF(built.html, built.fileName, built.landscape);
      return { ok: true };
    }
  }

  options.onNeedSetup(options.action);
  return { ok: true };
}
