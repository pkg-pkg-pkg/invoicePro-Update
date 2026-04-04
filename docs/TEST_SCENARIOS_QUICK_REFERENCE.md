# Test Scenarios Quick Reference

## Critical Test Scenarios (P0)

### Sales Invoice
1. ✅ Create invoice with multiple items, discounts, taxes
2. ✅ Verify stock update and customer balance
3. ✅ Print invoice

### Purchase Invoice
1. ✅ Create purchase invoice
2. ✅ Verify stock increase and ITC calculation
3. ✅ Verify supplier balance

### GST Calculation
1. ✅ CGST/SGST for same state
2. ✅ IGST for different states
3. ✅ Multiple tax rates (5%, 12%, 18%, 28%)

### Sync
1. ✅ Offline mode works
2. ✅ Sync after offline work
3. ✅ Conflict resolution

### Security
1. ✅ Role-based access control
2. ✅ Data isolation (multi-tenant)

## Test Scenarios by Module

### Sales (8 scenarios)
- Basic Sales Invoice
- POS Billing
- Credit Sale
- Sales Return
- Invoice Cancellation
- Discounts (Item/Bill level)
- Multiple payment modes
- Print/Export

### Purchase (3 scenarios)
- Basic Purchase Invoice
- Purchase Return
- ITC Calculation

### Inventory (5 scenarios)
- Opening Stock
- Stock In/Out
- Low Stock Alert
- Batch & Expiry Tracking
- Serial Number Tracking

### Parties (4 scenarios)
- Customer Credit Limit
- Customer Outstanding
- Supplier Ledger
- Customer Statement

### Payments (4 scenarios)
- Payment In (Customer)
- Payment Out (Supplier)
- Cheque Management
- Cash Book & Bank Book

### GST (4 scenarios)
- GSTR-1 Generation
- GSTR-3B Summary
- ITC Report
- HSN Summary

### Reports (4 scenarios)
- Filters
- Drill-down
- Exports (PDF/Excel/CSV)
- Scheduled Reports

### Sync (4 scenarios)
- Full Offline Mode
- Sync After Offline Work
- Conflict Scenario
- Partial Sync Failure

### Security (3 scenarios)
- Role-Based Access
- Data Isolation
- Audit Trail

### Performance (2 scenarios)
- Large Data Volume
- Concurrent Users

## Quick Test Checklist

### Before Release
- [ ] All P0 scenarios pass
- [ ] GST calculations verified
- [ ] Sync tested (Desktop ↔ Cloud ↔ Mobile)
- [ ] Security tested (RBAC, data isolation)
- [ ] Performance acceptable
- [ ] UAT completed

### Regression Tests
- [ ] Sales workflow
- [ ] Purchase workflow
- [ ] Stock management
- [ ] Payment processing
- [ ] GST reports
- [ ] Sync functionality

## Common Test Data

### Products
- Product A: HSN 3004, 18% GST, ₹100
- Product B: HSN 0401, 5% GST, ₹50
- Product C: HSN 3004, 12% GST, ₹200

### Customers
- Customer A: GSTIN, Credit Limit ₹10,000
- Customer B: No GSTIN, Cash only

### Suppliers
- Supplier A: GSTIN, Credit Days 30
- Supplier B: No GSTIN, Cash only

## Performance Benchmarks

- Product search: < 1 second
- Invoice creation: < 2 seconds
- Report generation: < 5 seconds
- Sync 10k records: < 30 seconds

## See Also

- Full documentation: `docs/QA_TESTING_STRATEGY.md`
- UAT checklist: Section 5 of QA document
- Bug reporting: Section 7 of QA document

