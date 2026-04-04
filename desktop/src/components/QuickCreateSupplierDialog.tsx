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

interface QuickCreateSupplierDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (supplierName: string) => void;
}

const QuickCreateSupplierDialog: FC<QuickCreateSupplierDialogProps> = ({
  open,
  onClose,
  onSave,
}) => {
  const [supplierName, setSupplierName] = useState('');
  const [error, setError] = useState('');

  const handleSave = () => {
    const trimmed = supplierName.trim();
    if (!trimmed) {
      setError('Supplier name is required');
      return;
    }
    onSave(trimmed);
    setSupplierName('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setSupplierName('');
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Quick Add Supplier</Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Enter supplier name to quickly create a new supplier. You can add more details later from the Masters menu.
          </Typography>
          <TextField
            label="Supplier Name"
            value={supplierName}
            onChange={(e) => {
              setSupplierName(e.target.value);
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

export default QuickCreateSupplierDialog;
