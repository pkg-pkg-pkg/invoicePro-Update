import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type {
  Godown,
  InventoryGodownStock,
  InventoryItem,
  InventoryItemType,
  InventoryTaxClass,
  ItemCategory,
  UnitOfMeasure,
} from '../../types/masters';
import { generateId } from '../../utils/id';
import { itemCategoryService } from '../../services/masters/itemCategoryService';

const ADD_CATEGORY = '__add_new_category__';

export type GodownAllocation = {
  godownId: string;
  quantity: string;
};

export type ItemFormValues = {
  name: string;
  itemType: InventoryItemType;
  sku: string;
  hsnCode: string;
  unitId: string;
  upc: string;
  ean: string;
  isbn: string;
  salePrice: string;
  purchasePrice: string;
  gstRate: string;
  taxClass: InventoryTaxClass;
  description: string;
  categoryId: string;
  imageDataUrl: string;
  godownAllocations: GodownAllocation[];
};

const emptyForm = (): ItemFormValues => ({
  name: '',
  itemType: 'BOTH',
  sku: '',
  hsnCode: '',
  unitId: '',
  upc: '',
  ean: '',
  isbn: '',
  salePrice: '',
  purchasePrice: '',
  gstRate: '18',
  taxClass: 'TAXABLE',
  description: '',
  categoryId: '',
  imageDataUrl: '',
  godownAllocations: [{ godownId: '', quantity: '0' }],
});

function itemToForm(item: InventoryItem, defaultGodownId: string): ItemFormValues {
  const stocks = item.godownStocks?.length
    ? item.godownStocks.map((g) => ({ godownId: g.godownId, quantity: String(g.quantity) }))
    : [{ godownId: defaultGodownId, quantity: String(item.currentStock ?? 0) }];
  return {
    name: item.name,
    itemType: item.itemType ?? 'BOTH',
    sku: item.sku,
    hsnCode: item.hsnCode ?? '',
    unitId: item.unitId,
    upc: item.upc ?? item.barcode ?? '',
    ean: item.ean ?? '',
    isbn: item.isbn ?? '',
    salePrice: String(item.pricing?.sale ?? ''),
    purchasePrice: String(item.pricing?.purchase ?? ''),
    gstRate: String(item.gstRate ?? 0),
    taxClass: item.taxClass ?? 'TAXABLE',
    description: item.description ?? '',
    categoryId: item.categoryId ?? '',
    imageDataUrl: item.images?.[0] ?? '',
    godownAllocations: stocks,
  };
}

type Props = {
  open: boolean;
  mode: 'create' | 'edit';
  item?: InventoryItem | null;
  units: UnitOfMeasure[];
  categories: ItemCategory[];
  godowns: Godown[];
  saving?: boolean;
  onClose: () => void;
  onSubmit: (values: ItemFormValues) => void;
  onCategoriesChange?: () => void;
};

export function ItemFormModal({
  open,
  mode,
  item,
  units,
  categories,
  godowns,
  saving,
  onClose,
  onSubmit,
  onCategoriesChange,
}: Props) {
  const [form, setForm] = useState<ItemFormValues>(emptyForm);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);

  const defaultGodownId = useMemo(
    () => godowns.find((g) => g.isDefault)?.id ?? godowns[0]?.id ?? '',
    [godowns]
  );

  useEffect(() => {
    if (!open) return;
    setAddingCategory(false);
    setNewCategoryName('');
    if (mode === 'edit' && item) setForm(itemToForm(item, defaultGodownId));
    else {
      const next = emptyForm();
      next.sku = generateId('SKU').slice(-12).toUpperCase();
      if (units.length === 1) next.unitId = units[0].id;
      const general = categories.find((c) => c.id === 'cat-general') ?? categories[0];
      if (general) next.categoryId = general.id;
      next.godownAllocations = [{ godownId: defaultGodownId, quantity: '0' }];
      setForm(next);
    }
  }, [open, mode, item, units, categories, defaultGodownId]);

  const patch = (p: Partial<ItemFormValues>) => setForm((prev) => ({ ...prev, ...p }));

  const handleImage = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => patch({ imageDataUrl: String(reader.result ?? '') });
    reader.readAsDataURL(file);
  }, []);

  const handleCategoryChange = (value: string) => {
    if (value === ADD_CATEGORY) {
      setAddingCategory(true);
      return;
    }
    setAddingCategory(false);
    patch({ categoryId: value });
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCategorySaving(true);
    try {
      const created = await itemCategoryService.create({ name });
      patch({ categoryId: created.id });
      setAddingCategory(false);
      setNewCategoryName('');
      onCategoriesChange?.();
    } finally {
      setCategorySaving(false);
    }
  };

  const updateGodownRow = (index: number, patchRow: Partial<GodownAllocation>) => {
    setForm((prev) => {
      const rows = [...prev.godownAllocations];
      rows[index] = { ...rows[index], ...patchRow };
      return { ...prev, godownAllocations: rows };
    });
  };

  const addGodownRow = () => {
    setForm((prev) => ({
      ...prev,
      godownAllocations: [...prev.godownAllocations, { godownId: defaultGodownId, quantity: '0' }],
    }));
  };

  const removeGodownRow = (index: number) => {
    setForm((prev) => ({
      ...prev,
      godownAllocations: prev.godownAllocations.filter((_, i) => i !== index),
    }));
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle fontWeight={800}>{mode === 'create' ? 'Add Item' : 'Edit Item'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Item Name" required fullWidth value={form.name} onChange={(e) => patch({ name: e.target.value })} />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Item Type</InputLabel>
              <Select label="Item Type" value={form.itemType} onChange={(e) => patch({ itemType: e.target.value as InventoryItemType })}>
                <MenuItem value="SALES">Sales Items</MenuItem>
                <MenuItem value="PURCHASE">Purchase Items</MenuItem>
                <MenuItem value="BOTH">Both</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Unit</InputLabel>
              <Select label="Unit" value={form.unitId} onChange={(e) => patch({ unitId: e.target.value })}>
                {units.map((u) => (
                  <MenuItem key={u.id} value={u.id}>{u.symbol || u.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="SKU" fullWidth value={form.sku} onChange={(e) => patch({ sku: e.target.value })} />
            <TextField label="HSN Code" fullWidth value={form.hsnCode} onChange={(e) => patch({ hsnCode: e.target.value })} />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Category</InputLabel>
              <Select label="Category" value={addingCategory ? ADD_CATEGORY : form.categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
                <MenuItem value={ADD_CATEGORY}>+ Add New Category</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel>Tax</InputLabel>
              <Select label="Tax" value={form.taxClass} onChange={(e) => patch({ taxClass: e.target.value as InventoryTaxClass })}>
                <MenuItem value="TAXABLE">Taxable</MenuItem>
                <MenuItem value="NON_TAXABLE">Non-Taxable</MenuItem>
                <MenuItem value="EXEMPT">Tax Exempt</MenuItem>
              </Select>
            </FormControl>
            <TextField label="GST %" type="number" fullWidth value={form.gstRate} onChange={(e) => patch({ gstRate: e.target.value })} />
          </Stack>

          {addingCategory ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                fullWidth
                label="New category name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <Button variant="contained" size="small" disabled={categorySaving || !newCategoryName.trim()} onClick={() => void handleCreateCategory()}>
                Add
              </Button>
            </Stack>
          ) : null}

          <Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>Godown / Warehouse</Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addGodownRow} disabled={godowns.length === 0}>
                Add location
              </Button>
            </Stack>
            {godowns.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No godowns found. Add godowns in Settings → Godown Master.
              </Typography>
            ) : (
              form.godownAllocations.map((row, index) => (
                <Stack key={index} direction="row" spacing={1} sx={{ mb: 1 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Godown</InputLabel>
                    <Select
                      label="Godown"
                      value={row.godownId}
                      onChange={(e) => updateGodownRow(index, { godownId: e.target.value })}
                    >
                      {godowns.map((g) => (
                        <MenuItem key={g.id} value={g.id}>
                          {g.name}{g.isDefault ? ' (Default)' : ''}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Stock qty"
                    type="number"
                    sx={{ width: 140 }}
                    value={row.quantity}
                    onChange={(e) => updateGodownRow(index, { quantity: e.target.value })}
                  />
                  <IconButton size="small" onClick={() => removeGodownRow(index)} disabled={form.godownAllocations.length <= 1}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Stack>
              ))
            )}
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="Selling Price (₹)" type="number" fullWidth value={form.salePrice} onChange={(e) => patch({ salePrice: e.target.value })} />
            <TextField label="Purchase Price (₹)" type="number" fullWidth value={form.purchasePrice} onChange={(e) => patch({ purchasePrice: e.target.value })} />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField label="UPC" fullWidth value={form.upc} onChange={(e) => patch({ upc: e.target.value })} />
            <TextField label="EAN" fullWidth value={form.ean} onChange={(e) => patch({ ean: e.target.value })} />
            <TextField label="ISBN" fullWidth value={form.isbn} onChange={(e) => patch({ isbn: e.target.value })} />
          </Stack>

          <TextField label="Description" fullWidth multiline minRows={3} value={form.description} onChange={(e) => patch({ description: e.target.value })} />

          <Box>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
              Item image
            </Typography>
            <Button variant="outlined" component="label" size="small">
              Upload image
              <input type="file" hidden accept="image/*" onChange={(e) => handleImage(e.target.files?.[0] ?? null)} />
            </Button>
            {form.imageDataUrl ? (
              <Box component="img" src={form.imageDataUrl} alt="Preview" sx={{ display: 'block', mt: 1, maxHeight: 120, borderRadius: 1 }} />
            ) : null}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving || !form.name.trim() || !form.sku.trim() || !form.unitId} onClick={() => onSubmit(form)}>
          {saving ? 'Saving…' : mode === 'create' ? 'Create Item' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function formValuesToPayload(values: ItemFormValues): Partial<InventoryItem> {
  const godownStocks: InventoryGodownStock[] = values.godownAllocations
    .filter((row) => row.godownId && Number(row.quantity) >= 0)
    .map((row) => ({ godownId: row.godownId, quantity: Number(row.quantity || 0) }));
  const currentStock = godownStocks.reduce((sum, row) => sum + row.quantity, 0);

  return {
    name: values.name.trim(),
    itemType: values.itemType,
    sku: values.sku.trim(),
    hsnCode: values.hsnCode || null,
    unitId: values.unitId,
    upc: values.upc || null,
    ean: values.ean || null,
    isbn: values.isbn || null,
    categoryId: values.categoryId || null,
    gstRate: Number(values.gstRate || 0),
    taxClass: values.taxClass,
    description: values.description || null,
    pricing: {
      sale: Number(values.salePrice || 0),
      purchase: Number(values.purchasePrice || 0),
    },
    images: values.imageDataUrl ? [values.imageDataUrl] : undefined,
    createdSource: 'USER',
    godownStocks,
    openingStock: currentStock,
    currentStock,
  };
}
