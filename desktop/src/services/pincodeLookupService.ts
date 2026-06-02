/** India Post pincode lookup (free, no API key). */
import { lookupPincode } from '../utils/pincodeUtils';
import { isElectronRuntime } from '../utils/runtime';

const PINCODE_API = 'https://api.postalpincode.in/pincode';
const FETCH_TIMEOUT_MS = 12000;

export type PincodeAddress = {
  /** District from API (used as city). */
  city: string;
  district: string;
  state: string;
};

export type PincodeLookupResult =
  | { kind: 'success'; address: PincodeAddress }
  | { kind: 'invalid' }
  | { kind: 'offline' };

type PostOffice = {
  Name?: string;
  District?: string;
  State?: string;
  Country?: string;
  Pincode?: string;
};

type ApiPayload = {
  Status?: string;
  Message?: string;
  PostOffice?: PostOffice[] | null;
};

function addressFromPostOffice(po: PostOffice): PincodeAddress | null {
  const district = String(po.District || '').trim();
  const state = String(po.State || '').trim();
  if (!district || !state) return null;
  return { city: district, district, state };
}

/** Parse postalpincode.in JSON (array or single object). */
export function parsePincodeApiPayload(data: unknown): PincodeLookupResult {
  if (data == null) return { kind: 'offline' };

  const block: ApiPayload | undefined = Array.isArray(data)
    ? (data[0] as ApiPayload)
    : (data as ApiPayload);

  if (!block) return { kind: 'offline' };

  const status = String(block.Status ?? '').trim().toLowerCase();
  if (status === 'error' || status === '404') {
    return { kind: 'invalid' };
  }

  const offices = block.PostOffice;
  if (status === 'success' && Array.isArray(offices) && offices.length > 0) {
    const addr = addressFromPostOffice(offices[0]);
    if (addr) return { kind: 'success', address: addr };
  }

  if (Array.isArray(offices) && offices.length > 0) {
    const addr = addressFromPostOffice(offices[0]);
    if (addr) return { kind: 'success', address: addr };
  }

  return { kind: 'invalid' };
}

async function fetchPincodeViaRenderer(pin: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${PINCODE_API}/${pin}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchPincodeViaElectron(pin: string): Promise<unknown> {
  const api = window.electronAPI;
  if (!api?.pincodeLookup) return null;
  try {
    return await api.pincodeLookup(pin);
  } catch {
    return null;
  }
}

function lookupLocalMaster(pin: string): PincodeLookupResult {
  const local = lookupPincode(pin);
  if (!local) return { kind: 'offline' };
  return {
    kind: 'success',
    address: {
      city: local.district,
      district: local.district,
      state: local.state,
    },
  };
}

export async function lookupPincodeOnline(pin: string): Promise<PincodeLookupResult> {
  const digits = pin.replace(/\D/g, '');
  if (digits.length !== 6) return { kind: 'invalid' };

  let data: unknown = null;

  if (isElectronRuntime()) {
    data = await fetchPincodeViaElectron(digits);
  }

  if (data == null) {
    data = await fetchPincodeViaRenderer(digits);
  }

  if (data != null) {
    const parsed = parsePincodeApiPayload(data);
    if (parsed.kind === 'success' || parsed.kind === 'invalid') {
      return parsed;
    }
  }

  const local = lookupLocalMaster(digits);
  if (local.kind === 'success') return local;

  return { kind: 'offline' };
}
