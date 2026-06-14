import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
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
import {
  Godown,
  InventoryItem,
  StockAdjustmentReasonType,
  StockAdjustmentType,
} from '../../../types/masters';
import { usePermission } from '../../../hooks/usePermission';
import {
  directionForReasonType,
  STOCK_ADJUSTMENT_REASON_OPTIONS,
} from '../../../constants/stockAdjustmentReasons';

const VALUE_HELPER =
  'This value excludes GST and represents the Stock Asset (inventory) value. GST is not part of this value.';

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseNum(raw: string): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function availableStockForGodown(item: InventoryItem | null, godownId: string): number {
  if (!item) return 0;
  if (godownId && item.godownStocks?.length) {
    const row = item.godownStocks.find((g) => g.godownId === godownId);
    return Number(row?.quantity ?? 0);
  }
  return Number(item.currentStock ?? 0);
}

export default function StockAdjustmentForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can } = usePermission();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [itemId, setItemId] = useState('');
  const [godownId, setGodownId] = useState('');
  const [type, setType] = useState<StockAdjustmentType>('ADJUSTMENT');
  const [reasonType, setReasonType] = useState<StockAdjustmentReasonType | ''>('');
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('INCREASE');
  const [quantity, setQuantity] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastValueDriver = useRef<'rate' | 'total' | null>(null);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === itemId) ?? null,
    [items, itemId]
  );

  const autoDirection = type === 'ADJUSTMENT' ? directionForReasonType(reasonType) : 'INCREASE';
  const directionLocked = type === 'ADJUSTMENT' && Boolean(autoDirection);
  const effectiveDirection = directionLocked ? autoDirection! : direction;

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

  useEffect(() => {
    if (autoDirection) setDirection(autoDirection);
  }, [autoDirection]);

  const handleQuantityChange = useCallback(
    (raw: string) => {
      setQuantity(raw);
      const q = parseNum(raw);
      if (!Number.isFinite(q) || q <= 0) return;

      if (lastValueDriver.current === 'rate') {
        const r = parseNum(ratePerUnit);
        if (Number.isFinite(r) && r >= 0) setTotalValue(String(round2(q * r)));
      } else if (lastValueDriver.current === 'total') {
        const t = parseNum(totalValue);
        if (Number.isFinite(t) && t >= 0) setRatePerUnit(String(round2(t / q)));
      } else {
        const r = parseNum(ratePerUnit);
        const t = parseNum(totalValue);
        if (Number.isFinite(r) && r > 0) setTotalValue(String(round2(q * r)));
        else if (Number.isFinite(t) && t > 0) setRatePerUnit(String(round2(t / q)));
      }
    },
    [ratePerUnit, totalValue]
  );

  const handleRateChange = useCallback(
    (raw: string) => {
      lastValueDriver.current = 'rate';
      setRatePerUnit(raw);
      const q = parseNum(quantity);
      const r = parseNum(raw);
      if (Number.isFinite(q) && q > 0 && Number.isFinite(r) && r >= 0) {
        setTotalValue(String(round2(q * r)));
      }
    },
    [quantity]
  );

  const handleTotalChange = useCallback(
    (raw: string) => {
      lastValueDriver.current = 'total';
      setTotalValue(raw);
      const q = parseNum(quantity);
      const t = parseNum(raw);
      if (Number.isFinite(q) && q > 0 && Number.isFinite(t) && t >= 0) {
        setRatePerUnit(String(round2(t / q)));
      }
    },
    [quantity]
  );

  const stockWarning = useMemo(() => {
    if (type !== 'ADJUSTMENT' || effectiveDirection !== 'DECREASE') return null;
    const q = parseNum(quantity);
    if (!Number.isFinite(q) || q <= 0 || !selectedItem) return null;
    const available = availableStockForGodown(selectedItem, godownId);
    if (q <= available) return null;
    return {
      available,
      requested: q,
      negativeBy: round2(q - available),
    };
  }, [type, effectiveDirection, quantity, selectedItem, godownId]);

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
          reasonType: type === 'ADJUSTMENT' ? reasonType || null : null,
          direction: effectiveDirection,
          quantity: Number(quantity),
          ratePerUnit: ratePerUnit ? Number(ratePerUnit) : null,
          value: Number(totalValue || 0),
          notes,
          date: new Date(date).toISOString(),
        },
        { direction: effectiveDirection }
      );
      navigate('/masters/stock-adjustments');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [
    can,
    date,
    effectiveDirection,
    godownId,
    itemId,
    navigate,
    notes,
    quantity,
    ratePerUnit,
    reasonType,
    totalValue,
    type,
  ]);

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
        Adjust on-hand quantity and post the Excl.-GST stock asset value to the ledger. No GST is applied on
        adjustments.
      </Typography>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {stockWarning ? (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            Negative stock warning
          </Typography>
          <Typography variant="body2">
            Available {stockWarning.available.toFixed(2)} in selected godown, requested{' '}
            {stockWarning.requested.toFixed(2)} — stock will go negative by{' '}
            {stockWarning.negativeBy.toFixed(2)} after save.
          </Typography>
        </Alert>
      ) : null}

      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        <FormControl fullWidth required>
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
          <Select
            label="Type"
            value={type}
            onChange={(e) => {
              const next = e.target.value as StockAdjustmentType;
              setType(next);
              if (next === 'OPENING') {
                setReasonType('');
                setDirection('INCREASE');
              }
            }}
          >
            <MenuItem value="ADJUSTMENT">Adjustment</MenuItem>
            <MenuItem value="OPENING">Opening stock</MenuItem>
          </Select>
        </FormControl>

        {type === 'ADJUSTMENT' ? (
          <FormControl fullWidth required>
            <InputLabel>Reason Type</InputLabel>
            <Select
              label="Reason Type"
              value={reasonType}
              onChange={(e) => setReasonType(e.target.value as StockAdjustmentReasonType)}
            >
              {STOCK_ADJUSTMENT_REASON_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        {type === 'ADJUSTMENT' ? (
          <FormControl fullWidth disabled={directionLocked}>
            <InputLabel>Direction</InputLabel>
            <Select
              label="Direction"
              value={effectiveDirection}
              onChange={(e) => setDirection(e.target.value as 'INCREASE' | 'DECREASE')}
            >
              <MenuItem value="INCREASE">Increase stock</MenuItem>
              <MenuItem value="DECREASE">Decrease stock</MenuItem>
            </Select>
            {directionLocked ? (
              <FormHelperText>
                Direction: {effectiveDirection === 'INCREASE' ? 'Increase Stock' : 'Decrease Stock'} (auto-set
                based on Reason Type)
              </FormHelperText>
            ) : (
              <FormHelperText>Select direction manually for &quot;Other&quot; reason type.</FormHelperText>
            )}
          </FormControl>
        ) : null}

        <TextField
          label="Quantity"
          type="number"
          value={quantity}
          onChange={(e) => handleQuantityChange(e.target.value)}
          required
          inputProps={{ min: 0, step: '0.01' }}
        />

        <TextField
          label="Rate per Unit (Excl. GST) — Stock Asset Value (₹)"
          type="number"
          value={ratePerUnit}
          onChange={(e) => handleRateChange(e.target.value)}
          inputProps={{ min: 0, step: '0.01' }}
          helperText={VALUE_HELPER}
        />

        <TextField
          label="Total Value (Excl. GST) — Stock Asset (₹)"
          type="number"
          value={totalValue}
          onChange={(e) => handleTotalChange(e.target.value)}
          inputProps={{ min: 0, step: '0.01' }}
          helperText={VALUE_HELPER}
        />

        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />

        <TextField
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          minRows={2}
          required={type === 'ADJUSTMENT' && reasonType === 'OTHER'}
          placeholder="Additional details (e.g. employee name, FIR number, damage description)"
          helperText={
            type === 'ADJUSTMENT' && reasonType === 'OTHER'
              ? 'Required when reason type is Other.'
              : 'Optional additional details.'
          }
        />

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
