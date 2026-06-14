import { useCallback, useState } from 'react';
import {
  lookupIfsc,
  type IfscLookupErrorKind,
  type IfscLookupResult,
} from '../services/ifsc/ifscService';

export type IfscResolvedData = {
  bank: string;
  branch: string;
  address: string;
  city: string;
  state: string;
  micr: string;
  ifsc: string;
};

export function mapIfscResult(data: IfscLookupResult): IfscResolvedData {
  return {
    bank: String(data.BANK || '').trim(),
    branch: String(data.BRANCH || '').trim(),
    address: String(data.ADDRESS || '').trim(),
    city: String(data.CITY || '').trim(),
    state: String(data.STATE || '').trim(),
    micr: String(data.MICR || '').trim(),
    ifsc: String(data.IFSC || '').trim(),
  };
}

export function useIFSCLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<IfscLookupErrorKind | null>(null);

  const lookup = useCallback(async (ifscRaw: string): Promise<IfscResolvedData> => {
    const ifsc = ifscRaw.trim().toUpperCase();
    if (!/^[A-Z0-9]{11}$/.test(ifsc)) {
      const msg = 'IFSC must be 11 alphanumeric characters';
      setError(msg);
      setErrorKind('validation');
      throw new Error(msg);
    }

    setLoading(true);
    setError(null);
    setErrorKind(null);
    try {
      const data = await lookupIfsc(ifsc);
      const mapped = mapIfscResult(data);
      return mapped;
    } catch (e) {
      const err = e as Error & { kind?: IfscLookupErrorKind };
      const kind: IfscLookupErrorKind =
        err.kind === 'invalid' || err.kind === 'network' || err.kind === 'validation'
          ? err.kind
          : 'network';
      setError(err.message);
      setErrorKind(kind);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setErrorKind(null);
  }, []);

  return { lookup, loading, error, errorKind, reset };
}
