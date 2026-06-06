import { useEffect, useRef } from 'react';

/** Persist form draft to localStorage every 30 seconds when dirty. */
export function useFormDraftAutosave<T>(
  draftKey: string,
  values: T,
  dirty: boolean,
  onRestore?: (saved: T) => void
) {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (restoredRef.current || !onRestore) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        onRestore(JSON.parse(raw) as T);
      }
    } catch {
      /* ignore */
    }
    restoredRef.current = true;
  }, [draftKey, onRestore]);

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setInterval(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(values));
      } catch {
        /* ignore */
      }
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [draftKey, dirty, values]);
}

export function clearFormDraft(draftKey: string) {
  try {
    localStorage.removeItem(draftKey);
  } catch {
    /* ignore */
  }
}
