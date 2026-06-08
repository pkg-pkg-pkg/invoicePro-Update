import { useCallback, useEffect, useState } from 'react';
import type { NormalizedCompanyProfile } from '@/utils/companyProfile';
import {
  getActiveProfileFromDb,
  getCachedCompanyProfile,
  invalidateCompanyProfileCache,
} from '@/services/companyProfileDbService';

export function useCompanyProfile() {
  const [profile, setProfile] = useState<NormalizedCompanyProfile>(() => getCachedCompanyProfile());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getActiveProfileFromDb();
      setProfile(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await getActiveProfileFromDb();
      if (!cancelled) {
        setProfile(next);
        setLoading(false);
      }
    })();
    const onUpdate = () => {
      invalidateCompanyProfileCache();
      void refresh();
    };
    window.addEventListener('companyProfileUpdated', onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('companyProfileUpdated', onUpdate);
    };
  }, [refresh]);

  return { profile, loading, refresh };
}
