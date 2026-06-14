import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';

type Props = {
  open: boolean;
  barcode: string;
  itemName: string;
  sku: string;
  onOpenExisting: () => void;
  onCancel: () => void;
};

export function BarcodeDuplicateDialog({
  open,
  barcode,
  itemName,
  sku,
  onOpenExisting,
  onCancel,
}: Props) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Barcode already exists</DialogTitle>
      <DialogContent>
        <DialogContentText component="div">
          <Stack spacing={1}>
            <Typography variant="body2">
              Barcode: <strong>{barcode}</strong>
            </Typography>
            <Typography variant="body2">
              Item: <strong>{itemName}</strong>
            </Typography>
            <Typography variant="body2">
              SKU: <strong>{sku}</strong>
            </Typography>
          </Stack>
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="contained" onClick={onOpenExisting}>
          Open Existing Item
        </Button>
      </DialogActions>
    </Dialog>
  );
}
