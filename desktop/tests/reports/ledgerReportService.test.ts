import '../setup';
import { describe, it, expect } from 'vitest';
import { ledgerGroupService } from '../../src/services/masters/ledgerGroupService';
import { ledgerAccountService } from '../../src/services/masters/ledgerAccountService';
import { ledgerReportService } from '../../src/services/reports/ledgerReportService';
import { voucherService } from '../../src/services/vouchers/voucherService';
import { readList, writeList } from '../../src/services/masters/storageHelpers';
import type { Voucher } from '../../src/types/vouchers';

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

  it('includes voucher lines when ledger transactions were never posted', async () => {
    const customer = await createBasicLedger('Debtor', 'ASSET');
    const sales = await createBasicLedger('Sales', 'INCOME');
    const date = new Date().toISOString();

    const vouchers = await readList<Voucher>('pve_vouchers');
    vouchers.push({
      id: 'vch-test-unposted',
      type: 'SALES',
      status: 'ACTIVE',
      date,
      number: unique('INV'),
      lines: [
        { ledgerId: customer.id, debit: 2500, credit: 0 },
        { ledgerId: sales.id, debit: 0, credit: 2500 },
      ],
      createdAt: date,
    });
    await writeList('pve_vouchers', vouchers);

    const statement = await ledgerReportService.getStatement(customer.id, {
      fromDate: date,
      toDate: date,
    });

    expect(statement.transactions).toHaveLength(1);
    expect(statement.transactions[0].voucherId).toBe('vch-test-unposted');
    expect(statement.transactions[0].debit).toBeCloseTo(2500, 6);
  });
});
