import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Alert,
} from '@mui/material';
import { InventoryItem, UnitOfMeasure } from '../types/masters';

interface QuickCreateItemDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (item: Partial<InventoryItem>) => void;
  units?: UnitOfMeasure[];
}

const QuickCreateItemDialog: React.FC<QuickCreateItemDialogProps> = ({
  open,
  onClose,
  onSave,
  units = [],
}) => {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    hsnCode: '',
    gstRate: '0',
    unitId: '',
    purchasePrice: '',
    salePrice: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      setError('Item name is required');
      return;
    }
    if (!formData.sku.trim()) {
      setError('SKU is required');
      return;
    }
    if (!formData.hsnCode.trim()) {
      setError('HSN Code is required');
      return;
    }
    if (!formData.unitId) {
      setError('Unit is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      
      const newItem: Partial<InventoryItem> = {
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        hsnCode: formData.hsnCode.trim(),
        gstRate: parseFloat(formData.gstRate) || 0,
        unitId: formData.unitId,
        pricing: {
          purchase: parseFloat(formData.purchasePrice) || 0,
          sale: parseFloat(formData.salePrice) || 0,
        },
        status: 'ACTIVE',
      };

      await onSave(newItem);
      
      // Reset form
      setFormData({
        name: '',
        sku: '',
        hsnCode: '',
        gstRate: '0',
        unitId: '',
        purchasePrice: '',
        salePrice: '',
      });
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create item');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>Add New Item</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Item Name *"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                fullWidth
                required
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="SKU *"
                value={formData.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
                fullWidth
                required
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="HSN Code *"
                value={formData.hsnCode}
                onChange={(e) => handleChange('hsnCode', e.target.value)}
                fullWidth
                required
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="GST Rate (%)"
                type="number"
                value={formData.gstRate}
                onChange={(e) => handleChange('gstRate', e.target.value)}
                fullWidth
                inputProps={{ min: 0, max: 100, step: 0.1 }}
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Unit *"
                select
                value={formData.unitId}
                onChange={(e) => handleChange('unitId', e.target.value)}
                fullWidth
                required
                disabled={saving}
              >
                <MenuItem value="">
                  <em>Select Unit</em>
                </MenuItem>
                {units.map((unit) => (
                  <MenuItem key={unit.id} value={unit.id}>
                    {unit.name} ({unit.symbol})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Purchase Price"
                type="number"
                value={formData.purchasePrice}
                onChange={(e) => handleChange('purchasePrice', e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                disabled={saving}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Sale Price"
                type="number"
                value={formData.salePrice}
                onChange={(e) => handleChange('salePrice', e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: 0.01 }}
                disabled={saving}
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={saving}>
          {saving ? 'Adding...' : 'Add Item'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickCreateItemDialog;
