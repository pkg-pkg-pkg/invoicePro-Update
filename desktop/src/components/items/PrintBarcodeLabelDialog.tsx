import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import type { InventoryItem } from '../../types/masters';
import { BarcodeGenerator } from './BarcodeGenerator';
import { resolvePrintBarcode } from '../../services/barcode/barcodeLookup';

type Props = {
  open: boolean;
  item: Pick<InventoryItem, 'name' | 'sku' | 'barcode' | 'pricing'> | null;
  onClose: () => void;
};

export function PrintBarcodeLabelDialog({ open, item, onClose }: Props) {
  if (!item) return null;
  const code = resolvePrintBarcode(item);
  const mrp = item.pricing?.mrp != null ? String(item.pricing.mrp) : undefined;
  const sale = item.pricing?.sale != null ? String(item.pricing.sale) : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Print barcode label?</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Item saved successfully. Print a label for scanning at the counter or warehouse.
          </Typography>
          {code ? (
            <BarcodeGenerator
              barcode={code}
              itemName={item.name}
              sku={item.sku}
              price={sale}
              mrp={mrp}
            />
          ) : (
            <Typography variant="body2" color="text.secondary">
              No barcode assigned to this item.
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
