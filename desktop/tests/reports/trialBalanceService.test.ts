import '../setup';
import { describe, it, expect } from 'vitest';
import { ledgerGroupService } from '../../src/services/masters/ledgerGroupService';
import { ledgerAccountService } from '../../src/services/masters/ledgerAccountService';
import { voucherService } from '../../src/services/vouchers/voucherService';
import { trialBalanceService } from '../../src/services/reports/trialBalanceService';

const unique = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

const createLedger = async (name: string, type: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE', openingType: 'DEBIT' | 'CREDIT' = 'DEBIT') => {
  const group = await ledgerGroupService.create({ name: unique(`grp-${name}`), type });
  return ledgerAccountService.create({
    name: unique(name),
    groupId: group.id,
    openingBalance: 0,
    openingBalanceType: openingType,
  });
};

describe('trialBalanceService.getTrialBalance', () => {
  it('produces balanced totals from posted vouchers', async () => {
    const customer = await createLedger('Customer', 'ASSET');
    const sales = await createLedger('Sales', 'INCOME', 'CREDIT');
    const expense = await createLedger('Expense', 'EXPENSE');

    const date = new Date().toISOString();
    await voucherService.create({
      type: 'JOURNAL',
      date,
      number: unique('SAL'),
      lines: [
        { ledgerId: customer.id, debit: 500, credit: 0 },
        { ledgerId: sales.id, debit: 0, credit: 500 },
      ],
    });

    await voucherService.create({
      type: 'JOURNAL',
      date,
      number: unique('JRN'),
      lines: [
        { ledgerId: expense.id, debit: 200, credit: 0 },
        { ledgerId: customer.id, debit: 0, credit: 200 },
      ],
    });

    const trialBalance = await trialBalanceService.getTrialBalance({
      fromDate: date,
      toDate: date,
    });

    expect(trialBalance.entries.length).toBeGreaterThan(0);
    expect(trialBalance.totalDebit).toBeCloseTo(trialBalance.totalCredit, 6);

    const customerEntry = trialBalance.entries.find((entry) => entry.ledger.id === customer.id);
    expect(customerEntry?.debit ?? customerEntry?.credit).toBeDefined();
  });
});
