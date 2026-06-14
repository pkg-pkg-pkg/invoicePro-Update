import { useEffect } from 'react';
import { useAuth } from '../pages/contexts/auth';
import { getLicenseKeyFromUserProfile } from '../services/licenseService';
import { refreshAndSyncMobileEntitlements } from '../services/mobileUserSubscriptionService';
import { isElectronRuntime } from '../utils/runtime';

/** Keeps mobile user entitlements in desktop middleware KV for phone login validation. */
export default function MobileEntitlementBootstrap() {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    // Mobile entitlement KV sync runs in Electron middleware only — skip browser dev (avoids CORS noise).
    if (!isElectronRuntime() || !isAuthenticated || !user?.email) return;
    let cancelled = false;

    const sync = async () => {
      try {
        const lic = await getLicenseKeyFromUserProfile(String(user.email));
        if (!lic?.licenseKey || cancelled) return;
        await refreshAndSyncMobileEntitlements(lic.licenseKey);
      } catch {
        // offline / firebase unavailable
      }
    };

    void sync();
    const id = window.setInterval(() => void sync(), 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isAuthenticated, user?.email]);

  return null;
}
