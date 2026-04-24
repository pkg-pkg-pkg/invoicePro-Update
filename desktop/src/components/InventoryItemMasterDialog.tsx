import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InventoryItemForm from '../pages/Masters/InventoryItems/InventoryItemForm';
import { InventoryItem } from '../types/masters';

type InventoryItemMasterDialogProps = {
  open: boolean;
  initialBarcode?: string;
  onClose: () => void;
  onSaved: (item: InventoryItem) => void;
};

/**
 * Full New Inventory Item form inside a dialog (e.g. from Sales Voucher line).
 */
export function InventoryItemMasterDialog({ open, initialBarcode, onClose, onSaved }: InventoryItemMasterDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      sx={{ zIndex: (t) => t.zIndex.modal + 80 }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
        <Typography variant="h6" component="span">
          New inventory item
        </Typography>
        <IconButton aria-label="close" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 1 }}>
        <InventoryItemForm
          initialBarcode={initialBarcode}
          embedded
          onSaved={(item) => {
            onSaved(item);
            onClose();
          }}
          onCancel={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}

export default InventoryItemMasterDialog;
