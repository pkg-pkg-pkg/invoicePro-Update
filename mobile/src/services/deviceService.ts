import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'pve_mobile_device_id_v1';

function generateId() {
  return `mob_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export async function getMobileDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing?.trim()) return existing.trim();
  const next = generateId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, next);
  return next;
}
