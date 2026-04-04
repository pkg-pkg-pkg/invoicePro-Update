import '../setup';
import { describe, it, expect } from 'vitest';
import { ledgerGroupService } from '../../src/services/masters/ledgerGroupService';
import { ledgerAccountService } from '../../src/services/masters/ledgerAccountService';
import { unitOfMeasureService } from '../../src/services/masters/unitOfMeasureService';
import { godownService } from '../../src/services/masters/godownService';
import { inventoryItemService } from '../../src/services/masters/inventoryItemService';
import { voucherService } from '../../src/services/vouchers/voucherService';
import { ledgerTransactionService } from '../../src/services/masters/ledgerTransactionService';

const unique = () => Math.random().toString(36).substring(2, 8);

const createLedgerGroup = (name: string, type: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE') =>
  ledgerGroupService.create({ name: `${name}-${unique()}`, type });

const createLedgerAccount = async (name: string, groupId: string, isCashBank = false) =>
  ledgerAccountService.create({
    name: `${name}-${unique()}`,
    groupId,
    openingBalance: 0,
    openingBalanceType: 'DEBIT',
    isCashBank,
  });

const setupItem = async () => {
  const unit = await unitOfMeasureService.create({
    name: `Unit-${unique()}`,
    symbol: `U${unique()}`,
    precision: 0,
  });
  const godown = await godownService.create({
    name: `Godown-${unique()}`,
    isDefault: true,
  });

  const item = await inventoryItemService.create({
    name: `Item-${unique()}`,
    sku: `SKU-${unique()}`,
    unitId: unit.id,
    gstRate: 18,
    openingStock: 5,
    openingValue: 500,
    currentStock: 5,
    godownStocks: [{ godownId: godown.id, quantity: 5 }],
  });

  return { item, godown };
};

describe('Sales voucher posting', () => {
  it('creates balanced ledger postings and reduces stock', async () => {
    const assetGroup = await createLedgerGroup('Assets', 'ASSET');
    const incomeGroup = await createLedgerGroup('Income', 'INCOME');
    const liabilityGroup = await createLedgerGroup('Liability', 'LIABILITY');

    const customer = await createLedgerAccount('Customer', assetGroup.id);
    const salesLedger = await ledgerAccountService.create({
      name: `Sales-${unique()}`,
      groupId: incomeGroup.id,
      openingBalance: 0,
      openingBalanceType: 'CREDIT',
    });
    const gstLedger = await ledgerAccountService.create({
      name: `GSTOut-${unique()}`,
      groupId: liabilityGroup.id,
      openingBalance: 0,
      openingBalanceType: 'CREDIT',
    });

    const { item, godown } = await setupItem();

    const saleAmount = 1000;
    const gstAmount = 180;
    const quantity = 2;
    const voucher = await voucherService.create({
      type: 'SALES',
      date: new Date().toISOString(),
      number: `SAL-${unique()}`,
      narration: 'Test sale',
      lines: [
        { ledgerId: customer.id, debit: saleAmount + gstAmount, credit: 0 },
        {
          ledgerId: salesLedger.id,
          debit: 0,
          credit: saleAmount,
          itemId: item.id,
          quantity,
          godownId: godown.id,
        },
        { ledgerId: gstLedger.id, debit: 0, credit: gstAmount },
      ],
    });

    expect(voucher.id).toBeTruthy();

    const transactions = await ledgerTransactionService.findByVoucher('SALES', voucher.id);
    expect(transactions).toHaveLength(3);
    const totalDebits = transactions.reduce((sum, txn) => sum + txn.debit, 0);
    const totalCredits = transactions.reduce((sum, txn) => sum + txn.credit, 0);
    expect(totalDebits).toBeCloseTo(totalCredits, 6);

    const updatedCustomer = await ledgerAccountService.getById(customer.id);
    const updatedSales = await ledgerAccountService.getById(salesLedger.id);
    const updatedGST = await ledgerAccountService.getById(gstLedger.id);

    expect(updatedCustomer?.currentBalance).toBeCloseTo(saleAmount + gstAmount, 6);
    expect(updatedSales?.currentBalance).toBeCloseTo(-saleAmount, 6);
    expect(updatedGST?.currentBalance).toBeCloseTo(-gstAmount, 6);

    const updatedItem = await inventoryItemService.getById(item.id);
    expect(updatedItem?.currentStock).toBeCloseTo(5 - quantity, 6);
    const stockEntry = updatedItem?.godownStocks?.find((entry) => entry.godownId === godown.id);
    expect(stockEntry?.quantity).toBeCloseTo(5 - quantity, 6);
  });
});
