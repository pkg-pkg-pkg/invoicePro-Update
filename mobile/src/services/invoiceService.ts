import { PartyKind } from './partyService';
import { mobileSyncWorker } from './sync/mobileSyncWorker';

export type InvoiceLineInput = {
  itemName: string;
  quantity: number;
  rate: number;
  gstRate: number;
};

export async function createSimpleInvoice(input: {
  invoiceType: 'SALES_INVOICE' | 'PURCHASE_INVOICE';
  partyId: string;
  partyType: PartyKind;
  items: InvoiceLineInput[];
  notes?: string;
}) {
  const items = input.items.map((line) => ({
    name: line.itemName,
    quantity: line.quantity,
    unit: 'PCS',
    rate: line.rate,
    gstRate: line.gstRate,
    discount: 0,
    discountType: 'PERCENTAGE',
  }));

  const payload = {
    type: input.invoiceType,
    date: new Date().toISOString(),
    partyId: input.partyId,
    partyType: input.partyType,
    notes: input.notes || undefined,
    paymentMode: [],
    discount: 0,
    discountType: 'PERCENTAGE',
    items,
  };
  const event = await mobileSyncWorker.enqueueCreate('invoice', payload as unknown as Record<string, unknown>);
  return {
    success: true,
    queued: true,
    invoiceNumber: `PENDING-${event.id.slice(-6).toUpperCase()}`,
    idempotencyKey: event.idempotencyKey,
  };
}

