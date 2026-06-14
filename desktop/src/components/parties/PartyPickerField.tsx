import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { InputAdornment, TextField, type TextFieldProps } from '@mui/material';

type Props = Omit<TextFieldProps, 'value' | 'onChange'> & {
  displayValue: string;
  onOpen: () => void;
};

/** Read-only text field that opens a party picker modal on click / Enter / Space. */
export function PartyPickerField({ displayValue, onOpen, disabled, placeholder, ...rest }: Props) {
  return (
    <TextField
      {...rest}
      fullWidth
      value={displayValue}
      placeholder={placeholder}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onOpen();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      InputProps={{
        readOnly: true,
        sx: { cursor: disabled ? 'default' : 'pointer' },
        startAdornment: (
          <InputAdornment position="start">
            <PersonOutlineIcon sx={{ color: 'secondary.main', opacity: 0.7 }} fontSize="small" />
          </InputAdornment>
        ),
        ...rest.InputProps,
      }}
    />
  );
}
