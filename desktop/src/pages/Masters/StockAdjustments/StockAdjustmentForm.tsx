import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { stockAdjustmentService } from '../../../services/masters/stockAdjustmentService';
import { inventoryItemService } from '../../../services/masters/inventoryItemService';
import { godownService } from '../../../services/masters/godownService';
import { Godown, InventoryItem, StockAdjustmentType } from '../../../types/masters';
import { usePermission } from '../../../hooks/usePermission';

export default function StockAdjustmentForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can } = usePermission();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [itemId, setItemId] = useState('');
  const [godownId, setGodownId] = useState('');
  const [type, setType] = useState<StockAdjustmentType>('ADJUSTMENT');
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [quantity, setQuantity] = useState('');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([
      inventoryItemService.list({ status: 'ACTIVE' }),
      godownService.list({ includeInactive: false }),
    ]).then(([itemRows, godownRows]) => {
      setItems(itemRows);
      setGodowns(godownRows);
      if (godownRows.length === 1) setGodownId(godownRows[0].id);
      const prefill = searchParams.get('itemId');
      if (prefill && itemRows.some((i) => i.id === prefill)) setItemId(prefill);
      setLoading(false);
    });
  }, [searchParams]);

  const handleSave = useCallback(async () => {
    if (!can('manage-inventory')) return;
    setSaving(true);
    setError(null);
    try {
      await stockAdjustmentService.create(
        {
          itemId,
          godownId: godownId || null,
          type,
          quantity: Number(quantity),
          value: Number(value || 0),
          reason,
          date: new Date(date).toISOString(),
        },
        { direction }
      );
      navigate('/masters/stock-adjustments');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [can, date, direction, godownId, itemId, navigate, quantity, reason, type, value]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={800} sx={{ mb: 2 }}>
        New Stock Adjustment
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Stock and ledger posting update automatically — same as voucher-based inventory.
      </Typography>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Stack spacing={2} sx={{ maxWidth: 520 }}>
        <FormControl fullWidth>
          <InputLabel>Item</InputLabel>
          <Select label="Item" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            {items.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name} — stock {item.currentStock}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Godown</InputLabel>
          <Select label="Godown" value={godownId} onChange={(e) => setGodownId(e.target.value)}>
            <MenuItem value="">Default / single godown</MenuItem>
            {godowns.map((g) => (
              <MenuItem key={g.id} value={g.id}>
                {g.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as StockAdjustmentType)}>
            <MenuItem value="ADJUSTMENT">Adjustment</MenuItem>
            <MenuItem value="OPENING">Opening stock</MenuItem>
          </Select>
        </FormControl>

        {type === 'ADJUSTMENT' ? (
          <FormControl fullWidth>
            <InputLabel>Direction</InputLabel>
            <Select label="Direction" value={direction} onChange={(e) => setDirection(e.target.value as 'INCREASE' | 'DECREASE')}>
              <MenuItem value="INCREASE">Increase stock</MenuItem>
              <MenuItem value="DECREASE">Decrease stock</MenuItem>
            </Select>
          </FormControl>
        ) : null}

        <TextField label="Quantity" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
        <TextField label="Value (₹)" type="number" value={value} onChange={(e) => setValue(e.target.value)} />
        <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} />

        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={saving || !can('manage-inventory')} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save adjustment'}
          </Button>
          <Button variant="outlined" onClick={() => navigate('/masters/stock-adjustments')}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
