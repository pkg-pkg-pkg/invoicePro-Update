## Voucher Posting Rules

### SALES
- **Ledger Entries**
  - Debit: Customer (ledger account)
  - Credit: Sales revenue ledger
  - Credit: GST Output ledger (tax portion)
- **Stock Impact**
  - Reduce item quantity (per godown) by sold quantity

### PURCHASE
- **Ledger Entries**
  - Debit: Purchase ledger (expense/inventory)
  - Debit: GST Input ledger
  - Credit: Supplier ledger
- **Stock Impact**
  - Increase item quantity (per godown) by purchased quantity

### PAYMENT
- **Ledger Entries**
  - Debit: Supplier / expense ledger being settled
  - Credit: Cash or Bank ledger
- **Stock Impact**
  - None

### RECEIPT
- **Ledger Entries**
  - Debit: Cash or Bank ledger
  - Credit: Customer ledger
- **Stock Impact**
  - None

### JOURNAL
- **Ledger Entries**
  - Configurable per line; must balance debits and credits.
- **Stock Impact**
  - None (handled only via adjustments/vouchers specifically affecting stock)

### CONTRA
- **Ledger Entries**
  - Transfer between Cash/Bank ledgers.
  - Example: Debit Bank, Credit Cash (cash deposit); or reverse for withdrawal.
- **Stock Impact**
  - None
