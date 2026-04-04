import { useCallback, useRef, useState } from 'react';

export interface MasterFormState<T, Input> {
  entity: T | null;
  loading: boolean;
  saving: boolean;
  error: Error | null;
  load: (id: string) => Promise<void>;
  create: (payload: Input) => Promise<T>;
  update: (id: string, payload: Input) => Promise<T>;
  resetError: () => void;
}

interface MasterFormOptions<T, Input> {
  load?: (id: string) => Promise<T>;
  create: (payload: Input) => Promise<T>;
  update: (id: string, payload: Input) => Promise<T>;
}

export const useMasterForm = <T, Input>(options: MasterFormOptions<T, Input>): MasterFormState<T, Input> => {
  const [entity, setEntity] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const load = useCallback(async (id: string) => {
    const { load: loadFn } = optionsRef.current;
    if (!loadFn) {
      throw new Error('Load function not provided');
    }
    setLoading(true);
    try {
      const result = await loadFn(id);
      setEntity(result);
      setError(null);
    } catch (err) {
      setError(err as Error);
      setEntity(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const create = useCallback(async (payload: Input) => {
    setSaving(true);
    try {
      const result = await optionsRef.current.create(payload);
      setEntity(result as T);
      setError(null);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const update = useCallback(async (id: string, payload: Input) => {
    setSaving(true);
    try {
      const result = await optionsRef.current.update(id, payload);
      setEntity(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setSaving(false);
    }
  }, []);

  const resetError = useCallback(() => setError(null), []);

  return {
    entity,
    loading,
    saving,
    error,
    load,
    create,
    update,
    resetError,
  };
};
