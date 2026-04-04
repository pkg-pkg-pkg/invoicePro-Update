import { FC, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
  Typography,
  IconButton,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface QuickCreateCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (customerName: string) => void;
}

const QuickCreateCustomerDialog: FC<QuickCreateCustomerDialogProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmed = customerName.trim();
    if (!trimmed) {
      setError('Customer name is required');
      return;
    }
    onSave(trimmed);
    setCustomerName('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setCustomerName('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Quick Add Customer</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Enter customer name to quickly create a new customer. You can add more details later from the Masters menu.
          </Typography>
          <TextField
            label="Customer Name"
            value={customerName}
            onChange={(e) => {
              setCustomerName(e.target.value);
              setError('');
            }}
            error={!!error}
            helperText={error}
            fullWidth
            autoFocus
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSave();
              }
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save & Select
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickCreateCustomerDialog;
