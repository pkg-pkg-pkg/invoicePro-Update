import api from './api';
import { PartyKind } from './partyService';

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

  const response = await api.post('/invoices', {
    type: input.invoiceType,
    date: new Date().toISOString(),
    partyId: input.partyId,
    partyType: input.partyType,
    notes: input.notes || undefined,
    paymentMode: [],
    discount: 0,
    discountType: 'PERCENTAGE',
    items,
  });
  return response.data;
}

