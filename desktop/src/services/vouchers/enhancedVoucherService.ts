import { getDatabase, dbHelpers } from '../database/databaseService';

// Types for enhanced voucher system
export interface SalesVoucher {
  id?: number;
  voucher_type: string;
  voucher_number: string;
  voucher_date: string;
  party_id?: number;
  party_name?: string;
  party_gstin?: string;
  party_address?: string;
  party_city?: string;
  party_state?: string;
  party_country?: string;
  gst_registration_type?: string;
  place_of_supply?: string;
  currency_id?: number;
  exchange_rate: number;
  sub_total: number;
  total_cgst: number;
  total_sgst: number;
  total_igst: number;
  total_discount: number;
  freight_amount: number;
  freight_taxable: boolean;
  freight_gst_percent: number;
  round_off: number;
  grand_total: number;
  narration?: string;
  terms_and_conditions?: string;
  additional_notes?: string;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface VoucherItem {
  id?: number;
  voucher_id?: number;
  item_id?: number;
  godown_id?: number;
  batch_id?: number;
  order_item_id?: number;
  sr_no: number;
  item_name: string;
  item_code?: string;
  hsn_code?: string;
  quantity: number;
  unit: string;
  rate_excl_tax: number;
  rate_incl_tax: number;
  disc_percent: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_amount: number;
  created_at?: string;
}

export interface CreateVoucherInput {
  voucher: Omit<SalesVoucher, 'id' | 'created_at' | 'updated_at'>;
  items: Omit<VoucherItem, 'id' | 'voucher_id' | 'created_at'>[];
}

export interface StockItem {
  id?: number;
  item_code: string;
  item_name: string;
  hsn_code?: string;
  gst_rate: number;
  purchase_rate: number;
  sale_rate: number;
  mrp: number;
  unit: string;
  category_id?: number;
  godown_id?: number;
  current_stock: number;
  min_stock_level: number;
  is_taxable: boolean;
  is_active: boolean;
}

export interface Ledger {
  id?: number;
  name: string;
  alias?: string;
  group_name?: string;
  opening_balance: number;
  balance_type: string;
  gst_registration_type?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  phone?: string;
  email?: string;
  is_active: boolean;
}

export interface Godown {
  id?: number;
  name: string;
  address?: string;
  is_active: boolean;
}

export interface SalesOrder {
  id?: number;
  order_number: string;
  order_date: string;
  party_id?: number;
  party_name: string;
  delivery_date?: string;
  total_amount: number;
  status: string;
  narration?: string;
}

export interface SalesOrderItem {
  id?: number;
  order_id?: number;
  item_id?: number;
  quantity: number;
  fulfilled_quantity: number;
  pending_quantity: number;
  rate_excl_tax: number;
  rate_incl_tax: number;
  discount_percent: number;
  taxable_amount: number;
  gst_rate: number;
  total_amount: number;
}

// GST Calculation utilities
export const calculateGST = (
  taxableAmount: number,
  gstRate: number,
  isInterstate: boolean
) => {
  const totalGST = (taxableAmount * gstRate) / 100;
  
  if (isInterstate) {
    return {
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: totalGST,
      totalGST,
    };
  } else {
    const halfGST = totalGST / 2;
    return {
      cgstAmount: halfGST,
      sgstAmount: halfGST,
      igstAmount: 0,
      totalGST,
    };
  }
};

export const calculateTaxableFromInclusive = (
  inclusiveAmount: number,
  gstRate: number
) => {
  return inclusiveAmount / (1 + gstRate / 100);
};

export const calculateInclusiveFromTaxable = (
  taxableAmount: number,
  gstRate: number
) => {
  return taxableAmount * (1 + gstRate / 100);
};

// Voucher number generation
export const generateVoucherNumber = async (): Promise<string> => {
  const database = getDatabase();
  const currentYear = new Date().getFullYear();
  const nextYear = currentYear + 1;
  const yearSuffix = `${currentYear.toString().slice(-2)}-${nextYear.toString().slice(-2)}`;
  
  // Get last voucher number for this year
  const vouchers = await dbHelpers.getAll('vouchers');
  const currentYearVouchers = vouchers.filter((v: any) => 
    v.voucher_number && v.voucher_number.includes(yearSuffix)
  );
  
  let sequence = 1;
  if (currentYearVouchers.length > 0) {
    const lastVoucher = currentYearVouchers
      .map((v: any) => v.voucher_number)
      .filter(Boolean)
      .sort()
      .pop();
    
    if (lastVoucher) {
      const match = lastVoucher.match(/\/(\d{4})$/);
      if (match) {
        sequence = parseInt(match[1]) + 1;
      }
    }
  }
  
  return `PVE/S/${yearSuffix}/${sequence.toString().padStart(4, '0')}`;
};

// Enhanced voucher service
export const enhancedVoucherService = {
  // Voucher operations
  async createVoucher(input: CreateVoucherInput): Promise<SalesVoucher> {
    const database = getDatabase();
    
    // Generate voucher number if not provided
    if (!input.voucher.voucher_number) {
      input.voucher.voucher_number = await generateVoucherNumber();
    }
    
    // Set timestamps
    const now = new Date().toISOString();
    const voucherWithTimestamps = {
      ...input.voucher,
      created_at: now,
      updated_at: now,
    } as SalesVoucher;
    
    // Calculate totals
    const totals = this.calculateVoucherTotals(input.items);
    Object.assign(voucherWithTimestamps, totals);
    
    // Create voucher
    const voucherId = await dbHelpers.add('vouchers', voucherWithTimestamps);
    
    // Create voucher items
    for (let i = 0; i < input.items.length; i++) {
      const item = {
        ...input.items[i],
        voucher_id: voucherId,
        sr_no: i + 1,
      } as VoucherItem;
      await dbHelpers.add('voucher_items', item);
    }
    
    // Update sales order fulfillment if applicable
    await this.updateSalesOrderFulfillment(input.items);
    
    // Update stock
    await this.updateStockLevels(input.items);
    
    // Return complete voucher
    const createdVoucher = await dbHelpers.get<SalesVoucher>('vouchers', voucherId);
    return createdVoucher!;
  },

  async getVoucher(id: number): Promise<SalesVoucher | null> {
    return await dbHelpers.get('vouchers', id) || null;
  },

  async getVoucherItems(voucherId: number): Promise<VoucherItem[]> {
    return await dbHelpers.find<VoucherItem>('voucher_items', (item: VoucherItem) => item.voucher_id === voucherId);
  },

  async getAllVouchers(): Promise<SalesVoucher[]> {
    return await dbHelpers.getAll<SalesVoucher>('vouchers');
  },

  async deleteVoucher(id: number): Promise<void> {
    const database = getDatabase();
    
    // Get voucher items to restore stock
    const items = await this.getVoucherItems(id);
    
    // Restore stock levels
    await this.restoreStockLevels(items);
    
    // Delete voucher items first (foreign key constraint)
    const voucherItems = await dbHelpers.find<VoucherItem>('voucher_items', (item: VoucherItem) => item.voucher_id === id);
    for (const item of voucherItems) {
      if (item.id) {
        await dbHelpers.delete('voucher_items', item.id);
      }
    }
    
    // Delete voucher
    await dbHelpers.delete('vouchers', id);
  },

  calculateVoucherTotals(items: VoucherItem[]) {
    let subTotal = 0;
    let totalCGST = 0;
    let totalSGST = 0;
    let totalIGST = 0;
    let totalDiscount = 0;

    for (const item of items) {
      subTotal += item.taxable_amount;
      totalCGST += item.cgst_amount;
      totalSGST += item.sgst_amount;
      totalIGST += item.igst_amount;
      
      // Calculate discount amount
      const discountAmount = (item.rate_incl_tax * item.quantity * item.disc_percent) / 100;
      totalDiscount += discountAmount;
    }

    const grandTotal = subTotal + totalCGST + totalSGST + totalIGST - totalDiscount;
    const roundOff = Math.round(grandTotal) - grandTotal;

    return {
      sub_total: subTotal,
      total_cgst: totalCGST,
      total_sgst: totalSGST,
      total_igst: totalIGST,
      total_discount: totalDiscount,
      grand_total: grandTotal + roundOff,
      round_off: roundOff,
    };
  },

  async updateSalesOrderFulfillment(items: VoucherItem[]): Promise<void> {
    for (const item of items) {
      if (item.order_item_id) {
        const orderItem = await dbHelpers.get('sales_order_items', item.order_item_id);
        if (orderItem) {
          const newFulfilled = (orderItem as any).fulfilled_quantity + item.quantity;
          const newStatus = newFulfilled >= (orderItem as any).quantity ? 'Closed' : 'Partially Fulfilled';
          
          await dbHelpers.update('sales_order_items', {
            ...orderItem,
            fulfilled_quantity: newFulfilled,
          });

          // Update order status if needed
          const orderItems = await dbHelpers.find('sales_order_items', (oi: any) => oi.order_id === (orderItem as any).order_id);
          const allFulfilled = orderItems.every((oi: any) => oi.fulfilled_quantity >= oi.quantity);
          
          if (allFulfilled) {
            const order = await dbHelpers.get('sales_orders', (orderItem as any).order_id);
            if (order) {
              await dbHelpers.update('sales_orders', {
                ...order,
                status: 'Closed',
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }
  },

  async updateStockLevels(items: VoucherItem[]): Promise<void> {
    for (const item of items) {
      if (item.item_id) {
        const stockItem = await dbHelpers.get('stock_items', item.item_id);
        if (stockItem) {
          const newStock = (stockItem as any).current_stock - item.quantity;
          await dbHelpers.update('stock_items', {
            ...stockItem,
            current_stock: newStock,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
  },

  async restoreStockLevels(items: VoucherItem[]): Promise<void> {
    for (const item of items) {
      if (item.item_id) {
        const stockItem = await dbHelpers.get('stock_items', item.item_id);
        if (stockItem) {
          const newStock = (stockItem as any).current_stock + item.quantity;
          await dbHelpers.update('stock_items', {
            ...stockItem,
            current_stock: newStock,
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
  },

  // Master data operations
  async getStockItems(): Promise<StockItem[]> {
    return await dbHelpers.find<StockItem>('stock_items', (item: StockItem) => item.is_active);
  },

  async getStockItemsBySearch(query: string): Promise<StockItem[]> {
    const allItems = await this.getStockItems();
    const lowerQuery = query.toLowerCase();
    
    return allItems.filter(item => 
      item.item_name.toLowerCase().includes(lowerQuery) ||
      item.item_code?.toLowerCase().includes(lowerQuery) ||
      item.hsn_code?.toLowerCase().includes(lowerQuery)
    );
  },

  async getLedgers(): Promise<Ledger[]> {
    return await dbHelpers.find<Ledger>('ledgers', (ledger: Ledger) => ledger.is_active);
  },

  async getCustomerLedgers(): Promise<Ledger[]> {
    return await dbHelpers.find('ledgers', (ledger: any) => 
      ledger.is_active && ledger.group_name?.toLowerCase().includes('sundry debtors')
    );
  },

  async getGodowns(): Promise<Godown[]> {
    return await dbHelpers.find('godowns', (godown: any) => godown.is_active);
  },

  async getSalesOrders(partyId?: number): Promise<SalesOrder[]> {
    const orders = await dbHelpers.find('sales_orders', (order: any) => 
      order.status !== 'Cancelled' && order.status !== 'Closed'
    );
    
    if (partyId) {
      return orders.filter((order: any) => order.party_id === partyId);
    }
    
    return orders;
  },

  async getSalesOrderItems(orderId: number): Promise<SalesOrderItem[]> {
    return await dbHelpers.find('sales_order_items', (item: any) => 
      item.order_id === orderId && item.pending_quantity > 0
    );
  },
};
