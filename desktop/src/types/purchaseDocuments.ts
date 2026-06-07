import type { SalesDocumentStatus, SalesPipelineLineItem } from './salesDocuments';

export type PurchaseDocKind =
  | 'purchase-orders'
  | 'purchase-bills'
  | 'vendor-payments'
  | 'debit-notes'
  | 'expenses'
  | 'recurring-bills';

export interface PurchaseDocumentRow {
  id: string;
  kind: PurchaseDocKind;
  number: string;
  date: string;
  vendorId?: string;
  vendorName: string;
  amount: number;
  status: SalesDocumentStatus;
  dueDate?: string;
  gstAmount?: number;
  balanceDue?: number;
  source: 'voucher' | 'pipeline' | 'expense';
  editPath?: string;
}

export interface PurchaseDocumentFilters {
  search: string;
  fromDate: string;
  toDate: string;
  vendorId: string;
  status: SalesDocumentStatus | 'ALL';
}

export type PurchaseNavItem = {
  kind: PurchaseDocKind;
  label: string;
  tabLabel: string;
  description: string;
  icon:
    | 'ShoppingCart'
    | 'Receipt'
    | 'Payments'
    | 'SwapHoriz'
    | 'Expense'
    | 'Autorenew';
  createLabel: string;
  createPath?: string;
  supportsPipeline: boolean;
};

export interface PurchasePipelineHeader {
  vendorGstin?: string | null;
  billingAddress?: string | null;
  placeOfSupply?: string | null;
  paymentTerms?: string | null;
  freightCharges?: number;
  roundOff?: number;
  termsAndConditions?: string | null;
  vendorNotes?: string | null;
  recurringPaused?: boolean;
}

export interface PurchasePipelineDocument {
  id: string;
  kind: PurchaseDocKind;
  number: string;
  date: string;
  vendorId?: string | null;
  vendorName: string;
  amount: number;
  status: SalesDocumentStatus;
  dueDate?: string | null;
  notes?: string | null;
  lines: SalesPipelineLineItem[];
  header: PurchasePipelineHeader;
  subtotal?: number;
  totalDiscount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  grandTotal?: number;
  amountInWords?: string | null;
  createdAt: string;
  updatedAt: string;
}
