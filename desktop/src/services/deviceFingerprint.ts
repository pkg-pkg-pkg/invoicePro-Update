import { getDeviceId, computeLicenseDeviceKey } from './deviceService';
import { isElectronRuntime } from '../utils/runtime';

export type DeviceInfoPayload = {
  device_id: string;
  device_fingerprint: string;
  device_name: string;
  os_info: string;
};

export async function getDeviceFingerprint(): Promise<string> {
  const info = await getDeviceInfo();
  return info.device_fingerprint;
}

async function buildFingerprint(deviceId: string): Promise<string> {
  return computeLicenseDeviceKey(deviceId);
}

export async function getDeviceInfo(): Promise<DeviceInfoPayload> {
  if (isElectronRuntime() && window.electronAPI?.getDeviceFingerprint) {
    try {
      const payload = await window.electronAPI.getDeviceFingerprint();
      if (payload?.device_id) {
        const fp = payload.device_fingerprint
          ? String(payload.device_fingerprint)
          : await buildFingerprint(String(payload.device_id));
        return { ...payload, device_fingerprint: fp };
      }
    } catch {
      // fall through
    }
  }
  if (isElectronRuntime() && window.electronAPI?.getAppSystemInfo) {
    try {
      const sys = await window.electronAPI.getAppSystemInfo();
      const id = await getDeviceId();
      const fp = await buildFingerprint(id);
      return {
        device_id: id,
        device_fingerprint: fp,
        device_name: String(sys.hostName ?? 'Desktop'),
        os_info: String(sys.osLabel ?? navigator.platform),
      };
    } catch {
      // fall through
    }
  }
  const id = await getDeviceId();
  const fp = await buildFingerprint(id);
  return {
    device_id: id,
    device_fingerprint: fp,
    device_name: 'Desktop',
    os_info: navigator.platform || 'unknown',
  };
}
