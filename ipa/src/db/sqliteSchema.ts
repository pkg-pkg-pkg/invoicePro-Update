/** SQLite schema — mirrors Oracle INVOICEPRO + dev aliases (vouchers/parties views). */
export const SQLITE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  user_id TEXT PRIMARY KEY,
  mobile_no TEXT UNIQUE,
  email TEXT,
  name TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS devices (
  device_id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(user_id),
  platform TEXT,
  device_name TEXT,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_log (
  sync_id TEXT PRIMARY KEY,
  device_id TEXT,
  user_id TEXT,
  record_type TEXT,
  record_id TEXT,
  action TEXT,
  synced_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conflict_log (
  conflict_id TEXT PRIMARY KEY,
  record_type TEXT,
  record_id TEXT,
  winner TEXT,
  resolved_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  invoice_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  invoice_no TEXT,
  invoice_date TEXT,
  customer_id TEXT,
  total_amount REAL,
  tax_amount REAL,
  status TEXT,
  updated_at TEXT,
  source TEXT,
  extra_data TEXT
);

CREATE TABLE IF NOT EXISTS invoice_items (
  item_line_id TEXT PRIMARY KEY,
  invoice_id TEXT REFERENCES invoices(invoice_id),
  item_id TEXT,
  item_name TEXT,
  qty REAL,
  rate REAL,
  amount REAL,
  tax_pct REAL
);

CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,
  mobile TEXT,
  email TEXT,
  gstin TEXT,
  address TEXT,
  updated_at TEXT,
  source TEXT,
  extra_data TEXT
);

CREATE TABLE IF NOT EXISTS items (
  item_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT,
  unit TEXT,
  sale_rate REAL,
  tax_pct REAL,
  hsn_code TEXT,
  updated_at TEXT,
  source TEXT,
  extra_data TEXT
);

CREATE TABLE IF NOT EXISTS receipts (
  receipt_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  receipt_date TEXT,
  party_id TEXT,
  amount REAL,
  mode TEXT,
  updated_at TEXT,
  source TEXT,
  extra_data TEXT
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  entry_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  party_id TEXT,
  entry_date TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  narration TEXT,
  ref_id TEXT,
  updated_at TEXT,
  source TEXT,
  extra_data TEXT
);

-- Dev-friendly JSON stores (desktop delta payloads)
CREATE TABLE IF NOT EXISTS vouchers (
  voucher_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  record_type TEXT,
  payload TEXT NOT NULL,
  updated_at TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS parties (
  party_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  record_type TEXT,
  payload TEXT NOT NULL,
  updated_at TEXT,
  source TEXT
);

CREATE TABLE IF NOT EXISTS child_users (
  child_id TEXT PRIMARY KEY,
  parent_user_id TEXT REFERENCES users(user_id),
  mobile_no TEXT UNIQUE NOT NULL,
  name TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS child_subscriptions (
  sub_id TEXT PRIMARY KEY,
  child_id TEXT REFERENCES child_users(child_id),
  parent_user_id TEXT REFERENCES users(user_id),
  paid_from TEXT,
  paid_until TEXT,
  amount REAL DEFAULT 699,
  status TEXT
);

CREATE TABLE IF NOT EXISTS child_pending (
  pending_id TEXT PRIMARY KEY,
  child_id TEXT REFERENCES child_users(child_id),
  parent_user_id TEXT REFERENCES users(user_id),
  record_type TEXT,
  action TEXT,
  record_data TEXT,
  submitted_at TEXT DEFAULT (datetime('now')),
  status TEXT DEFAULT 'pending',
  reviewed_at TEXT,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_updated ON invoices(updated_at);
CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
CREATE INDEX IF NOT EXISTS idx_sync_log_user ON sync_log(user_id, synced_at);
CREATE INDEX IF NOT EXISTS idx_child_pending_parent ON child_pending(parent_user_id, status);
`;
