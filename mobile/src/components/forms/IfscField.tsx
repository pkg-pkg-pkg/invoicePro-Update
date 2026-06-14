import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Snackbar, TextInput } from 'react-native-paper';
import { useIFSCLookup } from '../../hooks/useIFSCLookup';
import type { IfscLookupErrorKind } from '../../services/ifscService';

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
  showFetchButton?: boolean;
  autoFetch?: boolean;
};

type ToastState = {
  message: string;
  type: 'success' | 'error' | 'warning';
};

function toastForError(kind: IfscLookupErrorKind): ToastState {
  if (kind === 'invalid' || kind === 'validation') {
    return { message: 'Invalid IFSC code — please check and retry', type: 'error' };
  }
  return { message: 'Could not fetch bank details — please fill manually', type: 'warning' };
}

export default function IfscField({
  label = 'IFSC Code',
  value,
  onChange,
  onResolved,
  disabled,
  showFetchButton = true,
  autoFetch = true,
}: Props) {
  const { lookup, loading, error, errorKind, reset } = useIFSCLookup();
  const [valid, setValid] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const lastFetchedRef = useRef('');

  const runLookup = useCallback(
    async (codeRaw: string, fromAuto = false) => {
      const code = codeRaw.trim().toUpperCase();
      if (!code) {
        setValid(false);
        reset();
        lastFetchedRef.current = '';
        return;
      }
      if (code.length !== 11) {
        if (!fromAuto) {
          setValid(false);
          setToast({ message: 'IFSC must be 11 characters', type: 'error' });
        }
        return;
      }
      if (lastFetchedRef.current === code) {
        return;
      }

      try {
        const data = await lookup(code);
        lastFetchedRef.current = code;
        setValid(true);
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
          type: 'success',
        });
      } catch (e) {
        lastFetchedRef.current = '';
        setValid(false);
        const kind = (e as Error & { kind?: IfscLookupErrorKind }).kind ?? errorKind ?? 'network';
        setToast(toastForError(kind));
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

  return (
    <View style={styles.wrap}>
      <TextInput
        label={label}
        value={value}
        onChangeText={(text) => {
          onChange(text.toUpperCase().slice(0, 11));
          setValid(false);
          reset();
          if (text.trim().toUpperCase() !== lastFetchedRef.current) {
            lastFetchedRef.current = '';
          }
        }}
        onBlur={() => {
          const code = value.trim().toUpperCase();
          if (code.length === 11 && code !== lastFetchedRef.current) {
            void runLookup(code);
          }
        }}
        mode="outlined"
        autoCapitalize="characters"
        maxLength={11}
        disabled={disabled || loading}
        style={styles.input}
        right={
          loading ? <TextInput.Icon icon="progress-clock" /> : valid ? <TextInput.Icon icon="check-circle" color="#2e7d32" /> : undefined
        }
      />
      {!!error && !valid && <HelperText type="error">{error}</HelperText>}
      {valid && <HelperText type="info">IFSC verified</HelperText>}
      {showFetchButton ? (
        <Button
          mode="outlined"
          icon="magnify"
          loading={loading}
          disabled={disabled || loading || value.trim().length !== 11}
          onPress={() => void runLookup(value)}
          style={styles.fetchBtn}
        >
          Fetch
        </Button>
      ) : null}
      <Snackbar
        visible={Boolean(toast)}
        onDismiss={() => setToast(null)}
        duration={4000}
        style={
          toast?.type === 'success'
            ? styles.snackSuccess
            : toast?.type === 'warning'
              ? styles.snackWarning
              : styles.snackError
        }
      >
        {toast?.message ?? ''}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'transparent',
  },
  fetchBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  snackSuccess: {
    backgroundColor: '#2e7d32',
  },
  snackWarning: {
    backgroundColor: '#ed6c02',
  },
  snackError: {
    backgroundColor: '#d32f2f',
  },
});
