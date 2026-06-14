import { ItemHistoryEntry } from '../../types/masters';
import { generateId } from '../../utils/id';
import { nowIso, readList, writeList } from '../masters/storageHelpers';
import { companyScopedKey } from '../../utils/companyStorage';

const STORAGE_KEY = companyScopedKey('pve_item_history');

function readUserLabel(): string {
  try {
    const raw = localStorage.getItem('user');
    if (!raw) return 'User';
    const u = JSON.parse(raw);
    return String(u?.fullName || u?.email || 'User');
  } catch {
    return 'User';
  }
}

export const itemHistoryService = {
  async list(itemId: string): Promise<ItemHistoryEntry[]> {
    const rows = await readList<ItemHistoryEntry>(STORAGE_KEY);
    return rows
      .filter((r) => r.itemId === itemId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async append(
    itemId: string,
    action: ItemHistoryEntry['action'],
    summary: string,
    meta?: ItemHistoryEntry['meta']
  ): Promise<void> {
    const rows = await readList<ItemHistoryEntry>(STORAGE_KEY);
    rows.push({
      id: generateId('ihist'),
      itemId,
      action,
      summary,
      userLabel: readUserLabel(),
      meta: meta ?? null,
      createdAt: nowIso(),
    });
    await writeList(STORAGE_KEY, rows.slice(-5000));
  },
};
