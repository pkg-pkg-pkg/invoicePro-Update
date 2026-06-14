import type { NavigateFunction } from 'react-router-dom';
import { salesPipelineService } from '../../services/sales/salesDocumentService';
import { voucherService } from '../../services/vouchers/voucherService';
import { partyService } from '../../services/masters/partyService';
import { inventoryItemService } from '../../services/masters/inventoryItemService';
import { customersApi } from '../../services/customers/customersApi';
import {
  sendOutstandingReminderOnWhatsApp,
  sendStatementOnWhatsApp,
} from '../../services/customers/customerLedgerStatementService';
import { openWhatsAppChat } from '../../services/whatsappIntegration';
import { exportSalesDocumentsPdf } from '../../utils/salesDocumentExport';
import { formatCurrency } from '../../utils/formatters';
import { generateId } from '../../utils/id';
import { readList, writeList } from '../../services/masters/storageHelpers';
import type { SalesDocKind, SalesPipelineDocument } from '../../types/salesDocuments';
import type { ActionContext, DocumentListKind, RowActionId } from './types';

const PIPELINE_PREFILL_KEY = 'pve_pipeline_prefill';

type StoredExpense = {
  id: string;
  date: string;
  amount: number;
  description?: string;
  referenceNumber?: string;
  status?: string;
};

export type ActionHandlerDeps = {
  navigate: NavigateFunction;
  onRefresh?: () => void;
  showToast: (message: string, severity?: 'success' | 'error' | 'info') => void;
  onEditCustomer?: (partyId: string) => void;
};

async function resolvePartyContact(partyId?: string) {
  if (!partyId) return { email: '', phone: '' };
  try {
    const party = await partyService.getById(partyId);
    return {
      email: String(party?.email ?? '').trim(),
      phone: String(party?.whatsapp ?? party?.mobile ?? '').trim(),
    };
  } catch {
    return { email: '', phone: '' };
  }
}

async function clonePipelineDocument(sourceId: string): Promise<SalesPipelineDocument> {
  const source = await salesPipelineService.getById(sourceId);
  if (!source) throw new Error('Document not found');
  return salesPipelineService.create({
    kind: source.kind,
    customerId: source.customerId,
    customerName: source.customerName,
    lines: source.lines.map((line) => ({ ...line, id: generateId('line') })),
    header: { ...source.header },
    notes: source.notes,
    dueDate: source.dueDate,
    status: 'DRAFT',
    date: new Date().toISOString().slice(0, 10),
  });
}

async function convertPipelineDocument(sourceId: string, targetKind: SalesDocKind): Promise<SalesPipelineDocument> {
  const source = await salesPipelineService.getById(sourceId);
  if (!source) throw new Error('Document not found');
  const header = { ...source.header };
  if (source.kind === 'quotations') {
    header.linkedQuotationNo = source.number;
  }
  return salesPipelineService.create({
    kind: targetKind,
    customerId: source.customerId,
    customerName: source.customerName,
    lines: source.lines.map((line) => ({ ...line, id: generateId('line') })),
    header,
    notes: source.notes,
    dueDate: source.dueDate,
    status: 'DRAFT',
    date: new Date().toISOString().slice(0, 10),
  });
}

function storePipelinePrefill(pipelineId: string, target: 'tax-invoice' | 'purchase-bill') {
  sessionStorage.setItem(PIPELINE_PREFILL_KEY, JSON.stringify({ pipelineId, target }));
}

export function createRowActionHandlers(deps: ActionHandlerDeps) {
  const { navigate, onRefresh, showToast, onEditCustomer } = deps;

  const refresh = () => onRefresh?.();

  const handleDocumentPrint = (ctx: Extract<ActionContext, { type: 'document' }>) => {
    const { row, title } = ctx;
    if (row.source === 'voucher' && row.editPath && ctx.listKind === 'tax-invoices') {
      navigate(`${row.editPath}?print=1`);
      return;
    }
    exportSalesDocumentsPdf([row], `${title} — ${row.number}`);
  };

  const handleDocumentWhatsapp = async (ctx: Extract<ActionContext, { type: 'document' }>) => {
    const { row } = ctx;
    if (row.source === 'voucher' && row.editPath && ctx.listKind === 'tax-invoices') {
      navigate(`${row.editPath}?send=whatsapp`);
      return;
    }
    const contact = await resolvePartyContact(row.customerId);
    const message = `${row.number}\nAmount: ${formatCurrency(row.amount)}`;
    await openWhatsAppChat(contact.phone, message);
  };

  const handleDocumentEmail = async (ctx: Extract<ActionContext, { type: 'document' }>) => {
    const { row } = ctx;
    if (row.source === 'voucher' && row.editPath && ctx.listKind === 'tax-invoices') {
      navigate(`${row.editPath}?send=email`);
      return;
    }
    const contact = await resolvePartyContact(row.customerId);
    const subject = encodeURIComponent(`Document ${row.number}`);
    const body = encodeURIComponent(`Please find details for ${row.number}.\nAmount: ${formatCurrency(row.amount)}`);
    const mailto = contact.email ? `mailto:${contact.email}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
    window.location.href = mailto;
  };

  const handlePipelineConvert = async (
    row: Extract<ActionContext, { type: 'document' }>['row'],
    targetKind: SalesDocKind,
    label: string
  ) => {
    const created = await convertPipelineDocument(row.id, targetKind);
    showToast(`Converted to ${label} ${created.number}`);
    navigate(`/sales/${targetKind}/${created.id}/edit`);
    refresh();
  };

  const cancelPipeline = async (id: string) => {
    await salesPipelineService.update(id, { status: 'CANCELLED' });
  };

  const deletePipeline = async (id: string) => {
    await salesPipelineService.remove([id]);
  };

  const deleteExpense = async (id: string) => {
    const rows = await readList<StoredExpense>('expenses');
    await writeList(
      'expenses',
      rows.filter((r) => r.id !== id)
    );
  };

  return {
    async execute(actionId: RowActionId, ctx: ActionContext) {
      if (ctx.type === 'customer') {
        const party = ctx.party;
        switch (actionId) {
          case 'openEdit':
            onEditCustomer?.(party.id);
            break;
          case 'viewStatement':
            navigate(`/customers/${encodeURIComponent(party.id)}/statement`);
            break;
          case 'sendStatementWhatsapp':
            await sendStatementOnWhatsApp(party.id);
            showToast(`WhatsApp opened for ${party.name}`);
            break;
          case 'sendOutstandingReminder':
            await sendOutstandingReminderOnWhatsApp(party.id);
            showToast(`Reminder sent via WhatsApp for ${party.name}`);
            break;
          case 'reactivateCustomer':
            await customersApi.reactivate(party.id);
            showToast(`${party.name} reactivated`);
            refresh();
            break;
          case 'newTransaction':
            navigate(`/vouchers/sales/new?customerId=${encodeURIComponent(party.id)}`);
            break;
          case 'sendEmail': {
            const subject = encodeURIComponent(`Message for ${party.name}`);
            const mailto = party.email
              ? `mailto:${party.email}?subject=${subject}`
              : `mailto:?subject=${subject}`;
            window.location.href = mailto;
            break;
          }
          case 'markInactive':
            await customersApi.markInactive(party.id);
            showToast(`${party.name} marked inactive`);
            refresh();
            break;
          case 'delete':
            throw new Error('CUSTOMER_DELETE_DIALOG');
            break;
          default:
            break;
        }
        return;
      }

      if (ctx.type === 'inventory') {
        const { item, canManage } = ctx;
        if (!canManage && ['clone', 'adjustStock', 'markInactive', 'delete'].includes(actionId)) {
          showToast('You do not have permission to manage inventory items', 'error');
          return;
        }
        switch (actionId) {
          case 'openEdit':
            navigate(`/items?edit=${item.id}`);
            break;
          case 'clone': {
            const created = await inventoryItemService.create({
              name: `${item.name} (Copy)`,
              sku: item.sku ? `${item.sku}-COPY` : undefined,
              barcode: undefined,
              unitId: item.unitId,
              categoryId: item.categoryId,
              pricing: item.pricing,
              gstRate: item.gstRate,
              hsnCode: item.hsnCode,
              godownStocks: item.godownStocks,
              reorderLevel: item.reorderLevel,
              status: 'ACTIVE',
            });
            showToast(`Cloned item as ${created.name}`);
            refresh();
            break;
          }
          case 'adjustStock':
            navigate(`/masters/stock-adjustments/new?itemId=${encodeURIComponent(item.id)}`);
            break;
          case 'markInactive':
            await inventoryItemService.softDelete(item.id);
            showToast(`${item.name} marked inactive`);
            refresh();
            break;
          case 'delete':
            await inventoryItemService.softDelete(item.id);
            showToast(`${item.name} deleted`);
            refresh();
            break;
          default:
            break;
        }
        return;
      }

      const { row, listKind, title } = ctx;

      switch (actionId) {
        case 'openEdit':
          if (row.editPath) navigate(row.editPath);
          break;
        case 'printPdf':
          handleDocumentPrint(ctx);
          break;
        case 'sendWhatsapp':
          await handleDocumentWhatsapp(ctx);
          break;
        case 'sendEmail':
          await handleDocumentEmail(ctx);
          break;
        case 'recordPayment':
          if (listKind === 'tax-invoices') {
            navigate(
              `/sales/collections/new?customerId=${encodeURIComponent(row.customerId ?? '')}&invoiceId=${encodeURIComponent(row.id)}`
            );
          } else if (listKind === 'purchase-purchase-bills') {
            navigate(
              `/vouchers/payment-vouchers/new?vendorId=${encodeURIComponent(row.customerId ?? '')}&billId=${encodeURIComponent(row.id)}`
            );
          }
          break;
        case 'convertToInvoice':
          if (row.source === 'pipeline') {
            storePipelinePrefill(row.id, 'tax-invoice');
            navigate(`/vouchers/sales/new?customerId=${encodeURIComponent(row.customerId ?? '')}`);
            showToast(`Opening Tax Invoice from ${row.number}`);
          }
          break;
        case 'convertToSalesOrder':
          await handlePipelineConvert(row, 'sales-orders', 'Sales Order');
          break;
        case 'convertToTaxInvoice':
          if (row.source === 'pipeline') {
            storePipelinePrefill(row.id, 'tax-invoice');
            navigate(`/vouchers/sales/new?customerId=${encodeURIComponent(row.customerId ?? '')}`);
            showToast(`Opening Tax Invoice from ${row.number}`);
          }
          break;
        case 'createDispatchNote':
          await handlePipelineConvert(row, 'dispatch', 'Dispatch Note');
          break;
        case 'convertToPurchaseBill':
          if (row.source === 'pipeline') {
            storePipelinePrefill(row.id, 'purchase-bill');
            navigate(`/vouchers/purchase/new?vendorId=${encodeURIComponent(row.customerId ?? '')}`);
            showToast(`Opening Purchase Bill from ${row.number}`);
          }
          break;
        case 'applyToInvoice':
          navigate(`/vouchers/sales-return/new?applyToInvoice=${encodeURIComponent(row.id)}`);
          break;
        case 'applyToBill':
          navigate(`/vouchers/purchase-return/new?applyToBill=${encodeURIComponent(row.id)}`);
          break;
        case 'pauseRecurring':
          await salesPipelineService.update(row.id, {
            status: 'CLOSED',
            header: { recurringPaused: true },
          });
          showToast(`Recurring plan ${row.number} paused`);
          refresh();
          break;
        case 'resumeRecurring':
          await salesPipelineService.update(row.id, {
            status: 'DRAFT',
            header: { recurringPaused: false },
          });
          showToast(`Recurring plan ${row.number} resumed`);
          refresh();
          break;
        case 'clone': {
          if (row.source === 'pipeline') {
            const cloned = await clonePipelineDocument(row.id);
            showToast(`Cloned as ${cloned.number}`);
            navigate(`/sales/${cloned.kind}/${cloned.id}/edit`);
            refresh();
          } else if (row.source === 'expense') {
            const rows = await readList<StoredExpense>('expenses');
            const source = rows.find((r) => r.id === row.id);
            if (!source) throw new Error('Expense not found');
            const copy = {
              ...source,
              id: generateId('exp'),
              referenceNumber: source.referenceNumber ? `${source.referenceNumber}-COPY` : undefined,
            };
            rows.push(copy);
            await writeList('expenses', rows);
            showToast('Expense cloned');
            refresh();
          }
          break;
        }
        case 'cancel':
          if (row.source === 'pipeline') {
            await cancelPipeline(row.id);
            showToast(`${row.number} cancelled`);
          } else if (row.source === 'voucher') {
            await voucherService.cancel(row.id);
            showToast(`${row.number} cancelled`);
          }
          refresh();
          break;
        case 'delete':
          if (row.source === 'pipeline') {
            await deletePipeline(row.id);
          } else if (row.source === 'expense') {
            await deleteExpense(row.id);
          } else {
            await voucherService.delete(row.id);
          }
          showToast(`${row.number} deleted`);
          refresh();
          break;
        default:
          break;
      }
    },

    needsConfirm(actionId: RowActionId, ctx: ActionContext): { kind: 'delete' | 'cancel' | 'reactivate'; title: string } | null {
      if (actionId === 'reactivateCustomer' && ctx.type === 'customer') {
        return { kind: 'reactivate', title: ctx.party.name };
      }
      if (actionId === 'delete' && ctx.type === 'customer') {
        return null;
      }
      if (actionId === 'delete') {
        const name =
          ctx.type === 'customer'
            ? ctx.party.name
            : ctx.type === 'inventory'
              ? ctx.item.name
              : ctx.row.number;
        return { kind: 'delete', title: name };
      }
      if (actionId === 'cancel' && ctx.type === 'document') {
        return { kind: 'cancel', title: ctx.row.number };
      }
      return null;
    },
  };
}

export { PIPELINE_PREFILL_KEY };
