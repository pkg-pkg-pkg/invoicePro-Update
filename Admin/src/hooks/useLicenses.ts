import { useCallback, useEffect, useState } from 'react';
import { listLicenses } from '../services/adminApi';
import type { LicenseRecord } from '../utils/licenseHelpers';

export function useLicenses() {
  const [rows, setRows] = useState<LicenseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await listLicenses(500);
      setRows(items);
    } catch (e: unknown) {
      const msg = String((e as Error)?.message ?? 'Failed to load licenses');
      setError(msg === 'internal' ? 'Could not load licenses. Check Firestore rules and admin access.' : msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, loading, error, reload };
}
