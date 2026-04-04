import '../setup';
import { describe, it, expect } from 'vitest';
import { ledgerGroupService } from '../../src/services/masters/ledgerGroupService';
import { ledgerAccountService } from '../../src/services/masters/ledgerAccountService';
import { ledgerReportService } from '../../src/services/reports/ledgerReportService';
import { voucherService } from '../../src/services/vouchers/voucherService';

const unique = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

const createBasicLedger = async (name: string, type: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE') => {
  const group = await ledgerGroupService.create({ name: unique(`group-${name}`), type });
  return ledgerAccountService.create({
    name: unique(name),
    groupId: group.id,
    openingBalance: 0,
    openingBalanceType: 'DEBIT',
  });
};

describe('ledgerReportService.getStatement', () => {
  it('returns opening, transactions, and closing balance within range', async () => {
    const customer = await createBasicLedger('Customer', 'ASSET');
    const sales = await createBasicLedger('Sales', 'INCOME');

    const date = new Date().toISOString();
    await voucherService.create({
      type: 'JOURNAL',
      date,
      number: unique('SAL'),
      lines: [
        { ledgerId: customer.id, debit: 1000, credit: 0 },
        { ledgerId: sales.id, debit: 0, credit: 1000 },
      ],
    });

    const statement = await ledgerReportService.getStatement(customer.id, {
      fromDate: date,
      toDate: date,
    });

    expect(statement.ledger.id).toBe(customer.id);
    expect(statement.openingBalance).toBeCloseTo(0, 6);
    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0].runningBalance).toBeCloseTo(1000, 6);
    expect(statement.closingBalance).toBeCloseTo(1000, 6);
  });
});
