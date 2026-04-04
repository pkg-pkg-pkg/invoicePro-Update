/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { ledgerAccountService } from '../src/services/masters/ledgerAccountService';
import { ledgerGroupService } from '../src/services/masters/ledgerGroupService';

const createGroup = async (overrides: { name?: string; type?: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' } = {}) =>
  ledgerGroupService.create({
    name: overrides.name ?? `Group ${Math.random().toString(36).slice(2, 7)}`,
    type: overrides.type ?? 'ASSET',
    isSystem: false,
  });

const baseAccountPayload = (groupId: string) => ({
  name: `Account ${Math.random().toString(36).slice(2, 7)}`,
  groupId,
  openingBalance: 1000,
  openingBalanceType: 'DEBIT' as const,
  isCashBank: false,
});

describe('ledgerAccountService', () => {
  it('requires valid ledger group and enforces cash/bank rule', async () => {
    const assetGroup = await createGroup({ name: 'Asset Group', type: 'ASSET' });
    const liabilityGroup = await createGroup({ name: 'Liability Group', type: 'LIABILITY' });

    const account = await ledgerAccountService.create({
      ...baseAccountPayload(assetGroup.id),
      isCashBank: true,
    });
    expect(account.groupId).toBe(assetGroup.id);
    expect(account.isCashBank).toBe(true);

    await expect(
      ledgerAccountService.create({
        ...baseAccountPayload(liabilityGroup.id),
        name: 'Invalid Cash',
        isCashBank: true,
      })
    ).rejects.toThrow(/Asset group/);

    await expect(
      ledgerAccountService.create({
        ...baseAccountPayload('non-existent'),
        name: 'Missing Group',
      })
    ).rejects.toThrow(/Ledger group not found/);
  });

  it('prevents opening balance changes after creation', async () => {
    const assetGroup = await createGroup({ name: 'Asset Group 2' });
    const account = await ledgerAccountService.create(baseAccountPayload(assetGroup.id));

    await expect(ledgerAccountService.update(account.id, { openingBalance: 2000 })).rejects.toThrow(
      /Opening balance cannot be modified/
    );

    await expect(ledgerAccountService.update(account.id, { openingBalanceType: 'CREDIT' })).rejects.toThrow(
      /Opening balance type cannot be modified/
    );
  });

  it('soft deletes and restores accounts', async () => {
    const assetGroup = await createGroup({ name: 'Asset Group 3' });
    const account = await ledgerAccountService.create(baseAccountPayload(assetGroup.id));

    await ledgerAccountService.softDelete(account.id);
    const deleted = await ledgerAccountService.getById(account.id);
    expect(deleted?.isActive).toBe(false);

    await ledgerAccountService.restore(account.id);
    const restored = await ledgerAccountService.getById(account.id);
    expect(restored?.isActive).toBe(true);
  });
});
