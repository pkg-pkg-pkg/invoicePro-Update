import { useCallback, useState } from 'react';
import { CircularProgress, InputAdornment, TextField } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { lookupIfsc } from '../../services/ifsc/ifscService';

type Props = {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onResolved?: (data: {
    bankName: string;
    branchName: string;
    city?: string;
    micr?: string;
  }) => void;
  disabled?: boolean;
  required?: boolean;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
};

export function IfscField({
  label = 'IFSC Code',
  value,
  onChange,
  onResolved,
  disabled,
  required,
  fullWidth = true,
  size = 'small',
}: Props) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [errorText, setErrorText] = useState<string | undefined>();

  const validate = useCallback(async () => {
    const code = value.trim().toUpperCase();
    if (!code) {
      setStatus('idle');
      setErrorText(undefined);
      return;
    }
    if (code.length !== 11) {
      setStatus('invalid');
      setErrorText('IFSC must be 11 characters');
      return;
    }
    setStatus('loading');
    setErrorText(undefined);
    try {
      const data = await lookupIfsc(code);
      setStatus('valid');
      onResolved?.({
        bankName: data.BANK,
        branchName: data.BRANCH,
        city: data.CITY,
        micr: data.MICR,
      });
    } catch (e) {
      setStatus('invalid');
      setErrorText((e as Error).message || 'Invalid IFSC');
    }
  }, [onResolved, value]);

  const endAdornment =
    status === 'loading' ? (
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

  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => {
        onChange(e.target.value.toUpperCase().slice(0, 11));
        setStatus('idle');
        setErrorText(undefined);
      }}
      onBlur={() => void validate()}
      disabled={disabled}
      required={required}
      fullWidth={fullWidth}
      size={size}
      inputProps={{ maxLength: 11, style: { textTransform: 'uppercase' } }}
      helperText={errorText || (status === 'valid' ? 'IFSC verified' : status === 'loading' ? 'Validating…' : undefined)}
      error={status === 'invalid'}
      InputProps={{ endAdornment }}
    />
  );
}
