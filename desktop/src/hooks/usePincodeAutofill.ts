import { useCallback, useRef, useState } from 'react';
import type { SxProps, Theme } from '@mui/material';
import {
  lookupPincodeOnline,
  type PincodeAddress,
} from '../services/pincodeLookupService';

export const PINCODE_AUTOFILL_HIGHLIGHT_MS = 2000;
export const PINCODE_INVALID_MESSAGE = 'Invalid PIN code. Please check and retry.';

export type PincodeAutofillField = 'city' | 'district' | 'state';

const HIGHLIGHT_SX: SxProps<Theme> = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(76, 175, 80, 0.14)',
    '& fieldset': {
      borderColor: 'rgba(76, 175, 80, 0.65)',
    },
  },
};

export function usePincodeAutofill(options: {
  onFilled: (address: PincodeAddress) => void;
}) {
  const onFilledRef = useRef(options.onFilled);
  onFilledRef.current = options.onFilled;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlighted, setHighlighted] = useState<Set<PincodeAutofillField>>(new Set());
  const lastFetchedRef = useRef('');
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashHighlight = useCallback((fields: PincodeAutofillField[]) => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlighted(new Set(fields));
    highlightTimerRef.current = setTimeout(() => {
      setHighlighted(new Set());
      highlightTimerRef.current = null;
    }, PINCODE_AUTOFILL_HIGHLIGHT_MS);
  }, []);

  const onPincodeInput = useCallback(async (raw: string) => {
    const pin = raw.replace(/\D/g, '').slice(0, 6);

    if (pin.length < 6) {
      setError(null);
      lastFetchedRef.current = '';
      return;
    }

    if (pin === lastFetchedRef.current) return;
    lastFetchedRef.current = pin;

    setLoading(true);
    setError(null);

    const result = await lookupPincodeOnline(pin);
    setLoading(false);

    if (result.kind === 'success') {
      onFilledRef.current(result.address);
      flashHighlight(['city', 'district', 'state']);
      return;
    }

    if (result.kind === 'invalid') {
      setError(PINCODE_INVALID_MESSAGE);
      return;
    }

    // offline — silent; user can type manually
  }, [flashHighlight]);

  const clearHighlight = useCallback((field?: PincodeAutofillField) => {
    if (!field) {
      setHighlighted(new Set());
      return;
    }
    setHighlighted((prev) => {
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const fieldSx = useCallback(
    (field: PincodeAutofillField): SxProps<Theme> =>
      highlighted.has(field) ? HIGHLIGHT_SX : {},
    [highlighted]
  );

  const mergePincodeHelper = useCallback(
    (existing?: string) => {
      if (error) return error;
      return existing;
    },
    [error]
  );

  const pincodeFieldError = Boolean(error);

  const resetLastFetched = useCallback(() => {
    lastFetchedRef.current = '';
  }, []);

  return {
    loading,
    error,
    highlighted,
    onPincodeInput,
    resetLastFetched,
    clearHighlight,
    clearError,
    fieldSx,
    mergePincodeHelper,
    pincodeFieldError,
  };
}

export type UsePincodeAutofillReturn = ReturnType<typeof usePincodeAutofill>;
