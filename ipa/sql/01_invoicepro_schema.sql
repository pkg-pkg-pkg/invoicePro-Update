-- INVOICEPRO schema — System 2 (Invoice Pro Desktop + Mobile Sync)
-- Run as INVOICEPRO schema user on PVEDATABASE (India South)

-- Users / Devices
CREATE TABLE users (
  user_id       VARCHAR2(36) PRIMARY KEY,
  mobile_no     VARCHAR2(15) UNIQUE,
  email         VARCHAR2(100),
  name          VARCHAR2(100),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE devices (
  device_id     VARCHAR2(36) PRIMARY KEY,
  user_id       VARCHAR2(36) REFERENCES users(user_id),
  platform      VARCHAR2(10),
  device_name   VARCHAR2(100),
  last_seen_at  TIMESTAMP
);

-- Sync tracking
CREATE TABLE sync_log (
  sync_id       VARCHAR2(36) PRIMARY KEY,
  device_id     VARCHAR2(36),
  user_id       VARCHAR2(36),
  record_type   VARCHAR2(50),
  record_id     VARCHAR2(36),
  action        VARCHAR2(10),
  synced_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conflict_log (
  conflict_id   VARCHAR2(36) PRIMARY KEY,
  record_type   VARCHAR2(50),
  record_id     VARCHAR2(36),
  winner        VARCHAR2(10),
  resolved_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Core synced data
CREATE TABLE invoices (
  invoice_id    VARCHAR2(36) PRIMARY KEY,
  user_id       VARCHAR2(36) REFERENCES users(user_id),
  invoice_no    VARCHAR2(50),
  invoice_date  DATE,
  customer_id   VARCHAR2(36),
  total_amount  NUMBER(15,2),
  tax_amount    NUMBER(15,2),
  status        VARCHAR2(20),
  updated_at    TIMESTAMP,
  source        VARCHAR2(10)
);

CREATE TABLE invoice_items (
  item_line_id  VARCHAR2(36) PRIMARY KEY,
  invoice_id    VARCHAR2(36) REFERENCES invoices(invoice_id),
  item_id       VARCHAR2(36),
  item_name     VARCHAR2(200),
  qty           NUMBER(10,3),
  rate          NUMBER(15,2),
  amount        NUMBER(15,2),
  tax_pct       NUMBER(5,2)
);

CREATE TABLE customers (
  customer_id   VARCHAR2(36) PRIMARY KEY,
  user_id       VARCHAR2(36) REFERENCES users(user_id),
  name          VARCHAR2(200),
  mobile        VARCHAR2(15),
  email         VARCHAR2(100),
  gstin         VARCHAR2(20),
  address       CLOB,
  updated_at    TIMESTAMP
);

CREATE TABLE items (
  item_id       VARCHAR2(36) PRIMARY KEY,
  user_id       VARCHAR2(36) REFERENCES users(user_id),
  name          VARCHAR2(200),
  unit          VARCHAR2(20),
  sale_rate     NUMBER(15,2),
  tax_pct       NUMBER(5,2),
  hsn_code      VARCHAR2(20),
  updated_at    TIMESTAMP
);

CREATE TABLE receipts (
  receipt_id    VARCHAR2(36) PRIMARY KEY,
  user_id       VARCHAR2(36) REFERENCES users(user_id),
  receipt_date  DATE,
  party_id      VARCHAR2(36),
  amount        NUMBER(15,2),
  mode          VARCHAR2(20),
  updated_at    TIMESTAMP
);

CREATE TABLE ledger_entries (
  entry_id      VARCHAR2(36) PRIMARY KEY,
  user_id       VARCHAR2(36) REFERENCES users(user_id),
  party_id      VARCHAR2(36),
  entry_date    DATE,
  debit         NUMBER(15,2) DEFAULT 0,
  credit        NUMBER(15,2) DEFAULT 0,
  narration     VARCHAR2(500),
  ref_id        VARCHAR2(36),
  updated_at    TIMESTAMP
);

-- Child users (₹699/child/year)
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

CREATE TABLE child_pending (
  pending_id      VARCHAR2(36) PRIMARY KEY,
  child_id        VARCHAR2(36) REFERENCES child_users(child_id),
  parent_user_id  VARCHAR2(36) REFERENCES users(user_id),
  record_type     VARCHAR2(50),
  action          VARCHAR2(10),
  record_data     CLOB,
  submitted_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status          VARCHAR2(10) DEFAULT 'pending',
  reviewed_at     TIMESTAMP,
  reviewed_by     VARCHAR2(36)
);

CREATE INDEX idx_invoices_user ON invoices(user_id);
CREATE INDEX idx_invoices_updated ON invoices(updated_at);
CREATE INDEX idx_customers_user ON customers(user_id);
CREATE INDEX idx_items_user ON items(user_id);
CREATE INDEX idx_sync_log_user ON sync_log(user_id, synced_at);
CREATE INDEX idx_child_pending_parent ON child_pending(parent_user_id, status);
