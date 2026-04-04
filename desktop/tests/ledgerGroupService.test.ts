import { describe, it, expect } from 'vitest';
import { ledgerGroupService } from '../src/services/masters/ledgerGroupService';
import { LedgerGroup } from '../src/types/masters';

const buildGroupPayload = (overrides: Partial<LedgerGroup> = {}) => ({
  name: 'Sample Group',
  type: 'ASSET' as const,
  isSystem: false,
  ...overrides,
});

describe('ledgerGroupService', () => {
  it('creates a group and enforces uniqueness', async () => {
    const group = await ledgerGroupService.create(buildGroupPayload({ name: 'Assets Custom', code: 'AS-C' }));
    expect(group.name).toBe('Assets Custom');

    await expect(ledgerGroupService.create(buildGroupPayload({ name: 'Assets Custom' }))).rejects.toThrow(
      /Group name already exists/
    );
    await expect(ledgerGroupService.create(buildGroupPayload({ name: 'Another', code: 'AS-C' }))).rejects.toThrow(
      /Group code already exists/
    );
  });

  it('updates active group and prevents duplicate names/codes', async () => {
    const a = await ledgerGroupService.create(buildGroupPayload({ name: 'Group A', code: 'GA' }));
    await ledgerGroupService.create(buildGroupPayload({ name: 'Group B', code: 'GB' }));

    const updated = await ledgerGroupService.update(a.id, { name: 'Renamed Group' });
    expect(updated.name).toBe('Renamed Group');

    await expect(ledgerGroupService.update(a.id, { name: 'Group B' })).rejects.toThrow(/name already exists/);
    await expect(ledgerGroupService.update(a.id, { code: 'GB' })).rejects.toThrow(/code already exists/);
  });

  it('soft deletes and restores groups', async () => {
    const group = await ledgerGroupService.create(buildGroupPayload({ name: 'Temp Group' }));
    await ledgerGroupService.softDelete(group.id);
    const deleted = await ledgerGroupService.getById(group.id);
    expect(deleted?.isActive).toBe(false);

    await ledgerGroupService.restore(group.id);
    const restored = await ledgerGroupService.getById(group.id);
    expect(restored?.isActive).toBe(true);
  });

  it('enforces system-group immutability', async () => {
    await ledgerGroupService.seed([
      {
        id: 'grp-assets',
        name: 'Assets',
        type: 'ASSET',
        isSystem: true,
        sortOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as LedgerGroup,
    ]);

    const systemGroup = await ledgerGroupService.getById('grp-assets');
    expect(systemGroup).toBeTruthy();

    await expect(ledgerGroupService.update('grp-assets', { name: 'New Assets' })).rejects.toThrow(
      /System groups cannot be edited/
    );
    await expect(ledgerGroupService.softDelete('grp-assets')).rejects.toThrow(/System groups cannot be deleted/);
  });
});
