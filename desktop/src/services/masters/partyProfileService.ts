import type { PartyProfile } from '../../types/partyProfile';
import { readList, writeList, nowIso } from './storageHelpers';

const STORAGE_KEY = 'pve_party_profiles';

export const partyProfileService = {
  async get(partyId: string): Promise<PartyProfile | null> {
    const rows = await readList<PartyProfile>(STORAGE_KEY);
    return rows.find((r) => r.partyId === partyId) ?? null;
  },

  async save(profile: PartyProfile): Promise<PartyProfile> {
    const rows = await readList<PartyProfile>(STORAGE_KEY);
    const idx = rows.findIndex((r) => r.partyId === profile.partyId);
    const next: PartyProfile = { ...profile, updatedAt: nowIso() };
    if (idx >= 0) rows[idx] = next;
    else rows.push(next);
    await writeList(STORAGE_KEY, rows.map((r) => ({ ...r, id: r.partyId })));
    return next;
  },

  async remove(partyId: string): Promise<void> {
    const rows = await readList<PartyProfile>(STORAGE_KEY);
    await writeList(
      STORAGE_KEY,
      rows.filter((r) => r.partyId !== partyId).map((r) => ({ ...r, id: r.partyId }))
    );
  },
};
