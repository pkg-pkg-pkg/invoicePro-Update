import { useEffect } from 'react';

export function useUnsavedChangesWarning(dirty: boolean, message = 'You have unsaved changes. Leave anyway?') {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, message]);
}
