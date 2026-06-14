import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Snackbar,
  TextField,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import SearchIcon from '@mui/icons-material/Search';
import { useIFSCLookup } from '../../hooks/useIFSCLookup';
import type { IfscLookupErrorKind } from '../../services/ifsc/ifscService';

export type IfscResolvedPayload = {
  bankName: string;
  branchName: string;
  address?: string;
  city?: string;
  state?: string;
  micr?: string;
};

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onResolved?: (data: IfscResolvedPayload) => void;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  showFetchButton?: boolean;
  autoFetch?: boolean;
};

type ToastState = {
  message: string;
  severity: 'success' | 'error' | 'warning';
};

function toastForError(kind: IfscLookupErrorKind, message: string): ToastState {
  if (kind === 'invalid' || kind === 'validation') {
    return { message: 'Invalid IFSC code — please check and retry', severity: 'error' };
  }
  if (kind === 'network') {
    return { message: 'Could not fetch bank details — please fill manually', severity: 'warning' };
  }
  return { message, severity: 'error' };
}

export function IfscField({
  label = 'IFSC Code',
  value,
  onChange,
  onResolved,
  disabled,
  required,
  fullWidth = true,
  size = 'small',
  showFetchButton = true,
  autoFetch = true,
}: Props) {
  const { lookup, loading, error, errorKind, reset } = useIFSCLookup();
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [toast, setToast] = useState<ToastState | null>(null);
  const lastFetchedRef = useRef('');

  const runLookup = useCallback(
    async (codeRaw: string, fromAuto = false) => {
      const code = codeRaw.trim().toUpperCase();
      if (!code) {
        setStatus('idle');
        reset();
        lastFetchedRef.current = '';
        return;
      }
      if (code.length !== 11) {
        if (!fromAuto) {
          setStatus('invalid');
          setToast({ message: 'IFSC must be 11 characters', severity: 'error' });
        }
        return;
      }
      if (lastFetchedRef.current === code) {
        return;
      }

      try {
        const data = await lookup(code);
        lastFetchedRef.current = code;
        setStatus('valid');
        onResolved?.({
          bankName: data.bank,
          branchName: data.branch,
          address: data.address || undefined,
          city: data.city || undefined,
          state: data.state || undefined,
          micr: data.micr || undefined,
        });
        setToast({
          message: `Bank details fetched: ${data.bank}, ${data.branch}`,
          severity: 'success',
        });
      } catch (e) {
        lastFetchedRef.current = '';
        setStatus('invalid');
        const kind = (e as Error & { kind?: IfscLookupErrorKind }).kind ?? errorKind ?? 'network';
        setToast(toastForError(kind, (e as Error).message));
      }
    },
    [errorKind, lookup, onResolved, reset]
  );

  useEffect(() => {
    if (!autoFetch || disabled) return;
    const code = value.trim().toUpperCase();
    if (code.length === 11 && code !== lastFetchedRef.current) {
      void runLookup(code, true);
    }
  }, [autoFetch, disabled, runLookup, value]);

  const endAdornment = loading ? (
      <InputAdornment position="end">
        <CircularProgress size={18} />
      </InputAdornment>
    ) : status === 'valid' ? (
      <InputAdornment position="end">
        <CheckCircleIcon color="success" fontSize="small" />
      </InputAdornment>
    ) : status === 'invalid' ? (
      <InputAdornment position="end">
        <ErrorIcon color="error" fontSize="small" />
      </InputAdornment>
    ) : undefined;

  const field = (
    <TextField
      label={label}
      value={value}
      onChange={(e) => {
        onChange(e.target.value.toUpperCase().slice(0, 11));
        setStatus('idle');
        reset();
        if (e.target.value.trim().toUpperCase() !== lastFetchedRef.current) {
          lastFetchedRef.current = '';
        }
      }}
      onBlur={() => {
        const code = value.trim().toUpperCase();
        if (code.length === 11 && code !== lastFetchedRef.current) {
          void runLookup(code);
        }
      }}
      disabled={disabled || loading}
      required={required}
      fullWidth={fullWidth}
      size={size}
      inputProps={{ maxLength: 11, style: { textTransform: 'uppercase' } }}
      helperText={
        error ||
        (status === 'valid' ? 'IFSC verified' : loading ? 'Fetching bank details…' : undefined)
      }
      error={status === 'invalid'}
      InputProps={{ endAdornment }}
    />
  );

  return (
    <>
      {showFetchButton ? (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>{field}</Box>
          <Button
            variant="outlined"
            size={size}
            disabled={disabled || loading || value.trim().length !== 11}
            onClick={() => void runLookup(value)}
            startIcon={loading ? <CircularProgress size={16} /> : <SearchIcon />}
            sx={{ mt: size === 'small' ? 0.25 : 0.5, whiteSpace: 'nowrap', minWidth: 88 }}
          >
            Fetch
          </Button>
        </Box>
      ) : (
        field
      )}

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {toast ? (
          <Alert severity={toast.severity} onClose={() => setToast(null)} sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}
