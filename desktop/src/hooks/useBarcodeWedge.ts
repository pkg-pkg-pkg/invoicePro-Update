import { useEffect } from 'react';

const GAP_MS = 50;
const MIN_LEN = 4;

type WedgeOptions = {
  enabled?: boolean;
  onScan: (code: string) => void;
  isBlocked?: () => boolean;
  shouldIgnoreTarget?: (target: EventTarget | null) => boolean;
};

export function useBarcodeWedge({
  enabled = true,
  onScan,
  isBlocked,
  shouldIgnoreTarget,
}: WedgeOptions): void {
  useEffect(() => {
    if (!enabled) return;

    const buffer = { value: '', lastAt: 0 };

    const defaultIgnore = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el?.isConnected) return true;
      if (el.closest('[role="dialog"], [data-barcode-scanner], .MuiMenu-root, .MuiPopover-root')) {
        return true;
      }
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      if (isBlocked?.()) return;
      if ((shouldIgnoreTarget ?? defaultIgnore)(e.target)) return;

      const now = Date.now();
      if (now - buffer.lastAt > GAP_MS) buffer.value = '';
      buffer.lastAt = now;

      if (e.key === 'Enter') {
        const code = buffer.value.trim();
        buffer.value = '';
        if (code.length >= MIN_LEN) {
          e.preventDefault();
          onScan(code);
        }
        return;
      }
      if (e.key.length === 1) buffer.value += e.key;
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [enabled, onScan, isBlocked, shouldIgnoreTarget]);
}
