import type { InvoicePaperSize } from '../templates/invoice/invoiceTemplatesConfig';
import { normalizePaperSize } from '../templates/invoice/invoiceTemplatesConfig';
import type { Voucher } from '../types/vouchers';
import { downloadPDF, openPrintPreview, shareInvoiceOnWhatsApp } from './printService';
import { resolvePartyPhone } from './whatsappOutstandingReminder';
import { partyService } from './masters/partyService';

export type PrintExportAction = 'print' | 'download' | 'whatsapp';

export type PrintBuildInput = {
  pageSize: InvoicePaperSize;
};

export type PrintBuildResult = {
  html: string;
  fileName: string;
};

export async function resolveVoucherCustomerPhone(
  voucher: Voucher,
  customerName: string
): Promise<string | null> {
  const line = voucher.lines.find((l) => (l.debit ?? 0) > 0);
  if (!line) return null;
  return resolvePartyPhone(line.ledgerId, customerName);
}

async function resolveOutstandingForLedger(ledgerId: string, customerName: string): Promise<number> {
  try {
    const parties = await partyService.list();
    const key = customerName.trim().toLowerCase();
    const party = parties.find(
      (p) => p.ledgerId === ledgerId || p.id === ledgerId || p.name.trim().toLowerCase() === key
    );
    const balance = Number(party?.currentBalance ?? party?.openingBalance ?? 0);
    if (balance > 0) return balance;
  } catch {
    /* ignore */
  }
  return 0;
}

export async function runInvoicePrintExportAction(options: {
  action: PrintExportAction;
  onNeedPaperSize?: (action: 'download') => void;
  buildPackage: (input: PrintBuildInput) => Promise<PrintBuildResult> | PrintBuildResult;
  whatsAppMeta?: {
    invoiceNumber: string;
    invoiceDate: string;
    grandTotal: number;
    phone?: string | null;
    customerName?: string;
    documentType?: string;
    dueDate?: string;
    ledgerId?: string;
    includePaymentLink?: boolean;
    generatePdf?: boolean;
  };
}): Promise<{ ok: boolean; error?: string }> {
  if (options.action === 'whatsapp') {
    const phone = String(options.whatsAppMeta?.phone || '').trim();
    if (!phone.replace(/\D/g, '')) {
      return {
        ok: false,
        error: 'Customer mobile number is missing. Add mobile/WhatsApp in Party Master.',
      };
    }
    try {
      let pdfPath: string | null = null;
      if (options.whatsAppMeta?.generatePdf !== false) {
        const built = await Promise.resolve(options.buildPackage({ pageSize: 'A4' }));
        pdfPath = await downloadPDF(built.html, built.fileName, false, 'A4');
      }

      let outstandingAmount = 0;
      if (options.whatsAppMeta?.ledgerId) {
        outstandingAmount = await resolveOutstandingForLedger(
          options.whatsAppMeta.ledgerId,
          options.whatsAppMeta.customerName || ''
        );
      }

      await shareInvoiceOnWhatsApp(
        options.whatsAppMeta!.invoiceNumber,
        options.whatsAppMeta!.invoiceDate,
        options.whatsAppMeta!.grandTotal,
        phone,
        {
          customerName: options.whatsAppMeta?.customerName,
          documentType: options.whatsAppMeta?.documentType || 'Invoice',
          dueDate: options.whatsAppMeta?.dueDate,
          outstandingAmount,
          pdfPath,
          includePaymentLink: options.whatsAppMeta?.includePaymentLink,
        }
      );
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Could not open WhatsApp.',
      };
    }
  }

  if (options.action === 'print') {
    const built = await Promise.resolve(options.buildPackage({ pageSize: 'A4' }));
    await openPrintPreview(built.html, { pageSize: 'A4' });
    return { ok: true };
  }

  if (options.action === 'download') {
    options.onNeedPaperSize?.('download');
    return { ok: true };
  }

  return { ok: false, error: 'Unknown action' };
}

export async function runInvoiceDownloadWithPaperSize(options: {
  pageSize: InvoicePaperSize;
  buildPackage: (input: PrintBuildInput) => Promise<PrintBuildResult> | PrintBuildResult;
}): Promise<{ ok: boolean; error?: string; path?: string | null }> {
  const size = normalizePaperSize(options.pageSize);
  const built = await Promise.resolve(options.buildPackage({ pageSize: size }));
  const path = await downloadPDF(built.html, built.fileName, false, size);
  return { ok: Boolean(path), path };
}
