// Party Master - Unified Customer/Supplier concept
export type PartyType = 'BUYER' | 'SUPPLIER' | 'BOTH';

export interface Party {
  id: string;
  name: string;
  mobile: string;
  gstin?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  partyType: PartyType;
  
  // Metadata
  createdAt?: string;
  updatedAt?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  
  // Auto-managed (backend only)
  ledgerId?: string;  // Auto-created ledger ID
  ledgerGroup?: string; // Auto-assigned: Sundry Debtors or Sundry Creditors
  
  // Contact info
  email?: string;
  whatsapp?: string;
  
  // Financial
  openingBalance?: number;
  currentBalance?: number;
}

export interface PartyInput {
  name: string;
  mobile: string;
  gstin?: string;
  address?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  partyType: PartyType;
  email?: string;
  whatsapp?: string;
  openingBalance?: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface PartyFilters {
  partyType?: PartyType | PartyType[];
  status?: 'ACTIVE' | 'INACTIVE';
  search?: string;
}
