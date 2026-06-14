export type Timestamp = string; // ISO strings per schema

export type LedgerGroupType = 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE';
export type LedgerBalanceType = 'DEBIT' | 'CREDIT';

export interface LedgerGroup {
  id: string;
  name: string;
  code?: string | null;
  type: LedgerGroupType;
  parentGroupId?: string | null;
  isSystem: boolean;
  sortOrder?: number | null;
  isActive?: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GSTDetails {
  gstin?: string;
  pan?: string;
  composition?: boolean | null;
}

export interface ContactDetails {
  phone?: string;
  email?: string;
  address?: string;
}

export interface BankDetails {
  accountNumber?: string | null;
  ifscCode?: string | null;
  bankName?: string | null;
  branchName?: string | null;
  accountType?: 'SAVINGS' | 'CURRENT' | 'CASH' | null;
}

export interface LedgerAccount {
  id: string;
  name: string;
  code?: string | null;
  groupId: string;
  openingBalance: number;
  openingBalanceType: LedgerBalanceType;
  currentBalance: number;
  gstDetails?: GSTDetails | null;
  contactDetails?: ContactDetails | null;
  bankDetails?: BankDetails | null;
  isCashBank: boolean;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface LedgerTransaction {
  id: string;
  ledgerId: string;
  voucherType: string;
  voucherId: string;
  date: Timestamp;
  debit: number;
  credit: number;
  runningBalance: number;
  meta?: Record<string, unknown> | null;
  createdAt: Timestamp;
}

export interface ItemCategory {
  id: string;
  name: string;
  code?: string | null;
  parentId?: string | null;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UnitOfMeasure {
  id: string;
  name: string;
  symbol: string;
  uqc?: string | null;
  precision: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Godown {
  id: string;
  name: string;
  code?: string | null;
  address?: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type InventoryStatus = 'ACTIVE' | 'INACTIVE';

export type InventoryItemType = 'SALES' | 'PURCHASE' | 'BOTH';
export type InventoryTaxClass = 'TAXABLE' | 'NON_TAXABLE' | 'EXEMPT';
export type InventoryCreatedSource = 'USER' | 'IMPORT' | 'SYSTEM';

export interface PricingInfo {
  purchase?: number;
  sale?: number;
  mrp?: number | null;
  wholesale?: number | null;
  distributor?: number | null;
}

export interface InventoryGodownStock {
  godownId: string;
  quantity: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  /** Alternate scan codes (inner box, master carton, manufacturer, etc.) */
  additionalBarcodes?: string[] | null;
  brand?: string | null;
  categoryId?: string | null;
  unitId: string;
  secondaryUnitId?: string | null;
  conversionRatio?: number | null;
  gstRate: number;
  hsnCode?: string | null;
  pricing?: PricingInfo;
  trackBatch?: boolean;
  trackSerial?: boolean;
  trackExpiry?: boolean;
  batchNumber?: string | null;
  expiryDate?: string | null;
  openingStock: number;
  openingValue: number;
  currentStock: number;
  reorderLevel?: number | null;
  godownStocks?: InventoryGodownStock[];
  images?: string[];
  status: InventoryStatus;
  itemType?: InventoryItemType;
  upc?: string | null;
  ean?: string | null;
  isbn?: string | null;
  taxClass?: InventoryTaxClass;
  description?: string | null;
  createdSource?: InventoryCreatedSource;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ItemHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'DUPLICATED'
  | 'STATUS_CHANGED'
  | 'STOCK_ADJUSTED'
  | 'BARCODE_CHANGED';

export type ItemHistoryMeta = {
  oldBarcode?: string | null;
  newBarcode?: string | null;
  oldAdditionalBarcodes?: string[];
  newAdditionalBarcodes?: string[];
  reason?: string | null;
};

export interface ItemHistoryEntry {
  id: string;
  itemId: string;
  action: ItemHistoryAction;
  summary: string;
  userLabel?: string | null;
  meta?: ItemHistoryMeta | null;
  createdAt: Timestamp;
}

export type StockAdjustmentType = 'OPENING' | 'ADJUSTMENT';

export type StockAdjustmentDirection = 'INCREASE' | 'DECREASE';

export type StockAdjustmentReasonType =
  | 'EXCESS_FOUND'
  | 'THEFT'
  | 'DAMAGED'
  | 'LOST'
  | 'SAMPLE_INTERNAL'
  | 'OTHER';

export type PriceListStatus = 'ACTIVE' | 'INACTIVE';

export type PriceListPricingType = 'EXCLUSIVE' | 'INCLUSIVE';

export interface PriceListEntry {
  itemId: string;
  /** Selling price — GST exclusive or inclusive per list pricingType */
  sellingPrice: number;
  /** @deprecated migrated to sellingPrice */
  rate?: number;
  basePrice?: number | null;
  gstRate?: number | null;
  discountPercent?: number | null;
}

export interface PriceList {
  id: string;
  name: string;
  description?: string | null;
  pricingType: PriceListPricingType;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  partyIds?: string[];
  entries: PriceListEntry[];
  status: PriceListStatus;
  lastUsedAt?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface StockAdjustment {
  id: string;
  itemId: string;
  godownId?: string | null;
  type: StockAdjustmentType;
  direction?: StockAdjustmentDirection;
  reasonType?: StockAdjustmentReasonType | null;
  quantity: number;
  ratePerUnit?: number | null;
  value: number;
  /** @deprecated use notes */
  reason?: string | null;
  notes?: string | null;
  voucherId?: string | null;
  date: Timestamp;
  createdAt: Timestamp;
}
