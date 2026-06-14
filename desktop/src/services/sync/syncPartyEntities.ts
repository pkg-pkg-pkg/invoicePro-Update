import type { Party } from '../../types/party';

export function partyEntityName(party: Party): string {
  if (party.partyType === 'SUPPLIER') return 'supplier';
  return 'customer';
}

export function partyToPayload(party: Party): Record<string, unknown> {
  return { ...party } as Record<string, unknown>;
}
