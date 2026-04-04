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

const createLedgerAccount = async (name: string, groupId: string, openingType: 'DEBIT' | 'CREDIT' = 'DEBIT') =>
  ledgerAccountService.create({
    name: `${name}-${unique()}`,
    groupId,
    openingBalance: 0,
    openingBalanceType: openingType,
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
    openingStock: 0,
    openingValue: 0,
    currentStock: 0,
    godownStocks: [],
  });

  return { item, godown };
};

describe('Purchase voucher posting', () => {
  it('creates balanced postings and increases stock', async () => {
    const purchaseGroup = await createLedgerGroup('Purchases', 'EXPENSE');
    const liabilityGroup = await createLedgerGroup('Liabilities', 'LIABILITY');
    const assetGroup = await createLedgerGroup('Assets', 'ASSET');

    const purchaseLedger = await createLedgerAccount('Purchase', purchaseGroup.id, 'DEBIT');
    const gstInputLedger = await createLedgerAccount('GSTIn', liabilityGroup.id, 'DEBIT');
    const cashLedger = await ledgerAccountService.create({
      name: `Cash-${unique()}`,
      groupId: assetGroup.id,
      openingBalance: 10000,
      openingBalanceType: 'DEBIT',
      isCashBank: true,
    });

    const { item, godown } = await setupItem();

    const purchaseAmount = 800;
    const gstAmount = 144;
    const quantity = 4;

    const voucher = await voucherService.create({
      type: 'PURCHASE',
      date: new Date().toISOString(),
      number: `PUR-${unique()}`,
      lines: [
        {
          ledgerId: purchaseLedger.id,
          debit: purchaseAmount,
          credit: 0,
          itemId: item.id,
          quantity,
          godownId: godown.id,
        },
        { ledgerId: gstInputLedger.id, debit: gstAmount, credit: 0 },
        { ledgerId: cashLedger.id, debit: 0, credit: purchaseAmount + gstAmount },
      ],
    });

    expect(voucher.id).toBeTruthy();

    const transactions = await ledgerTransactionService.findByVoucher('PURCHASE', voucher.id);
    expect(transactions).toHaveLength(3);
    const totalDebits = transactions.reduce((sum, txn) => sum + txn.debit, 0);
    const totalCredits = transactions.reduce((sum, txn) => sum + txn.credit, 0);
    expect(totalDebits).toBeCloseTo(totalCredits, 6);

    const updatedPurchase = await ledgerAccountService.getById(purchaseLedger.id);
    const updatedGST = await ledgerAccountService.getById(gstInputLedger.id);
    const updatedCash = await ledgerAccountService.getById(cashLedger.id);

    expect(updatedPurchase?.currentBalance).toBeCloseTo(purchaseAmount, 6);
    expect(updatedGST?.currentBalance).toBeCloseTo(gstAmount, 6);
    expect(updatedCash?.currentBalance).toBeCloseTo(10000 - (purchaseAmount + gstAmount), 6);

    const updatedItem = await inventoryItemService.getById(item.id);
    expect(updatedItem?.currentStock).toBeCloseTo(quantity, 6);
    const stockEntry = updatedItem?.godownStocks?.find((entry) => entry.godownId === godown.id);
    expect(stockEntry?.quantity).toBeCloseTo(quantity, 6);
  });
});
