import { useEffect } from 'react';
import { useAuth } from '../pages/contexts/auth';
import { getLicenseKeyFromUserProfile } from '../services/licenseService';
import { refreshAndSyncMobileEntitlements } from '../services/mobileUserSubscriptionService';

/** Keeps mobile user entitlements in desktop middleware KV for phone login validation. */
export default function MobileEntitlementBootstrap() {
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;
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
