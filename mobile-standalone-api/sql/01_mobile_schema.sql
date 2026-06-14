-- MOBILE schema — System 3 (Standalone Mobile Accounting)
-- Run as MOBILE schema user on PVEDATABASE (India South)

CREATE TABLE users (
  user_id         VARCHAR2(36) PRIMARY KEY,
  mobile_no       VARCHAR2(15) UNIQUE NOT NULL,
  name            VARCHAR2(100),
  email           VARCHAR2(100),
  gstin           VARCHAR2(20),
  company_name    VARCHAR2(200),
  financial_year  VARCHAR2(10),
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE account_groups (
  group_id    VARCHAR2(36) PRIMARY KEY,
  user_id     VARCHAR2(36) REFERENCES users(user_id),
  name        VARCHAR2(100),
  type        VARCHAR2(20)
);

CREATE TABLE accounts (
  account_id  VARCHAR2(36) PRIMARY KEY,
  user_id     VARCHAR2(36) REFERENCES users(user_id),
  name        VARCHAR2(200),
  group_id    VARCHAR2(36) REFERENCES account_groups(group_id),
  opening_bal NUMBER(15,2) DEFAULT 0,
  bal_type    VARCHAR2(2)
);

CREATE TABLE customers (
  customer_id VARCHAR2(36) PRIMARY KEY,
  user_id     VARCHAR2(36) REFERENCES users(user_id),
  name        VARCHAR2(200),
  mobile      VARCHAR2(15),
  email       VARCHAR2(100),
  gstin       VARCHAR2(20),
  address     CLOB,
  account_id  VARCHAR2(36) REFERENCES accounts(account_id)
);

CREATE TABLE vendors (
  vendor_id   VARCHAR2(36) PRIMARY KEY,
  user_id     VARCHAR2(36) REFERENCES users(user_id),
  name        VARCHAR2(200),
  mobile      VARCHAR2(15),
  gstin       VARCHAR2(20),
  address     CLOB,
  account_id  VARCHAR2(36) REFERENCES accounts(account_id)
);

CREATE TABLE items (
  item_id     VARCHAR2(36) PRIMARY KEY,
  user_id     VARCHAR2(36) REFERENCES users(user_id),
  name        VARCHAR2(200),
  hsn_code    VARCHAR2(20),
  unit        VARCHAR2(20),
  sale_rate   NUMBER(15,2),
  purch_rate  NUMBER(15,2),
  tax_pct     NUMBER(5,2),
  stock_qty   NUMBER(10,3) DEFAULT 0
);

CREATE TABLE sales_invoices (
  invoice_id    VARCHAR2(36) PRIMARY KEY,
  user_id       VARCHAR2(36) REFERENCES users(user_id),
  invoice_no    VARCHAR2(50),
  invoice_date  DATE,
  customer_id   VARCHAR2(36) REFERENCES customers(customer_id),
  subtotal      NUMBER(15,2),
  cgst          NUMBER(15,2) DEFAULT 0,
  sgst          NUMBER(15,2) DEFAULT 0,
  igst          NUMBER(15,2) DEFAULT 0,
  total         NUMBER(15,2),
  status        VARCHAR2(20),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP
);

CREATE TABLE sales_invoice_items (
  line_id     VARCHAR2(36) PRIMARY KEY,
  invoice_id  VARCHAR2(36) REFERENCES sales_invoices(invoice_id),
  item_id     VARCHAR2(36),
  item_name   VARCHAR2(200),
  hsn_code    VARCHAR2(20),
  qty         NUMBER(10,3),
  rate        NUMBER(15,2),
  amount      NUMBER(15,2),
  tax_pct     NUMBER(5,2),
  cgst_amt    NUMBER(15,2),
  sgst_amt    NUMBER(15,2),
  igst_amt    NUMBER(15,2)
);

CREATE TABLE purchase_invoices (
  purchase_id   VARCHAR2(36) PRIMARY KEY,
  user_id       VARCHAR2(36) REFERENCES users(user_id),
  invoice_no    VARCHAR2(50),
  invoice_date  DATE,
  vendor_id     VARCHAR2(36) REFERENCES vendors(vendor_id),
  total         NUMBER(15,2),
  status        VARCHAR2(20),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE purchase_invoice_items (
  line_id     VARCHAR2(36) PRIMARY KEY,
  purchase_id VARCHAR2(36) REFERENCES purchase_invoices(purchase_id),
  item_id     VARCHAR2(36),
  item_name   VARCHAR2(200),
  qty         NUMBER(10,3),
  rate        NUMBER(15,2),
  amount      NUMBER(15,2),
  tax_pct     NUMBER(5,2)
);

CREATE TABLE vouchers (
  voucher_id    VARCHAR2(36) PRIMARY KEY,
  user_id       VARCHAR2(36) REFERENCES users(user_id),
  voucher_type  VARCHAR2(20),
  voucher_date  DATE,
  narration     VARCHAR2(500),
  ref_no        VARCHAR2(50),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE voucher_entries (
  entry_id    VARCHAR2(36) PRIMARY KEY,
  voucher_id  VARCHAR2(36) REFERENCES vouchers(voucher_id),
  account_id  VARCHAR2(36) REFERENCES accounts(account_id),
  debit       NUMBER(15,2) DEFAULT 0,
  credit      NUMBER(15,2) DEFAULT 0
);

CREATE TABLE child_users (
  child_id        VARCHAR2(36) PRIMARY KEY,
  parent_user_id  VARCHAR2(36) REFERENCES users(user_id),
  mobile_no       VARCHAR2(15) UNIQUE NOT NULL,
  name            VARCHAR2(100),
  status          VARCHAR2(10) DEFAULT 'active',
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE child_subscriptions (
  sub_id          VARCHAR2(36) PRIMARY KEY,
  child_id        VARCHAR2(36) REFERENCES child_users(child_id),
  parent_user_id  VARCHAR2(36) REFERENCES users(user_id),
  paid_from       DATE,
  paid_until      DATE,
  amount          NUMBER(10,2) DEFAULT 699,
  status          VARCHAR2(10)
);

CREATE TABLE child_permissions (
  perm_id         VARCHAR2(36) PRIMARY KEY,
  child_id        VARCHAR2(36) REFERENCES child_users(child_id),
  parent_user_id  VARCHAR2(36) REFERENCES users(user_id),
  module          VARCHAR2(50),
  access_level    VARCHAR2(10)
);

-- Row Level Security: apply per-table policies using CLIENT_IDENTIFIER = parent_user_id
-- See sql/02_mobile_rls.sql for VPD policy scripts

CREATE INDEX idx_sales_inv_user ON sales_invoices(user_id);
CREATE INDEX idx_customers_user ON customers(user_id);
CREATE INDEX idx_vendors_user ON vendors(user_id);
CREATE INDEX idx_items_user ON items(user_id);
CREATE INDEX idx_accounts_user ON accounts(user_id);
