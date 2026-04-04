import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { readFileSync } from 'fs';
import { join } from 'path';

// Database schema interface for TypeScript support
export interface DatabaseSchema extends DBSchema {
  currencies: {
    id: number;
    key: number;
    value: {
      id?: number;
      code: string;
      name: string;
      symbol: string;
      is_default: boolean;
      created_at: string;
    };
  };
  currency_rates: {
    id: number;
    key: number;
    value: {
      id?: number;
      from_currency_id: number;
      to_currency_id: number;
      rate: number;
      effective_date: string;
      created_at: string;
    };
  };
  vouchers: {
    id: number;
    key: number;
    value: {
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
      created_at: string;
      updated_at: string;
    };
  };
  voucher_items: {
    id: number;
    key: number;
    value: {
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
      created_at: string;
    };
  };
  sales_orders: {
    id: number;
    key: number;
    value: {
      id?: number;
      order_number: string;
      order_date: string;
      party_id?: number;
      party_name: string;
      delivery_date?: string;
      total_amount: number;
      status: string;
      narration?: string;
      created_at: string;
      updated_at: string;
    };
  };
  sales_order_items: {
    id: number;
    key: number;
    value: {
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
      created_at: string;
    };
  };
  stock_items: {
    id: number;
    key: number;
    value: {
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
      created_at: string;
      updated_at: string;
    };
  };
  godowns: {
    id: number;
    key: number;
    value: {
      id?: number;
      name: string;
      address?: string;
      is_active: boolean;
      created_at: string;
    };
  };
  item_categories: {
    id: number;
    key: number;
    value: {
      id?: number;
      name: string;
      parent_id?: number;
      is_active: boolean;
      created_at: string;
    };
  };
  ledgers: {
    id: number;
    key: number;
    value: {
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
      created_at: string;
      updated_at: string;
    };
  };
  batches: {
    id: number;
    key: number;
    value: {
      id?: number;
      item_id?: number;
      batch_number: string;
      manufacturing_date?: string;
      expiry_date?: string;
      initial_quantity: number;
      current_quantity: number;
      cost_rate: number;
      sale_rate: number;
      mrp: number;
      godown_id?: number;
      is_active: boolean;
      created_at: string;
    };
  };
}

let db: IDBPDatabase<DatabaseSchema> | null = null;

export const initializeDatabase = async (): Promise<IDBPDatabase<DatabaseSchema>> => {
  if (db) return db;

  try {
    db = await openDB<DatabaseSchema>('PVEB_GST_Billing', 1, {
      upgrade(db) {
        // Create object stores for all tables
        if (!db.objectStoreNames.contains('currencies')) {
          db.createObjectStore('currencies', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('currency_rates')) {
          db.createObjectStore('currency_rates', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('vouchers')) {
          db.createObjectStore('vouchers', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('voucher_items')) {
          db.createObjectStore('voucher_items', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('sales_orders')) {
          db.createObjectStore('sales_orders', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('sales_order_items')) {
          db.createObjectStore('sales_order_items', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('stock_items')) {
          db.createObjectStore('stock_items', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('godowns')) {
          db.createObjectStore('godowns', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('item_categories')) {
          db.createObjectStore('item_categories', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('ledgers')) {
          db.createObjectStore('ledgers', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('batches')) {
          db.createObjectStore('batches', { keyPath: 'id', autoIncrement: true });
        }

        // Create indexes for performance
        const voucherStore = (db as any).objectStore('vouchers');
        voucherStore.createIndex('voucher_date', 'voucher_date');
        voucherStore.createIndex('voucher_number', 'voucher_number');
        voucherStore.createIndex('party_id', 'party_id');

        const voucherItemsStore = (db as any).objectStore('voucher_items');
        voucherItemsStore.createIndex('voucher_id', 'voucher_id');
        voucherItemsStore.createIndex('item_id', 'item_id');

        const stockItemsStore = (db as any).objectStore('stock_items');
        stockItemsStore.createIndex('item_code', 'item_code');
        stockItemsStore.createIndex('item_name', 'item_name');

        const ledgersStore = (db as any).objectStore('ledgers');
        ledgersStore.createIndex('name', 'name');
      },
    });

    // Initialize default data
    await initializeDefaultData(db);

    return db;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

const initializeDefaultData = async (database: IDBPDatabase<DatabaseSchema>) => {
  // Check if currencies exist
  const currencyCount = await database.count('currencies');
  if (currencyCount === 0) {
    await database.add('currencies', {
      code: 'INR',
      name: 'Indian Rupee',
      symbol: '₹',
      is_default: true,
      created_at: new Date().toISOString(),
    });
  }

  // Check if default godown exists
  const godownCount = await database.count('godowns');
  if (godownCount === 0) {
    await database.add('godowns', {
      name: 'Main Godown',
      address: '',
      is_active: true,
      created_at: new Date().toISOString(),
    });
  }

  // Check if default categories exist
  const categoryCount = await database.count('item_categories');
  if (categoryCount === 0) {
    const categories = [
      { name: 'Sales Items', is_active: true },
      { name: 'Services', is_active: true },
      { name: 'Raw Materials', is_active: true },
      { name: 'Finished Goods', is_active: true },
    ];
    
    for (const category of categories) {
      await database.add('item_categories', {
        ...category,
        created_at: new Date().toISOString(),
      });
    }
  }
};

export const getDatabase = (): IDBPDatabase<DatabaseSchema> => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
};

// Utility functions for common database operations
export const dbHelpers = {
  async getAll<T>(storeName: keyof DatabaseSchema): Promise<T[]> {
    const database = getDatabase();
    return await (database as any).getAll(storeName as any);
  },

  async get<T>(storeName: keyof DatabaseSchema, key: number): Promise<T | undefined> {
    const database = getDatabase();
    return await (database as any).get(storeName as any, key);
  },

  async add<T>(storeName: keyof DatabaseSchema, data: Omit<T, 'id'>): Promise<number> {
    const database = getDatabase();
    return await (database as any).add(storeName as any, data as T);
  },

  async update<T>(storeName: keyof DatabaseSchema, data: T): Promise<number> {
    const database = getDatabase();
    return await (database as any).put(storeName as any, data);
  },

  async delete(storeName: keyof DatabaseSchema, key: number): Promise<void> {
    const database = getDatabase();
    return await (database as any).delete(storeName as any, key);
  },

  async clear(storeName: keyof DatabaseSchema): Promise<void> {
    const database = getDatabase();
    return await (database as any).clear(storeName as any);
  },

  async find<T>(
    storeName: keyof DatabaseSchema,
    predicate: (item: T) => boolean
  ): Promise<T[]> {
    const all = await dbHelpers.getAll<T>(storeName);
    return all.filter(predicate);
  },

  async findOne<T>(
    storeName: keyof DatabaseSchema,
    predicate: (item: T) => boolean
  ): Promise<T | undefined> {
    const all = await dbHelpers.getAll<T>(storeName);
    return all.find(predicate);
  },
};
