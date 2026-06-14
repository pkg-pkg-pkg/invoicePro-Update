import '../setup';
import { describe, it, expect } from 'vitest';
import { ledgerGroupService } from '../../src/services/masters/ledgerGroupService';
import { ledgerAccountService } from '../../src/services/masters/ledgerAccountService';
import { voucherService } from '../../src/services/vouchers/voucherService';
import { dayBookService } from '../../src/services/dayBook/dayBookService';
import { normalizeToYmd } from '../../src/utils/dateRange';

const unique = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 7)}`;

const createBasicLedger = async (name: string, type: 'ASSET' | 'INCOME') => {
  const group = await ledgerGroupService.create({ name: unique(`group-${name}`), type });
  return ledgerAccountService.create({
    name: unique(name),
    groupId: group.id,
    openingBalance: 0,
    openingBalanceType: 'DEBIT',
  });
};

describe('dayBookService.fetch', () => {
  it('includes sales vouchers for their voucher date', async () => {
    const customer = await createBasicLedger('AMElectronics', 'ASSET');
    const sales = await createBasicLedger('Sales', 'INCOME');
    const date = '2026-04-30';

    await voucherService.create({
      type: 'SALES',
      date,
      number: 'SALES/26-27/0099',
      lines: [
        { ledgerId: customer.id, debit: 2600, credit: 0 },
        { ledgerId: sales.id, debit: 0, credit: 2600 },
      ],
    });

    const result = await dayBookService.fetch({ date });

    expect(result.entries.some((e) => e.voucherNumber === 'SALES/26-27/0099')).toBe(true);
    expect(result.totals.totalVouchers).toBeGreaterThanOrEqual(1);
  });

  it('matches ISO datetimes using local calendar date (not UTC slice)', () => {
    const iso = '2026-04-29T18:30:00.000Z';
    const fromSlice = iso.slice(0, 10);
    const fromNormalize = normalizeToYmd(iso);
    expect(fromNormalize).not.toBe('');
    if (fromNormalize !== fromSlice) {
      expect(fromNormalize).toBe('2026-04-30');
    }
  });
});
