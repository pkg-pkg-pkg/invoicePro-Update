import type { ActionContext, DocumentListKind, RowActionId } from './types';

export type RowActionDef = {
  id: RowActionId;
  label: string;
  destructive?: boolean;
  dividerBefore?: boolean;
  visible?: (ctx: ActionContext) => boolean;
};

const DOC_ACTIONS: Record<DocumentListKind, RowActionDef[]> = {
  collections: [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendWhatsapp', label: '📱 Send WhatsApp' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'cancel', label: '❌ Cancel Collection', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  quotations: [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendWhatsapp', label: '📱 Send WhatsApp' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'convertToInvoice', label: '🔄 Convert to Invoice', dividerBefore: true },
    { id: 'convertToSalesOrder', label: '🔄 Convert to Sales Order' },
    { id: 'clone', label: '📋 Clone / Duplicate' },
    { id: 'cancel', label: '❌ Cancel', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  proforma: [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendWhatsapp', label: '📱 Send WhatsApp' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'convertToTaxInvoice', label: '🔄 Convert to Tax Invoice', dividerBefore: true },
    { id: 'clone', label: '📋 Clone / Duplicate' },
    { id: 'cancel', label: '❌ Cancel', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  'sales-orders': [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendWhatsapp', label: '📱 Send WhatsApp' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'convertToTaxInvoice', label: '🔄 Convert to Tax Invoice', dividerBefore: true },
    { id: 'createDispatchNote', label: '🚚 Create Dispatch Note' },
    { id: 'clone', label: '📋 Clone / Duplicate' },
    { id: 'cancel', label: '❌ Cancel Order', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  dispatch: [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendWhatsapp', label: '📱 Send WhatsApp' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'convertToTaxInvoice', label: '🔄 Convert to Tax Invoice', dividerBefore: true },
    { id: 'cancel', label: '❌ Cancel', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  'tax-invoices': [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendWhatsapp', label: '📱 Send WhatsApp' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'recordPayment', label: '💰 Record Payment', dividerBefore: true },
    { id: 'cancel', label: '❌ Cancel Invoice', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  'credit-adjustments': [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendWhatsapp', label: '📱 Send WhatsApp' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'applyToInvoice', label: '🔄 Apply to Invoice', dividerBefore: true },
    { id: 'cancel', label: '❌ Cancel', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  recurring: [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    {
      id: 'pauseRecurring',
      label: '⏸️ Pause Recurring',
      visible: (ctx) =>
        ctx.type === 'document' &&
        ctx.row.source === 'pipeline' &&
        ctx.row.status !== 'CLOSED' &&
        ctx.row.status !== 'CANCELLED',
    },
    {
      id: 'resumeRecurring',
      label: '▶️ Resume Recurring',
      visible: (ctx) =>
        ctx.type === 'document' &&
        ctx.row.source === 'pipeline' &&
        ctx.row.status === 'CLOSED',
    },
    { id: 'clone', label: '📋 Clone', dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  'purchase-purchase-orders': [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendWhatsapp', label: '📱 Send WhatsApp' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'convertToPurchaseBill', label: '🔄 Convert to Purchase Bill', dividerBefore: true },
    { id: 'clone', label: '📋 Clone / Duplicate' },
    { id: 'cancel', label: '❌ Cancel Order', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  'purchase-purchase-bills': [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'recordPayment', label: '💰 Record Payment', dividerBefore: true },
    { id: 'cancel', label: '❌ Cancel Bill', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  'purchase-vendor-payments': [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendWhatsapp', label: '📱 Send WhatsApp' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'cancel', label: '❌ Cancel Payment', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  'purchase-debit-notes': [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'sendEmail', label: '📧 Send Email' },
    { id: 'applyToBill', label: '🔄 Apply to Bill', dividerBefore: true },
    { id: 'cancel', label: '❌ Cancel', destructive: true, dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  'purchase-expenses': [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'printPdf', label: '🖨️ Print / PDF' },
    { id: 'clone', label: '📋 Clone', dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  'purchase-recurring-bills': [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'pauseRecurring', label: '⏸️ Pause Recurring' },
    { id: 'resumeRecurring', label: '▶️ Resume Recurring' },
    { id: 'clone', label: '📋 Clone', dividerBefore: true },
    { id: 'delete', label: '🗑️ Delete', destructive: true },
  ],
  customers: [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'viewStatement', label: '📊 View Statement' },
    { id: 'newTransaction', label: '💰 New Transaction', dividerBefore: true },
    { id: 'sendEmail', label: '📧 Send Email' },
    {
      id: 'markInactive',
      label: '🔴 Mark Inactive',
      visible: (ctx) => ctx.type === 'customer' && ctx.party.status !== 'INACTIVE',
    },
    { id: 'delete', label: '🗑️ Delete', destructive: true, dividerBefore: true },
  ],
  'inventory-items': [
    { id: 'openEdit', label: '✏️ Open / Edit' },
    { id: 'clone', label: '📋 Clone / Duplicate Item' },
    { id: 'adjustStock', label: '📦 Adjust Stock', dividerBefore: true },
    {
      id: 'markInactive',
      label: '🔴 Mark Inactive',
      visible: (ctx) => ctx.type === 'inventory' && ctx.item.status === 'ACTIVE',
    },
    { id: 'delete', label: '🗑️ Delete', destructive: true, dividerBefore: true },
  ],
};

function isCancelledDocument(ctx: ActionContext): boolean {
  if (ctx.type !== 'document') return false;
  return ctx.row.status === 'CANCELLED';
}

function isPipelineRow(ctx: ActionContext): boolean {
  return ctx.type === 'document' && ctx.row.source === 'pipeline';
}

function isVoucherRow(ctx: ActionContext): boolean {
  return ctx.type === 'document' && (ctx.row.source === 'voucher' || ctx.row.source === 'expense');
}

export function getRowActionsForContext(ctx: ActionContext): RowActionDef[] {
  const listKind =
    ctx.type === 'document'
      ? ctx.listKind
      : ctx.type === 'customer'
        ? 'customers'
        : 'inventory-items';

  const defs = DOC_ACTIONS[listKind] ?? [{ id: 'openEdit', label: '✏️ Open / Edit' }];

  return defs.filter((def) => {
    if (def.visible && !def.visible(ctx)) return false;
    if (def.id === 'openEdit') {
      if (ctx.type === 'document' && !ctx.row.editPath) return false;
    }
    if (def.id === 'cancel' && isCancelledDocument(ctx)) return false;
    if (
      ['convertToInvoice', 'convertToSalesOrder', 'convertToTaxInvoice', 'createDispatchNote', 'clone', 'pauseRecurring', 'resumeRecurring'].includes(
        def.id
      ) &&
      !isPipelineRow(ctx)
    ) {
      return false;
    }
    if (def.id === 'recordPayment' && ctx.type === 'document') {
      if (ctx.listKind === 'tax-invoices' && ctx.row.source !== 'voucher') return false;
      if (ctx.listKind === 'purchase-purchase-bills' && ctx.row.source !== 'voucher') return false;
      if (ctx.row.status === 'PAID' || ctx.row.status === 'CANCELLED') return false;
    }
    if (['cancel', 'delete'].includes(def.id) && ctx.type === 'document') {
      if (def.id === 'delete' && ctx.row.source === 'pipeline' && listKind === 'tax-invoices') return false;
    }
    if (def.id === 'delete' && ctx.type === 'inventory' && !ctx.canManage) return false;
    if (def.id === 'markInactive' && ctx.type === 'inventory' && !ctx.canManage) return false;
    if (def.id === 'clone' && ctx.type === 'inventory' && !ctx.canManage) return false;
    if (def.id === 'adjustStock' && ctx.type === 'inventory' && !ctx.canManage) return false;
    if (['printPdf', 'sendWhatsapp', 'sendEmail', 'applyToInvoice', 'applyToBill'].includes(def.id)) {
      if (ctx.type === 'document' && ctx.row.source === 'expense' && def.id === 'sendWhatsapp') return false;
    }
    if (def.id === 'convertToPurchaseBill' && !isPipelineRow(ctx)) return false;
    if (
      ['cancel', 'delete'].includes(def.id) &&
      ctx.type === 'document' &&
      ctx.listKind.startsWith('purchase-') &&
      ctx.row.source === 'expense' &&
      def.id === 'cancel'
    ) {
      return false;
    }
    if (def.id === 'delete' && ctx.type === 'document' && isVoucherRow(ctx) && ctx.row.status === 'CANCELLED') {
      // still allow delete of cancelled vouchers
    }
    return true;
  });
}
