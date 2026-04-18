// Common types shared across desktop, mobile, and backend

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SALESPERSON = 'SALESPERSON',
  ACCOUNTANT = 'ACCOUNTANT'
}

export interface Company {
  id: string;
  name: string;
  gstin?: string;
  pan?: string;
  address: Address;
  contact: Contact;
  bankDetails?: BankDetails;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
}

export interface Contact {
  phone: string;
  email?: string;
  website?: string;
}

export interface BankDetails {
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  accountHolderName: string;
}

// GST Types
export enum GSTRate {
  ZERO = 0,
  ZERO_POINT_TWENTY_FIVE = 0.25,
  THREE = 3,
  FIVE = 5,
  TWELVE = 12,
  EIGHTEEN = 18,
  TWENTY_EIGHT = 28
}

export enum TransactionType {
  INTRA_STATE = 'INTRA_STATE', // CGST + SGST
  INTER_STATE = 'INTER_STATE'  // IGST
}

export interface HSNCode {
  code: string;
  description: string;
  gstRate: GSTRate;
  isActive: boolean;
}

export interface SACCode {
  code: string;
  description: string;
  gstRate: GSTRate;
  isActive: boolean;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  code: string;
  barcode?: string;
  categoryId?: string;
  category?: Category;
  hsnCode?: string;
  sacCode?: string;
  unit: string;
  uqc?: string; // Unit Quantity Code
  purchasePrice: number;
  salePrice: number;
  mrp?: number;
  wholesalePrice?: number;
  distributorPrice?: number;
  openingStock: number;
  currentStock: number;
  lowStockAlert: number;
  trackBatch: boolean;
  trackSerial: boolean;
  trackExpiry: boolean;
  images?: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  parentId?: string;
  parent?: Category;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockMovement {
  id: string;
  productId: string;
  product?: Product;
  type: StockMovementType;
  quantity: number;
  rate: number;
  batchNumber?: string;
  serialNumber?: string;
  expiryDate?: Date;
  manufacturingDate?: Date;
  referenceId?: string; // Invoice ID, Purchase ID, etc.
  referenceType?: string;
  notes?: string;
  createdAt: Date;
  createdBy: string;
}

export enum StockMovementType {
  OPENING = 'OPENING',
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
  TRANSFER = 'TRANSFER'
}

// Party Types
export interface Customer {
  id: string;
  name: string;
  code?: string;
  gstin?: string;
  pan?: string;
  group?: CustomerGroup;
  creditLimit: number;
  creditDays: number;
  billingAddress: Address;
  shippingAddresses?: Address[];
  contact: Contact;
  photo?: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum CustomerGroup {
  RETAIL = 'RETAIL',
  WHOLESALE = 'WHOLESALE',
  DISTRIBUTOR = 'DISTRIBUTOR',
  VIP = 'VIP'
}

export interface Supplier {
  id: string;
  name: string;
  code?: string;
  gstin?: string;
  pan?: string;
  address: Address;
  contact: Contact;
  creditDays: number;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Invoice Types
export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  date: Date;
  partyId: string;
  partyType: PartyType;
  party?: Customer | Supplier;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountType: DiscountType;
  additionalCharges: AdditionalCharge[];
  roundOff: number;
  totalAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
  paymentStatus: PaymentStatus;
  paymentMode?: PaymentMode[];
  notes?: string;
  terms?: string;
  ewayBillNumber?: string;
  isCancelled: boolean;
  cancelledAt?: Date;
  cancelledBy?: string;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
}

export enum InvoiceType {
  SALES_INVOICE = 'SALES_INVOICE',
  SALES_RETURN = 'SALES_RETURN',
  PURCHASE_INVOICE = 'PURCHASE_INVOICE',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  CREDIT_NOTE = 'CREDIT_NOTE',
  DEBIT_NOTE = 'DEBIT_NOTE',
  PROFORMA = 'PROFORMA',
  QUOTATION = 'QUOTATION',
  DELIVERY_CHALLAN = 'DELIVERY_CHALLAN',
  PURCHASE_ORDER = 'PURCHASE_ORDER',
  SALES_ORDER = 'SALES_ORDER'
}

export enum PartyType {
  CUSTOMER = 'CUSTOMER',
  SUPPLIER = 'SUPPLIER'
}

export interface InvoiceItem {
  id: string;
  productId: string;
  product?: Product;
  name: string;
  hsnCode?: string;
  sacCode?: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  discountType: DiscountType;
  taxableAmount: number;
  gstRate: GSTRate;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
  batchNumber?: string;
  serialNumber?: string;
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED'
}

export interface AdditionalCharge {
  name: string;
  amount: number;
  isTaxable: boolean;
  gstRate?: GSTRate;
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PARTIAL = 'PARTIAL',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE'
}

export enum PaymentMode {
  CASH = 'CASH',
  CARD = 'CARD',
  UPI = 'UPI',
  CHEQUE = 'CHEQUE',
  NEFT = 'NEFT',
  RTGS = 'RTGS',
  IMPS = 'IMPS',
  BANK_TRANSFER = 'BANK_TRANSFER'
}

// Payment Types
export interface Payment {
  id: string;
  type: PaymentType;
  partyId: string;
  partyType: PartyType;
  party?: Customer | Supplier;
  amount: number;
  paymentMode: PaymentMode;
  referenceNumber?: string;
  chequeNumber?: string;
  chequeDate?: Date;
  chequeDrawnOnBank?: string;
  bankId?: string;
  bank?: BankAccount;
  invoiceId?: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    type: string;
    grandTotal: number;
  };
  notes?: string;
  date: Date;
  createdAt: Date;
  createdBy: string;
}

export enum PaymentType {
  RECEIPT = 'RECEIPT', // Customer payment
  PAYMENT = 'PAYMENT'  // Supplier payment
}

export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  accountType: BankAccountType;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum BankAccountType {
  SAVINGS = 'SAVINGS',
  CURRENT = 'CURRENT',
  CASH = 'CASH'
}

// Sync Types
export interface SyncStatus {
  lastSyncAt?: Date;
  isSyncing: boolean;
  pendingChanges: number;
  error?: string;
}

export interface SyncData {
  entity: string;
  action: SyncAction;
  data: any;
  timestamp: Date;
  deviceId: string;
}

export enum SyncAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE'
}

// Report Types
export interface ReportFilter {
  fromDate?: Date;
  toDate?: Date;
  partyId?: string;
  productId?: string;
  categoryId?: string;
  paymentMode?: PaymentMode;
  [key: string]: any;
}

// Dashboard Types
export interface DashboardSummary {
  totalSales: number;
  totalPurchase: number;
  totalExpenses: number;
  cashInHand: number;
  bankBalance: number;
  profitLoss: number;
  totalOutstanding: number;
  totalPayable: number;
  overdueAmount: number;
  overduePayable: number;
}

export interface SalesAnalytics {
  totalSales: number;
  numberOfBills: number;
  averageBillValue: number;
  salesByPaymentMode: Record<PaymentMode, number>;
  salesByCustomerType: Record<CustomerGroup, number>;
  topProducts: Array<{ product: Product; quantity: number; value: number }>;
  trend: Array<{ date: Date; value: number }>;
}

