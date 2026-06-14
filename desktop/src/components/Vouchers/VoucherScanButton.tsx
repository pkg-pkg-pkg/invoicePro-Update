import { Button } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';

type Props = {
  onClick: () => void;
  disabled?: boolean;
};

export function VoucherScanButton({ onClick, disabled }: Props) {
  return (
    <Button
      variant="outlined"
      size="small"
      startIcon={<QrCodeScannerIcon />}
      onClick={onClick}
      disabled={disabled}
      sx={{ textTransform: 'none', fontWeight: 600 }}
    >
      Scan
    </Button>
  );
}
