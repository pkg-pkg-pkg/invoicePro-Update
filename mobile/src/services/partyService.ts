import api from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mobileSyncWorker } from './sync/mobileSyncWorker';

export type PartyKind = 'CUSTOMER' | 'SUPPLIER';

export type PartyRecord = {
  id: string;
  name: string;
  phone?: string;
  kind: PartyKind;
};

type ListResponse<T> = {
  data: T[];
};

const PARTY_CACHE_KEY = 'pve_mobile_party_cache';

async function readPartyCache(): Promise<PartyRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(PARTY_CACHE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as PartyRecord[]) : [];
  } catch {
    return [];
  }
}

async function writePartyCache(list: PartyRecord[]) {
  await AsyncStorage.setItem(PARTY_CACHE_KEY, JSON.stringify(list.slice(-1000)));
}

export async function listParties(search: string): Promise<PartyRecord[]> {
  try {
    const [customersRes, suppliersRes] = await Promise.all([
      api.get<ListResponse<{ id: string; name: string; phone?: string }>>('/customers', {
        params: { search, limit: 50, page: 1 },
      }),
      api.get<ListResponse<{ id: string; name: string; phone?: string }>>('/suppliers', {
        params: { search, limit: 50, page: 1 },
      }),
    ]);

    const customers = (customersRes.data?.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      kind: 'CUSTOMER' as const,
    }));
    const suppliers = (suppliersRes.data?.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      kind: 'SUPPLIER' as const,
    }));
    const merged = [...customers, ...suppliers];
    await writePartyCache(merged);
    return merged;
  } catch {
    const cached = await readPartyCache();
    const q = search.trim().toLowerCase();
    if (!q) return cached;
    return cached.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.phone || '').toLowerCase().includes(q)
    );
  }
}

export async function createCustomer(input: {
  name: string;
  phone: string;
  city?: string;
  state?: string;
  addressLine1?: string;
}) {
  const payload = {
    name: input.name,
    phone: input.phone,
    city: input.city ?? '',
    state: input.state ?? '',
    addressLine1: input.addressLine1 ?? '',
  };
  const event = await mobileSyncWorker.enqueueCreate('ledger', {
    ...payload,
    kind: 'CUSTOMER',
  } as unknown as Record<string, unknown>);
  const cache = await readPartyCache();
  cache.push({
    id: `pending_${event.id}`,
    name: payload.name,
    phone: payload.phone,
    kind: 'CUSTOMER',
  });
  await writePartyCache(cache);
  return { success: true, queued: true, idempotencyKey: event.idempotencyKey };
}

export async function createSupplier(input: {
  name: string;
  phone: string;
  city?: string;
  state?: string;
  addressLine1?: string;
}) {
  const payload = {
    name: input.name,
    phone: input.phone,
    city: input.city ?? '',
    state: input.state ?? '',
    addressLine1: input.addressLine1 ?? '',
  };
  const event = await mobileSyncWorker.enqueueCreate('ledger', {
    ...payload,
    kind: 'SUPPLIER',
  } as unknown as Record<string, unknown>);
  const cache = await readPartyCache();
  cache.push({
    id: `pending_${event.id}`,
    name: payload.name,
    phone: payload.phone,
    kind: 'SUPPLIER',
  });
  await writePartyCache(cache);
  return { success: true, queued: true, idempotencyKey: event.idempotencyKey };
}

