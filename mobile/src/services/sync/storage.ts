import AsyncStorage from '@react-native-async-storage/async-storage';
import { MobileSyncConfig, MobileSyncEnvelope } from './types';

const OUTBOX_KEY = 'pve_mobile_sync_outbox';
const CONFIG_KEY = 'pve_mobile_sync_config';

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function readOutbox(): Promise<MobileSyncEnvelope[]> {
  const raw = await AsyncStorage.getItem(OUTBOX_KEY);
  const data = parseJson<MobileSyncEnvelope[]>(raw, []);
  return Array.isArray(data) ? data : [];
}

export async function writeOutbox(events: MobileSyncEnvelope[]): Promise<void> {
  await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(events));
}

export async function readSyncConfig(): Promise<MobileSyncConfig> {
  const raw = await AsyncStorage.getItem(CONFIG_KEY);
  const data = parseJson<Partial<MobileSyncConfig>>(raw, {});
  return {
    endpointBase: String(data.endpointBase || 'http://localhost:3399/mobile-sync'),
    token: String(data.token || ''),
    cursor: Number(data.cursor || 0),
    sessionToken: String(data.sessionToken || ''),
    deviceId: String(data.deviceId || ''),
  };
}

export async function writeSyncConfig(config: MobileSyncConfig): Promise<void> {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}
