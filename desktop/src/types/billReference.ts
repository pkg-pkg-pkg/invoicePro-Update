/** Tally-style bill-wise settlement reference master. */

export type BillReferenceType = 'NEW_REF' | 'ADVANCE' | 'ON_ACCOUNT';

export type BillReferenceStatus = 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED';

export type SettlementMode = 'AGAINST_REF' | 'ADVANCE' | 'ON_ACCOUNT';

export interface BillReference {
  id: string;
  companyId: string;
  /** Party ledger account id (Sundry Debtors / Creditors). */
  partyId: string;
  referenceNo: string;
  referenceType: BillReferenceType;
  voucherId: string;
  voucherNumber: string;
  voucherDate: string;
  originalAmount: number;
  adjustedAmount: number;
  pendingAmount: number;
  status: BillReferenceStatus;
  narration?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface BillReferenceAdjustment {
  id: string;
  companyId: string;
  partyId: string;
  referenceId: string;
  settlementVoucherId: string;
  settlementVoucherNumber: string;
  settlementVoucherDate: string;
  amount: number;
  createdAt: string;
}

export interface PartySettlementInput {
  partyId: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  mode: SettlementMode;
  totalAmount: number;
  allocations?: Array<{ referenceId: string; amount: number }>;
}
