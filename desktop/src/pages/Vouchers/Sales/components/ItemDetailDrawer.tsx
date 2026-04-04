import { FC, useMemo } from 'react';
import {
  Box,
  Button,
  Divider,
  Drawer,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { VoucherMode } from './InvoiceHeader';
import { InventoryItem, Godown } from '../../../../types/masters';

export interface ItemDetailFormValues {
  lineId: string;
  itemId: string;
  quantity: string;
  rateExclusive: string;
  rateInclusive: string;
  taxRate: string;
  hsnCode?: string;
  discountPercent?: string;
  discountAmount?: string;
  batchNumber?: string;
  godownId: string;
}

interface ItemDetailDrawerProps {
  mode: VoucherMode;
  open: boolean;
  line: ItemDetailFormValues | null;
  inventoryItems: InventoryItem[];
  godowns: Godown[];
  onChange: (patch: Partial<ItemDetailFormValues>) => void;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  showValidation?: boolean;
  errors?: Partial<Record<keyof ItemDetailFormValues, string>>;
  isEditing?: boolean;
}

const computeInclusiveFromExclusive = (exclusive: number, taxRate: number) => {
  if (!Number.isFinite(exclusive) || !Number.isFinite(taxRate)) return exclusive;
  return exclusive * (1 + taxRate / 100);
};

const computeExclusiveFromInclusive = (inclusive: number, taxRate: number) => {
  if (!Number.isFinite(inclusive) || !Number.isFinite(taxRate)) return inclusive;
  return inclusive / (1 + taxRate / 100);
};

const ItemDetailDrawer: FC<ItemDetailDrawerProps> = ({
  mode,
  open,
  line,
  inventoryItems,
  godowns,
  onChange,
  onClose,
  onSave,
  saving = false,
  showValidation = false,
  errors = {},
  isEditing = false,
}) => {
  if (!line) {
    return null;
  }

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const selectedItem = useMemo(() => inventoryItems.find((item) => item.id === line.itemId), [inventoryItems, line.itemId]);
  const effectiveHsn = line.hsnCode ?? selectedItem?.hsnCode ?? '';

  const handleItemChange = (itemId: string) => {
    const item = inventoryItems.find((inv) => inv.id === itemId);
    onChange({
      itemId,
      taxRate: item ? String(item.gstRate ?? '') : line.taxRate,
      hsnCode: item?.hsnCode ?? line.hsnCode,
    });
  };

  const handleRateExclusiveChange = (value: string) => {
    if (value === '') {
      onChange({ rateExclusive: '', rateInclusive: '' });
      return;
    }
    const exclusive = Number(value);
    const taxRate = Number(line.taxRate || selectedItem?.gstRate || 0);
    const inclusive = computeInclusiveFromExclusive(exclusive, taxRate);
    onChange({
      rateExclusive: value,
      rateInclusive: Number.isFinite(inclusive) ? inclusive.toFixed(2) : line.rateInclusive,
    });
  };

  const handleRateInclusiveChange = (value: string) => {
    if (value === '') {
      onChange({ rateInclusive: '', rateExclusive: '' });
      return;
    }
    const inclusive = Number(value);
    const taxRate = Number(line.taxRate || selectedItem?.gstRate || 0);
    const exclusive = computeExclusiveFromInclusive(inclusive, taxRate);
    onChange({
      rateInclusive: value,
      rateExclusive: Number.isFinite(exclusive) ? exclusive.toFixed(2) : line.rateExclusive,
    });
  };

  const handleTaxRateChange = (value: string) => {
    const rateNumber = Number(value);
    if (!Number.isFinite(rateNumber)) {
      onChange({ taxRate: value });
      return;
    }

    if (line.rateExclusive) {
      const exclusive = Number(line.rateExclusive);
      const inclusive = computeInclusiveFromExclusive(exclusive, rateNumber);
      onChange({
        taxRate: value,
        rateInclusive: Number.isFinite(inclusive) ? inclusive.toFixed(2) : line.rateInclusive,
      });
      return;
    }

    if (line.rateInclusive) {
      const inclusive = Number(line.rateInclusive);
      const exclusive = computeExclusiveFromInclusive(inclusive, rateNumber);
      onChange({
        taxRate: value,
        rateExclusive: Number.isFinite(exclusive) ? exclusive.toFixed(2) : line.rateExclusive,
      });
      return;
    }

    onChange({ taxRate: value });
  };

  const disabled = mode === 'view';

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', md: '720px' },
          maxWidth: '100%',
          padding: 3,
        },
      }}
    >
      <Stack spacing={3} sx={{ height: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" fontWeight={600}>
              {line.itemId ? 'Edit Item' : 'Add Item'}
            </Typography>
            {selectedItem && (
              <Typography variant="body2" color="text.secondary">
                {selectedItem.sku && `${selectedItem.sku} · `}GST {selectedItem.gstRate}%
              </Typography>
            )}
          </Box>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
        </Stack>

        <Divider />

        <Grid container spacing={2} sx={{ flex: 1, overflowY: 'auto', pr: 1 }}>
          <Grid item xs={12}>
            <TextField
              select
              label="Item"
              value={line.itemId}
              onChange={(e) => handleItemChange(e.target.value)}
              fullWidth
              disabled={disabled}
              error={showValidation && Boolean(errors.itemId)}
              helperText={showValidation ? errors.itemId : ''}
            >
              <MenuItem value="">
                <em>Select Item</em>
              </MenuItem>
              {inventoryItems.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  {item.name} {item.sku ? `(${item.sku})` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Quantity"
              type="number"
              value={line.quantity}
              onChange={(e) => onChange({ quantity: e.target.value })}
              inputProps={{ min: 0, step: '0.001' }}
              fullWidth
              disabled={disabled}
              error={showValidation && Boolean(errors.quantity)}
              helperText={showValidation ? errors.quantity : ''}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              select
              label="Godown"
              value={line.godownId}
              onChange={(e) => onChange({ godownId: e.target.value })}
              fullWidth
              disabled={disabled}
              error={showValidation && Boolean(errors.godownId)}
              helperText={showValidation ? errors.godownId : ''}
            >
              <MenuItem value="">
                <em>Select Godown</em>
              </MenuItem>
              {godowns.map((godown) => (
                <MenuItem key={godown.id} value={godown.id}>
                  {godown.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Rate (Pre-GST)"
              type="number"
              value={line.rateExclusive}
              onChange={(e) => handleRateExclusiveChange(e.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
              disabled={disabled}
              error={showValidation && Boolean(errors.rateExclusive)}
              helperText={showValidation ? errors.rateExclusive : ''}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Rate (Incl. GST)"
              type="number"
              value={line.rateInclusive}
              onChange={(e) => handleRateInclusiveChange(e.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
              disabled={disabled}
              error={showValidation && Boolean(errors.rateInclusive)}
              helperText={showValidation ? errors.rateInclusive : ''}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="GST %"
              type="number"
              value={line.taxRate}
              onChange={(e) => handleTaxRateChange(e.target.value)}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
              disabled={disabled}
              error={showValidation && Boolean(errors.taxRate)}
              helperText={showValidation ? errors.taxRate : ''}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="HSN / SAC"
              value={effectiveHsn}
              onChange={(e) => onChange({ hsnCode: e.target.value })}
              fullWidth
              disabled={disabled}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Discount %"
              type="number"
              value={line.discountPercent || ''}
              onChange={(e) => onChange({ discountPercent: e.target.value })}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
              disabled={disabled}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="Discount Amount"
              type="number"
              value={line.discountAmount || ''}
              onChange={(e) => onChange({ discountAmount: e.target.value })}
              inputProps={{ min: 0, step: '0.01' }}
              fullWidth
              disabled={disabled}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Batch / Lot"
              value={line.batchNumber || ''}
              onChange={(e) => onChange({ batchNumber: e.target.value })}
              fullWidth
              disabled={disabled}
            />
          </Grid>
        </Grid>

        <Divider />

        <Stack direction={isMobile ? 'column' : 'row'} spacing={2} justifyContent="flex-end">
          <Button variant="outlined" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={onSave} disabled={saving || disabled}>
            {isEditing ? 'Save Item' : 'Add Item'}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
};

export default ItemDetailDrawer;
