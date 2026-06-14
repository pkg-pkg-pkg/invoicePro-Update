import { getDeviceId } from './deviceService';
import { getEncryptedItem } from './secureStorage';
import { auth, db } from '../firebase/firebase';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { removeEncryptedItem } from './secureStorage';

const DEVICE_BINDING_KEY = 'device_binding_v1';
const LOCAL_LICENSE_CACHE_KEY = 'enc_license_cache_v1';

interface DeviceBinding {
  deviceId: string;
  boundAt: number;
  email: string;
}

/**
 * Detects if the device has changed since last activation.
 * Returns true if device change detected (requiring re-login).
 */
export async function detectDeviceChange(): Promise<{
  changed: boolean;
  reason?: string;
  previousDeviceId?: string;
  currentDeviceId?: string;
}> {
  try {
    const currentDeviceId = await getDeviceId();
    
    // Check if there's a stored device binding
    const bindingRaw = localStorage.getItem(DEVICE_BINDING_KEY);
    if (!bindingRaw) {
      // No previous binding - this is first run on this device
      return { changed: false };
    }

    let binding: DeviceBinding;
    try {
      binding = JSON.parse(bindingRaw);
    } catch {
      // Corrupted binding - treat as device change
      return {
        changed: true,
        reason: 'Device binding corrupted',
        currentDeviceId,
      };
    }

    // Compare device IDs
    if (binding.deviceId !== currentDeviceId) {
      return {
        changed: true,
        reason: 'Device ID mismatch - hardware or installation changed',
        previousDeviceId: binding.deviceId,
        currentDeviceId,
      };
    }

    // Device matches - verify encrypted cache is still readable
    try {
      const cache = await getEncryptedItem(LOCAL_LICENSE_CACHE_KEY, currentDeviceId);
      if (!cache) {
        // Cache should exist but doesn't - possible tampering
        return {
          changed: true,
          reason: 'License cache missing or unreadable',
          currentDeviceId,
        };
      }
    } catch {
      // Cache decryption failed - device key changed
      return {
        changed: true,
        reason: 'Unable to decrypt license cache - device key changed',
        currentDeviceId,
      };
    }

    return { changed: false, currentDeviceId };
  } catch (error) {
    console.error('Device change detection error:', error);
    return {
      changed: true,
      reason: 'Device verification failed',
    };
  }
}

/**
 * Binds the current device to the license after successful activation.
 * This creates a local record that future checks will validate against.
 */
export async function bindCurrentDevice(email: string): Promise<void> {
  const deviceId = await getDeviceId();
  const binding: DeviceBinding = {
    deviceId,
    boundAt: Date.now(),
    email,
  };
  localStorage.setItem(DEVICE_BINDING_KEY, JSON.stringify(binding));
}

/**
 * Forces logout and clears all local auth/license data.
 * Used when device change is detected.
 */
export async function forceLogoutDueToDeviceChange(reason: string): Promise<void> {
  console.warn('🚨 Device change detected - forcing logout:', reason);
  
  // Clear all local auth data
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem(DEVICE_BINDING_KEY);
  removeEncryptedItem(LOCAL_LICENSE_CACHE_KEY);
  localStorage.removeItem('lastLoginEmail');
  localStorage.removeItem('lastLoginMobile');
  
  // Store the reason for display on login page
  localStorage.setItem('lastAuthError', `Device change detected: ${reason}. Please login again to activate this device.`);
  
  // Sign out from Firebase
  if (auth) {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Firebase signout error during device change:', error);
    }
  }
}

/**
 * Clears device binding (used during manual logout or license surrender).
 */
export function clearDeviceBinding(): void {
  localStorage.removeItem(DEVICE_BINDING_KEY);
}

/**
 * Listen for license deactivation on this device by watching the Firestore
 * licenses/{licenseKey} document. The backend is responsible for updating
 * currentDevice.machineID when a transfer occurs. If it no longer matches
 * this device's machine ID, we trigger a forced logout.
 */
export function subscribeToLicenseDeactivation(params: {
  licenseKey: string;
  onDeactivated: (reason: string) => void;
}): () => void {
  try {
    if (!db) return () => undefined;
    const normalizedKey = params.licenseKey.trim().toUpperCase();
    const ref = doc(db, 'licenses', normalizedKey);
    const unsubscribe = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) return;
        const data: any = snap.data() || {};
        const currentDevice = data.currentDevice || {};
        const remoteMachineId: string | undefined = currentDevice.machineID || currentDevice.machineId;
        const localMachineId = await getDeviceId();
        if (remoteMachineId && remoteMachineId !== localMachineId) {
          // This device has been deactivated in favour of another.
          params.onDeactivated('License moved to another device.');
        }
      },
      () => {
        // Ignore listener errors on client; they shouldn't block app usage.
      },
    );
    return unsubscribe;
  } catch {
    return () => undefined;
  }
}

/** Pause Firestore listener when app is minimized; resume on focus. */
export function subscribeToLicenseDeactivationWithVisibility(params: {
  licenseKey: string;
  onDeactivated: (reason: string) => void;
}): () => void {
  if (typeof document === 'undefined') {
    return subscribeToLicenseDeactivation(params);
  }

  let innerUnsub: (() => void) | undefined;
  let listening = false;

  const start = () => {
    if (listening) return;
    listening = true;
    innerUnsub = subscribeToLicenseDeactivation(params);
  };

  const stop = () => {
    listening = false;
    innerUnsub?.();
    innerUnsub = undefined;
  };

  const onVisibility = () => {
    if (document.visibilityState === 'visible') start();
    else stop();
  };

  document.addEventListener('visibilitychange', onVisibility);
  if (document.visibilityState === 'visible') start();

  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    stop();
  };
}
