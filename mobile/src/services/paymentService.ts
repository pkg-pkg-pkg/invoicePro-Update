import { PartyKind } from './partyService';
import { middlewareSync } from './sync/middlewareSync';

export type EntryType = 'RECEIPT' | 'PAYMENT';

export async function createEntry(input: {
  type: EntryType;
  partyId: string;
  partyType: PartyKind;
  amount: number;
  paymentMode: 'CASH' | 'UPI' | 'BANK_TRANSFER';
  notes?: string;
  date: string;
}) {
  const entityType = input.type === 'RECEIPT' ? 'receipt' : 'payment';
  const event = await middlewareSync.enqueueCreate(entityType, input as unknown as Record<string, unknown>);
  return {
    success: true,
    queued: true,
    idempotencyKey: event.idempotencyKey,
  };
}

