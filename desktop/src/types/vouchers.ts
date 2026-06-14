import type { VoucherEwayBill } from './ewayBill';

export type VoucherType =
  | 'SALES'
  | 'SALES_RETURN'
  | 'PURCHASE'
  | 'PURCHASE_RETURN'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'JOURNAL'
  | 'CONTRA';

export interface VoucherLine {
  ledgerId: string;
  debit: number;
  credit: number;
  itemId?: string;
  quantity?: number;
  godownId?: string;
  // GST Bifurcation Support
  taxType?: 'CGST_SGST' | 'IGST'; // Auto-determined from company/party state
  cgstAmount?: number; // For CGST+SGST supply
  sgstAmount?: number; // For CGST+SGST supply
  igstAmount?: number; // For IGST supply
  cgstLedgerId?: string; // Auto-resolved, no manual selection
  sgstLedgerId?: string; // Auto-resolved, no manual selection
  igstLedgerId?: string; // Auto-resolved, no manual selection
  // Additional Charges
  chargeType?: string; // e.g., 'FREIGHT', 'PACKING', 'TRANSPORT', 'INSURANCE'
  isTaxable?: boolean;
  roundOffAmount?: number; // For final round-off line
}

export interface Voucher {
  id: string;
  type: VoucherType;
  date: string;
  number: string;
  narration?: string;
  lines: VoucherLine[];
  status: 'ACTIVE' | 'CANCELLED';
  createdAt: string;
  createdBy?: string;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  /** GST E-Way Bill details (sales invoices). */
  ewayBill?: VoucherEwayBill;
}
