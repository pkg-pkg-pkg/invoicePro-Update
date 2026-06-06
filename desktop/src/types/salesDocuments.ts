/** PVE Sales Management — document kinds & unified row model */

export type SalesDocKind =
  | 'quotations'
  | 'proforma'
  | 'sales-orders'
  | 'dispatch'
  | 'tax-invoices'
  | 'collections'
  | 'credit-adjustments'
  | 'recurring';

export type SalesDocumentStatus =
  | 'DRAFT'
  | 'SENT'
  | 'APPROVED'
  | 'PARTIALLY_PAID'
  | 'PAID'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'ACCEPTED'
  | 'DECLINED'
  | 'EXPIRED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'PARTIALLY_DISPATCHED'
  | 'DISPATCHED'
  | 'CLOSED'
  | 'PAYMENT_RECEIVED'
  | 'CONVERTED';

export interface SalesPipelineLineItem {
  id: string;
  itemId?: string | null;
  itemName: string;
  description?: string | null;
  hsnCode?: string | null;
  qty: number;
  unit?: string | null;
  rate: number;
  discountPercent: number;
  gstPercent: number;
  amount: number;
  qtyDispatched?: number;
  qtyPending?: number;
}

export interface SalesPipelineHeader {
  customerGstin?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
  referenceNo?: string | null;
  salesperson?: string | null;
  validUntil?: string | null;
  poReference?: string | null;
  deliveryTerms?: string | null;
  paymentTerms?: string | null;
  placeOfSupply?: string | null;
  expectedDeliveryDate?: string | null;
  customerPoNo?: string | null;
  customerPoDate?: string | null;
  source?: string | null;
  linkedQuotationNo?: string | null;
  deliveryMethod?: string | null;
  freightCharges?: number;
  insurance?: number;
  roundOff?: number;
  termsAndConditions?: string | null;
  customerNotes?: string | null;
  bankDetails?: string | null;
  authorizedSignatory?: string | null;
  specialInstructions?: string | null;
  recurringPaused?: boolean;
}

export interface SalesPipelineDocument {
  id: string;
  kind: SalesDocKind;
  number: string;
  date: string;
  customerId?: string | null;
  customerName: string;
  amount: number;
  status: SalesDocumentStatus;
  dueDate?: string | null;
  notes?: string | null;
  convertedVoucherId?: string | null;
  lines: SalesPipelineLineItem[];
  header: SalesPipelineHeader;
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

export interface SalesDocumentRow {
  id: string;
  kind: SalesDocKind;
  number: string;
  date: string;
  customerId?: string;
  customerName: string;
  amount: number;
  status: SalesDocumentStatus;
  dueDate?: string;
  gstAmount?: number;
  balanceDue?: number;
  source: 'voucher' | 'pipeline' | 'expense';
  voucherId?: string;
  editPath?: string;
}

export interface SalesDocumentFilters {
  search: string;
  fromDate: string;
  toDate: string;
  customerId: string;
  status: SalesDocumentStatus | 'ALL';
}
