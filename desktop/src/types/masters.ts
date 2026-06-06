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

export interface ItemHistoryEntry {
  id: string;
  itemId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED' | 'DUPLICATED' | 'STATUS_CHANGED' | 'STOCK_ADJUSTED';
  summary: string;
  userLabel?: string | null;
  createdAt: Timestamp;
}

export type StockAdjustmentType = 'OPENING' | 'ADJUSTMENT';

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
  quantity: number;
  value: number;
  reason?: string | null;
  date: Timestamp;
  createdAt: Timestamp;
}
