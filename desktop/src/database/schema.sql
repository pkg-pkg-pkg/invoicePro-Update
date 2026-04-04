-- Sales Voucher Database Schema for Voucher-Style GST Billing
-- Platform: Electron + SQLite

-- Currencies Table for Multi-Currency Support
CREATE TABLE IF NOT EXISTS currencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,  -- USD, EUR, etc.
  name TEXT NOT NULL,        -- US Dollar, Euro, etc.
  symbol TEXT NOT NULL,       -- $, €, etc.
  is_default BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Currency Rates Table
CREATE TABLE IF NOT EXISTS currency_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_currency_id INTEGER REFERENCES currencies(id),
  to_currency_id INTEGER REFERENCES currencies(id),
  rate REAL NOT NULL,        -- 1 FROM = rate TO
  effective_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_currency_id, to_currency_id, effective_date)
);

-- Enhanced Vouchers Table
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_type TEXT DEFAULT 'GST_SALES',
  voucher_number TEXT UNIQUE NOT NULL,
  voucher_date DATE NOT NULL,
  party_id INTEGER, -- REFERENCES ledgers(id)
  party_name TEXT,
  party_gstin TEXT,
  party_address TEXT,
  party_city TEXT,
  party_state TEXT,
  party_country TEXT DEFAULT 'India',
  gst_registration_type TEXT CHECK(gst_registration_type IN ('Registered', 'Unregistered', 'Consumer', 'Composition')),
  place_of_supply TEXT,
  currency_id INTEGER REFERENCES currencies(id) DEFAULT (SELECT id FROM currencies WHERE is_default = 1),
  exchange_rate REAL DEFAULT 1.0,
  sub_total REAL DEFAULT 0,
  total_cgst REAL DEFAULT 0,
  total_sgst REAL DEFAULT 0,
  total_igst REAL DEFAULT 0,
  total_discount REAL DEFAULT 0,
  freight_amount REAL DEFAULT 0,
  freight_taxable BOOLEAN DEFAULT 0,
  freight_gst_percent REAL DEFAULT 0,
  round_off REAL DEFAULT 0,
  grand_total REAL DEFAULT 0,
  narration TEXT,
  terms_and_conditions TEXT,
  additional_notes TEXT,
  status TEXT DEFAULT 'Saved' CHECK(status IN ('Saved', 'Cancelled', 'Draft')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Batches Table for Stock Management
CREATE TABLE IF NOT EXISTS batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER REFERENCES stock_items(id),
  batch_number TEXT NOT NULL,
  manufacturing_date DATE,
  expiry_date DATE,
  initial_quantity REAL DEFAULT 0,
  current_quantity REAL DEFAULT 0,
  cost_rate REAL DEFAULT 0,
  sale_rate REAL DEFAULT 0,
  mrp REAL DEFAULT 0,
  godown_id INTEGER REFERENCES godowns(id),
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced Voucher Items Table
CREATE TABLE IF NOT EXISTS voucher_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER REFERENCES vouchers(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES stock_items(id),
  godown_id INTEGER REFERENCES godowns(id),
  batch_id INTEGER REFERENCES batches(id),
  order_item_id INTEGER, -- REFERENCES sales_order_items(id)
  sr_no INTEGER NOT NULL,
  item_name TEXT NOT NULL,
  item_code TEXT,
  hsn_code TEXT,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  rate_excl_tax REAL NOT NULL,
  rate_incl_tax REAL NOT NULL,
  disc_percent REAL DEFAULT 0,
  taxable_amount REAL NOT NULL,
  gst_rate REAL DEFAULT 0,
  cgst_amount REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0,
  igst_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sales Orders Table
CREATE TABLE IF NOT EXISTS sales_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  order_date DATE NOT NULL,
  party_id INTEGER REFERENCES ledgers(id),
  party_name TEXT NOT NULL,
  delivery_date DATE,
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'Partially Fulfilled', 'Closed', 'Cancelled')),
  narration TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sales Order Items Table
CREATE TABLE IF NOT EXISTS sales_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER REFERENCES sales_orders(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES stock_items(id),
  quantity REAL NOT NULL,
  fulfilled_quantity REAL DEFAULT 0,
  pending_quantity REAL GENERATED ALWAYS AS (quantity - fulfilled_quantity) STORED,
  rate_excl_tax REAL NOT NULL,
  rate_incl_tax REAL NOT NULL,
  discount_percent REAL DEFAULT 0,
  taxable_amount REAL NOT NULL,
  gst_rate REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Stock Items Table (Enhanced)
CREATE TABLE IF NOT EXISTS stock_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_code TEXT UNIQUE NOT NULL,
  item_name TEXT NOT NULL,
  hsn_code TEXT,
  gst_rate REAL DEFAULT 0,
  purchase_rate REAL DEFAULT 0,
  sale_rate REAL DEFAULT 0,
  mrp REAL DEFAULT 0,
  unit TEXT NOT NULL,
  category_id INTEGER, -- REFERENCES item_categories(id)
  godown_id INTEGER REFERENCES godowns(id),
  current_stock REAL DEFAULT 0,
  min_stock_level REAL DEFAULT 0,
  is_taxable BOOLEAN DEFAULT 1,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Godowns Table
CREATE TABLE IF NOT EXISTS godowns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  address TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Item Categories Table
CREATE TABLE IF NOT EXISTS item_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  parent_id INTEGER REFERENCES item_categories(id),
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Ledger Accounts Table (Enhanced for GST)
CREATE TABLE IF NOT EXISTS ledgers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  alias TEXT,
  group_name TEXT,
  opening_balance REAL DEFAULT 0,
  balance_type TEXT CHECK(balance_type IN ('Dr', 'Cr')) DEFAULT 'Dr',
  gst_registration_type TEXT CHECK(gst_registration_type IN ('Registered', 'Unregistered', 'Consumer', 'Composition')),
  gstin TEXT,
  pan TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  country TEXT DEFAULT 'India',
  phone TEXT,
  email TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers(voucher_date);
CREATE INDEX IF NOT EXISTS idx_vouchers_party ON vouchers(party_id);
CREATE INDEX IF NOT EXISTS idx_voucher_items_voucher ON voucher_items(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_items_item ON voucher_items(item_id);
CREATE INDEX IF NOT EXISTS idx_stock_items_code ON stock_items(item_code);
CREATE INDEX IF NOT EXISTS idx_stock_items_name ON stock_items(item_name);
CREATE INDEX IF NOT EXISTS idx_batches_item ON batches(item_id);
CREATE INDEX IF NOT EXISTS idx_ledgers_name ON ledgers(name);
CREATE INDEX IF NOT EXISTS idx_sales_orders_party ON sales_orders(party_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_items_order ON sales_order_items(order_id);

-- Insert Default Currency (INR)
INSERT OR IGNORE INTO currencies (code, name, symbol, is_default) 
VALUES ('INR', 'Indian Rupee', '₹', 1);

-- Insert Default Godown
INSERT OR IGNORE INTO godowns (name) 
VALUES ('Main Godown');

-- Insert Default Item Categories
INSERT OR IGNORE INTO item_categories (name) 
VALUES 
  ('Sales Items'),
  ('Services'),
  ('Raw Materials'),
  ('Finished Goods');
