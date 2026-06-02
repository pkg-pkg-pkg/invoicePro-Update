import { useEffect } from 'react';
import {
  CircularProgress,
  InputAdornment,
  TextField,
  type TextFieldProps,
} from '@mui/material';
import type { UsePincodeAutofillReturn } from '../hooks/usePincodeAutofill';

type Props = Omit<TextFieldProps, 'value' | 'onChange' | 'error'> & {
  value: string;
  onPinChange: (pin: string) => void;
  autofill: UsePincodeAutofillReturn;
  validationError?: boolean;
};

/** PIN field with loading spinner and API lookup wired via `usePincodeAutofill`. */
export default function PincodeTextField({
  value,
  onPinChange,
  autofill,
  validationError,
  helperText,
  InputProps,
  inputProps,
  ...rest
}: Props) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
    onPinChange(pin);
    void autofill.onPincodeInput(pin);
  };

  // Auto-fill when PIN is pre-populated (e.g. party already has pincode on modal open).
  useEffect(() => {
    const pin = value.replace(/\D/g, '').slice(0, 6);
    if (pin.length !== 6) return;
    const timer = window.setTimeout(() => {
      void autofill.onPincodeInput(pin);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [value, autofill.onPincodeInput]);

  const mergedHelper = autofill.mergePincodeHelper(
    typeof helperText === 'string' ? helperText : undefined
  );

  return (
    <TextField
      {...rest}
      value={value}
      onChange={handleChange}
      error={validationError || autofill.pincodeFieldError}
      helperText={mergedHelper || helperText}
      inputProps={{
        inputMode: 'numeric',
        maxLength: 6,
        ...inputProps,
      }}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <>
            {autofill.loading ? (
              <InputAdornment position="end">
                <CircularProgress size={18} color="inherit" />
              </InputAdornment>
            ) : null}
            {InputProps?.endAdornment}
          </>
        ),
      }}
    />
  );
}
