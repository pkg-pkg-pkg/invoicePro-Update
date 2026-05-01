import api from './api';
import { PartyKind } from './partyService';

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
  const response = await api.post('/payments', input);
  return response.data;
}

