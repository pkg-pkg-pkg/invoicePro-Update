import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import { priceListService } from '../../../services/masters/priceListService';
import { useActiveInventoryItems } from '../../../hooks/useActiveInventoryItems';
import type { InventoryItem, PriceListPricingType } from '../../../types/masters';
import { usePermission } from '../../../hooks/usePermission';
import {
  baseFromSelling,
  sellingFromBase,
} from '../../../utils/priceListPricing';

type RowState = {
  key: string;
  itemId: string;
  basePrice: number;
  gstRate: number;
  sellingPrice: number;
  discountPercent: number | null;
};

function itemLabel(item: InventoryItem) {
  return `${item.name}${item.sku ? ` (${item.sku})` : ''}`;
}

export default function PriceListForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { can } = usePermission();
  const { items, loading: itemsLoading, reload: reloadItems } = useActiveInventoryItems();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pricingType, setPricingType] = useState<PriceListPricingType>('EXCLUSIVE');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [active, setActive] = useState(true);
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itemMap = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const buildRowFromItem = useCallback(
    (item: InventoryItem, entry?: { sellingPrice?: number; basePrice?: number | null; gstRate?: number | null; discountPercent?: number | null; rate?: number }) => {
      const gstRate = Number(entry?.gstRate ?? item.gstRate ?? 0);
      const base = Number(entry?.basePrice ?? item.pricing?.sale ?? 0);
      const selling = Number(
        entry?.sellingPrice ?? entry?.rate ?? sellingFromBase(base, gstRate, pricingType)
      );
      return {
        key: `row-${item.id}-${Date.now()}`,
        itemId: item.id,
        basePrice: base,
        gstRate,
        sellingPrice: selling,
        discountPercent: entry?.discountPercent ?? null,
      } satisfies RowState;
    },
    [pricingType]
  );

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const pl = await priceListService.getById(id);
        if (!pl) throw new Error('Price list not found');
        if (cancelled) return;
        setName(pl.name);
        setDescription(pl.description ?? '');
        setPricingType(pl.pricingType ?? 'EXCLUSIVE');
        setEffectiveFrom(pl.effectiveFrom?.slice(0, 10) ?? '');
        setEffectiveTo(pl.effectiveTo?.slice(0, 10) ?? '');
        setActive(pl.status !== 'INACTIVE');
        setRows(
          pl.entries.map((e, i) => {
            const item = itemMap.get(e.itemId);
            const gstRate = Number(e.gstRate ?? item?.gstRate ?? 0);
            const selling = Number(e.sellingPrice ?? e.rate ?? 0);
            const base = Number(e.basePrice ?? baseFromSelling(selling, gstRate, pl.pricingType ?? 'EXCLUSIVE'));
            return {
              key: `${e.itemId}-${i}`,
              itemId: e.itemId,
              basePrice: base,
              gstRate,
              sellingPrice: selling,
              discountPercent: e.discountPercent ?? null,
            };
          })
        );
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, itemMap]);

  useEffect(() => {
    setRows((prev) =>
      prev.map((row) => {
        if (!row.itemId) return row;
        const selling = sellingFromBase(row.basePrice, row.gstRate, pricingType);
        return { ...row, sellingPrice: selling };
      })
    );
  }, [pricingType]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        itemId: '',
        basePrice: 0,
        gstRate: 0,
        sellingPrice: 0,
        discountPercent: null,
      },
    ]);
  };

  const updateRow = (key: string, patch: Partial<RowState>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...patch };
        if (patch.itemId && patch.itemId !== r.itemId) {
          const item = itemMap.get(patch.itemId);
          if (item) {
            return buildRowFromItem(item);
          }
        }
        if (patch.basePrice !== undefined || patch.gstRate !== undefined) {
          next.sellingPrice = sellingFromBase(next.basePrice, next.gstRate, pricingType);
        }
        if (patch.sellingPrice !== undefined) {
          next.basePrice = baseFromSelling(next.sellingPrice, next.gstRate, pricingType);
        }
        return { ...next, key: r.key };
      })
    );
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const handleSave = useCallback(async () => {
    if (!can('manage-inventory')) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        description,
        pricingType,
        effectiveFrom: effectiveFrom || null,
        effectiveTo: effectiveTo || null,
        status: active ? ('ACTIVE' as const) : ('INACTIVE' as const),
        entries: rows
          .filter((r) => r.itemId)
          .map(({ itemId, basePrice, gstRate, sellingPrice, discountPercent }) => ({
            itemId,
            basePrice,
            gstRate,
            sellingPrice,
            discountPercent,
          })),
      };
      if (isEdit && id) {
        await priceListService.update(id, payload);
      } else {
        await priceListService.create(payload);
      }
      navigate('/masters/price-lists');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [active, can, description, effectiveFrom, effectiveTo, id, isEdit, name, navigate, pricingType, rows]);

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
        {isEdit ? 'Edit Price List' : 'New Price List'}
      </Typography>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}
      {itemsLoading ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Loading items from Item Master…
        </Alert>
      ) : items.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 2 }} action={<Button size="small" onClick={() => void reloadItems()}>Reload</Button>}>
          No active items in Item Master. Create items first, then add them to this price list.
        </Alert>
      ) : null}

      <Stack spacing={2.5} sx={{ maxWidth: 1200 }}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>
            Price list master
          </Typography>
          <Stack spacing={2}>
            <TextField label="Price list name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />
            <TextField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Effective from"
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Effective to"
                type="date"
                value={effectiveTo}
                onChange={(e) => setEffectiveTo(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <FormControlLabel
                control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />}
                label={active ? 'Active' : 'Inactive'}
                sx={{ minWidth: 120, mt: { sm: 1 } }}
              />
            </Stack>
            <FormControl>
              <FormLabel>Pricing type</FormLabel>
              <RadioGroup
                row
                value={pricingType}
                onChange={(e) => setPricingType(e.target.value as PriceListPricingType)}
              >
                <FormControlLabel value="EXCLUSIVE" control={<Radio />} label="GST Exclusive" />
                <FormControlLabel value="INCLUSIVE" control={<Radio />} label="GST Inclusive" />
              </RadioGroup>
              <Typography variant="caption" color="text.secondary">
                Exclusive: selling price = base (GST added at invoice). Inclusive: selling price includes GST.
              </Typography>
            </FormControl>
          </Stack>
        </Paper>

        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle1" fontWeight={700}>
            Price list items
          </Typography>
          <Button startIcon={<AddIcon />} onClick={addRow} size="small" disabled={items.length === 0}>
            Add row
          </Button>
        </Stack>

        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ minWidth: 220 }}>Item</TableCell>
                <TableCell>SKU</TableCell>
                <TableCell>HSN</TableCell>
                <TableCell align="right">Base price</TableCell>
                <TableCell align="right">GST %</TableCell>
                <TableCell>Price type</TableCell>
                <TableCell align="right">Selling price</TableCell>
                <TableCell align="right">Discount %</TableCell>
                <TableCell width={48} />
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => {
                const item = row.itemId ? itemMap.get(row.itemId) : undefined;
                return (
                  <TableRow key={row.key}>
                    <TableCell>
                      <Autocomplete
                        size="small"
                        options={items}
                        getOptionLabel={itemLabel}
                        value={item ?? null}
                        onChange={(_e, v) => updateRow(row.key, { itemId: v?.id ?? '' })}
                        renderInput={(params) => <TextField {...params} label="Item" />}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                      />
                    </TableCell>
                    <TableCell>{item?.sku || '—'}</TableCell>
                    <TableCell>{item?.hsnCode || '—'}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.basePrice}
                        onChange={(e) => updateRow(row.key, { basePrice: Number(e.target.value) })}
                        inputProps={{ min: 0, step: '0.01' }}
                        sx={{ width: 110 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.gstRate}
                        onChange={(e) => updateRow(row.key, { gstRate: Number(e.target.value) })}
                        inputProps={{ min: 0, step: '0.01' }}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" fontWeight={700}>
                        {pricingType === 'INCLUSIVE' ? 'Inclusive' : 'Exclusive'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.sellingPrice}
                        onChange={(e) => updateRow(row.key, { sellingPrice: Number(e.target.value) })}
                        inputProps={{ min: 0, step: '0.01' }}
                        sx={{ width: 110 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={row.discountPercent ?? ''}
                        onChange={(e) =>
                          updateRow(row.key, {
                            discountPercent: e.target.value === '' ? null : Number(e.target.value),
                          })
                        }
                        inputProps={{ min: 0, max: 100, step: '0.01' }}
                        sx={{ width: 90 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => removeRow(row.key)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    Click &quot;Add row&quot; to add items from Item Master.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Box>

        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={saving || !can('manage-inventory')} onClick={() => void handleSave()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outlined" onClick={() => navigate('/masters/price-lists')}>
            Cancel
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
