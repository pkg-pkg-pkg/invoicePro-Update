import { useCallback, useEffect, useState } from 'react';
import { readCache, writeCache, type CacheKey } from '../services/cache/offlineCache';

type UseOfflineListOptions<T> = {
  cacheKey: CacheKey;
  fetcher: () => Promise<T[]>;
  freshOnly?: boolean;
};

export function useOfflineList<T>({ cacheKey, fetcher, freshOnly = false }: UseOfflineListOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (fromPull = false) => {
    if (fromPull) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      if (!freshOnly) {
        const cached = await readCache<T[]>(cacheKey);
        if (cached?.length) setItems(cached);
      }

      const fresh = await fetcher();
      setItems(fresh);
      if (!freshOnly) await writeCache(cacheKey, fresh);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load data';
      setError(msg);
      if (!items.length) {
        const cached = await readCache<T[]>(cacheKey);
        if (cached) setItems(cached);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, fetcher, freshOnly, items.length]);

  useEffect(() => {
    void load();
  }, [load]);

  return { items, loading, refreshing, error, reload: () => load(true) };
}
