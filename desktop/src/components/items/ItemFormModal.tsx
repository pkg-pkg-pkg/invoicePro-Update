import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
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
  InventoryStatus,
  InventoryTaxClass,
  ItemCategory,
  UnitOfMeasure,
} from '../../types/masters';
import { generateId } from '../../utils/id';
import { generateUniqueNumericBarcode } from '../../services/barcode/barcodeAllocationService';
import BarcodeScanner from '../scanner/BarcodeScanner';
import { itemCategoryService } from '../../services/masters/itemCategoryService';
import { godownService } from '../../services/masters/godownService';
import { inventoryItemService } from '../../services/masters/inventoryItemService';
import { itemsApi } from '../../services/items/itemsApi';
import { readInventorySettings } from '../../services/inventory/lowStockSettings';
import { BrandGroupField } from './BrandGroupField';
import { BarcodeGenerator } from './BarcodeGenerator';
import { PrintBarcodeLabelDialog } from './PrintBarcodeLabelDialog';
import { BarcodeDuplicateDialog } from './BarcodeDuplicateDialog';
import {
  isBarcodeDuplicateError,
  lookupBarcodeDuplicate,
} from '../../services/barcode/barcodeUniqueness';
import {
  formatAdditionalBarcodesForExport,
  parseAdditionalBarcodes,
  validateBarcodeList,
} from '../../services/barcode/barcodeValidation';

const ADD_CATEGORY = '__add_new_category__';
const NESTED_DIALOG_SX = { zIndex: 5000 };
const SELECT_MENU_Z = { MenuProps: { PaperProps: { sx: { zIndex: 5000 } } } } as const;

export type GodownAllocation = {
  godownId: string;
  quantity: string;
};

export type ItemFormValues = {
  name: string;
  itemType: InventoryItemType;
  brand: string;
  categoryId: string;
  status: InventoryStatus;
  sku: string;
  hsnCode: string;
  barcode: string;
  additionalBarcodes: string;
  barcodeChangeReason: string;
  upc: string;
  ean: string;
  isbn: string;
  unitId: string;
  secondaryUnitId: string;
  conversionRatio: string;
  taxClass: InventoryTaxClass;
  gstRate: string;
  trackBatch: boolean;
  trackSerial: boolean;
  trackExpiry: boolean;
  purchasePrice: string;
  salePrice: string;
  mrp: string;
  wholesalePrice: string;
  distributorPrice: string;
  godownAllocations: GodownAllocation[];
  openingStock: string;
  openingValue: string;
  reorderLevel: string;
  description: string;
  imageDataUrl: string;
};

const globalDefaultThreshold = () => String(readInventorySettings().globalLowStockThreshold);

const emptyForm = (): ItemFormValues => ({
  name: '',
  itemType: 'BOTH',
  brand: '',
  categoryId: '',
  status: 'ACTIVE',
  sku: '',
  hsnCode: '',
  barcode: '',
  additionalBarcodes: '',
  barcodeChangeReason: '',
  upc: '',
  ean: '',
  isbn: '',
  unitId: '',
  secondaryUnitId: '',
  conversionRatio: '',
  taxClass: 'TAXABLE',
  gstRate: '18',
  trackBatch: false,
  trackSerial: false,
  trackExpiry: false,
  purchasePrice: '',
  salePrice: '',
  mrp: '',
  wholesalePrice: '',
  distributorPrice: '',
  godownAllocations: [{ godownId: '', quantity: '0' }],
  openingStock: '0',
  openingValue: '0',
  reorderLevel: '',
  description: '',
  imageDataUrl: '',
});

function itemToForm(item: InventoryItem, defaultGodownId: string): ItemFormValues {
  const stocks = item.godownStocks?.length
    ? item.godownStocks.map((g) => ({ godownId: g.godownId, quantity: String(g.quantity) }))
    : [{ godownId: defaultGodownId, quantity: String(item.currentStock ?? 0) }];
  return {
    name: item.name,
    itemType: item.itemType ?? 'BOTH',
    brand: item.brand ?? '',
    categoryId: item.categoryId ?? '',
    status: item.status,
    sku: item.sku,
    hsnCode: item.hsnCode ?? '',
    barcode: item.barcode ?? '',
    additionalBarcodes: formatAdditionalBarcodesForExport(item.additionalBarcodes),
    barcodeChangeReason: '',
    upc: item.upc ?? '',
    ean: item.ean ?? '',
    isbn: item.isbn ?? '',
    unitId: item.unitId,
    secondaryUnitId: item.secondaryUnitId ?? '',
    conversionRatio: item.conversionRatio ? String(item.conversionRatio) : '',
    taxClass: item.taxClass ?? 'TAXABLE',
    gstRate: String(item.gstRate ?? 0),
    trackBatch: Boolean(item.trackBatch),
    trackSerial: Boolean(item.trackSerial),
    trackExpiry: Boolean(item.trackExpiry),
    purchasePrice: item.pricing?.purchase != null ? String(item.pricing.purchase) : '',
    salePrice: item.pricing?.sale != null ? String(item.pricing.sale) : '',
    mrp: item.pricing?.mrp != null ? String(item.pricing.mrp) : '',
    wholesalePrice: item.pricing?.wholesale != null ? String(item.pricing.wholesale) : '',
    distributorPrice: item.pricing?.distributor != null ? String(item.pricing.distributor) : '',
    godownAllocations: stocks,
    openingStock: String(item.openingStock ?? 0),
    openingValue: String(item.openingValue ?? 0),
    reorderLevel:
      item.reorderLevel != null && item.reorderLevel !== undefined ? String(item.reorderLevel) : '',
    description: item.description ?? '',
    imageDataUrl: item.images?.[0] ?? '',
  };
}

type Props = {
  open: boolean;
  /** null = Add, string = Edit */
  itemId: string | null;
  initialBarcode?: string;
  units: UnitOfMeasure[];
  categories: ItemCategory[];
  godowns: Godown[];
  brandOptions?: string[];
  saving?: boolean;
  nested?: boolean;
  onClose: () => void;
  onSubmit: (values: ItemFormValues) => void | Promise<void>;
  onOpenExistingItem?: (itemId: string) => void;
  onCategoriesChange?: () => void;
  onGodownsChange?: () => void;
  onBrandCreated?: (brand: string) => void;
};

export function ItemFormModal({
  open,
  itemId,
  initialBarcode,
  units,
  categories,
  godowns,
  brandOptions = [],
  saving: savingProp,
  nested,
  onClose,
  onSubmit,
  onOpenExistingItem,
  onCategoriesChange,
  onGodownsChange,
  onBrandCreated,
}: Props) {
  const isEdit = Boolean(itemId);
  const [form, setForm] = useState<ItemFormValues>(emptyForm);
  const [loadingItem, setLoadingItem] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [godownQuickOpen, setGodownQuickOpen] = useState(false);
  const [quickGodownName, setQuickGodownName] = useState('');
  const [quickGodownCode, setQuickGodownCode] = useState('');
  const [quickGodownSaving, setQuickGodownSaving] = useState(false);
  const [quickGodownError, setQuickGodownError] = useState<string | null>(null);
  const [localGodowns, setLocalGodowns] = useState<Godown[]>(godowns);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [duplicateConflict, setDuplicateConflict] = useState<{
    barcode: string;
    item: InventoryItem;
  } | null>(null);
  const [barcodeSnapshot, setBarcodeSnapshot] = useState({ primary: '', additional: '' });

  const defaultGodownId = useMemo(
    () => localGodowns.find((g) => g.isDefault)?.id ?? localGodowns[0]?.id ?? '',
    [localGodowns]
  );

  const defaultThresholdLabel = globalDefaultThreshold();

  useEffect(() => {
    setLocalGodowns(godowns);
  }, [godowns]);

  const patch = (p: Partial<ItemFormValues>) => setForm((prev) => ({ ...prev, ...p }));

  const validateAllBarcodes = useCallback(
    async (values: ItemFormValues): Promise<boolean> => {
      const codes = [values.barcode.trim(), ...parseAdditionalBarcodes(values.additionalBarcodes)].filter(Boolean);
      const listErr = validateBarcodeList(codes);
      if (listErr) {
        setSubmitError(listErr);
        return false;
      }
      for (const code of codes) {
        const existing = await lookupBarcodeDuplicate(code, itemId);
        if (existing) {
          setDuplicateConflict({ barcode: code, item: existing });
          return false;
        }
      }
      return true;
    },
    [itemId]
  );

  const applyBarcodeValue = useCallback(
    async (code: string) => {
      const trimmed = code.trim();
      if (!trimmed) {
        patch({ barcode: '' });
        return;
      }
      if (!(await validateAllBarcodes({ ...form, barcode: trimmed }))) return;
      patch({ barcode: trimmed });
    },
    [form, validateAllBarcodes]
  );

  const initCreateForm = useCallback(() => {
    const next = emptyForm();
    next.sku = generateId('SKU').slice(-12).toUpperCase();
    if (initialBarcode?.trim()) next.barcode = initialBarcode.trim();
    if (units.length === 1) next.unitId = units[0].id;
    const general = categories.find((c) => c.id === 'cat-general') ?? categories[0];
    if (general) next.categoryId = general.id;
    next.godownAllocations = [{ godownId: defaultGodownId, quantity: '0' }];
    setForm(next);
  }, [categories, defaultGodownId, initialBarcode, units]);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setAddingCategory(false);
    setNewCategoryName('');

    if (itemId) {
      let cancelled = false;
      setLoadingItem(true);
      void inventoryItemService.getById(itemId).then((item) => {
        if (cancelled) return;
        if (item) {
          const next = itemToForm(item, defaultGodownId);
          setForm(next);
          setBarcodeSnapshot({
            primary: next.barcode,
            additional: next.additionalBarcodes,
          });
        } else setSubmitError('Item not found');
        setLoadingItem(false);
      });
      return () => {
        cancelled = true;
      };
    }

    initCreateForm();
    setBarcodeSnapshot({ primary: initialBarcode?.trim() ?? '', additional: '' });
    if (initialBarcode?.trim()) {
      void lookupBarcodeDuplicate(initialBarcode.trim(), null).then((existing) => {
        if (existing) {
          setDuplicateConflict({ barcode: initialBarcode.trim(), item: existing });
        }
      });
    }
    return undefined;
  }, [open, itemId, defaultGodownId, initCreateForm, initialBarcode]);

  useEffect(() => {
    if (isEdit || !open) return;
    const qty = Number(form.openingStock) || 0;
    const rate = Number(form.purchasePrice) || 0;
    const val = (qty * rate).toFixed(2);
    setForm((prev) => (prev.openingValue === val ? prev : { ...prev, openingValue: val }));
  }, [isEdit, open, form.openingStock, form.purchasePrice]);

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

  const handleQuickCreateGodown = async () => {
    if (!quickGodownName.trim()) {
      setQuickGodownError('Godown name is required.');
      return;
    }
    try {
      setQuickGodownSaving(true);
      setQuickGodownError(null);
      await godownService.create({
        name: quickGodownName.trim(),
        code: quickGodownCode.trim() || undefined,
      });
      const list = await godownService.list({ includeInactive: false });
      setLocalGodowns(list);
      onGodownsChange?.();
      setGodownQuickOpen(false);
      setQuickGodownName('');
      setQuickGodownCode('');
    } catch (err) {
      setQuickGodownError((err as Error).message ?? 'Failed to create godown');
    } finally {
      setQuickGodownSaving(false);
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

  const validate = (): string | null => {
    if (!form.name.trim()) return 'Item name is required.';
    if (!form.categoryId) return 'Category is required.';
    if (!form.unitId) return 'Primary unit is required.';
    if (form.secondaryUnitId && !form.conversionRatio.trim()) {
      return 'Conversion ratio is required when secondary unit is selected.';
    }
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError(null);
    if (!(await validateAllBarcodes(form))) return;
    try {
      await onSubmit(form);
    } catch (e) {
      if (isBarcodeDuplicateError(e)) {
        setDuplicateConflict({
          barcode: e.barcode,
          item: e.existingItem as InventoryItem,
        });
        return;
      }
      setSubmitError((e as Error).message);
    }
  };

  const saving = savingProp ?? false;
  const formDisabled = saving || loadingItem;

  const sectionTitle = (title: string) => (
    <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 0.5, mb: -0.5 }}>
      {title}
    </Typography>
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        scroll="paper"
        sx={nested ? NESTED_DIALOG_SX : undefined}
      >
        <DialogTitle fontWeight={800}>{isEdit ? 'Edit Item' : 'Add Item'}</DialogTitle>
        <DialogContent>
          {loadingItem ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={2} sx={{ mt: 1 }}>
              {submitError ? (
                <Alert severity="error" onClose={() => setSubmitError(null)}>
                  {submitError}
                </Alert>
              ) : null}

              {sectionTitle('Basic Info')}
              <TextField
                label="Item Name"
                required
                fullWidth
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                disabled={formDisabled}
              />

              <FormControl fullWidth size="small" disabled={formDisabled}>
                <InputLabel>Item Type</InputLabel>
                <Select
                  label="Item Type"
                  value={form.itemType}
                  onChange={(e) => patch({ itemType: e.target.value as InventoryItemType })}
                  {...SELECT_MENU_Z}
                >
                  <MenuItem value="BOTH">Both</MenuItem>
                  <MenuItem value="PURCHASE">Purchase</MenuItem>
                  <MenuItem value="SALES">Sales</MenuItem>
                </Select>
              </FormControl>

              <BrandGroupField
                label="Brand Name"
                value={form.brand}
                options={brandOptions}
                onChange={(brand) => patch({ brand })}
                onBrandCreated={onBrandCreated}
                dialogOpen={open}
                disabled={formDisabled}
              />

              <FormControl fullWidth size="small" required disabled={formDisabled}>
                <InputLabel>Category</InputLabel>
                <Select
                  label="Category"
                  value={addingCategory ? ADD_CATEGORY : form.categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  {...SELECT_MENU_Z}
                >
                  {categories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                  <MenuItem value={ADD_CATEGORY}>+ Add new category</MenuItem>
                </Select>
              </FormControl>

              {addingCategory ? (
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    size="small"
                    fullWidth
                    label="New category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    disabled={categorySaving}
                  />
                  <Button
                    variant="contained"
                    size="small"
                    disabled={categorySaving || !newCategoryName.trim()}
                    onClick={() => void handleCreateCategory()}
                  >
                    Add
                  </Button>
                </Stack>
              ) : null}

              <FormControlLabel
                control={
                  <Switch
                    checked={form.status === 'ACTIVE'}
                    onChange={(_, checked) => patch({ status: checked ? 'ACTIVE' : 'INACTIVE' })}
                    disabled={formDisabled}
                  />
                }
                label={`Status: ${form.status === 'ACTIVE' ? 'Active' : 'Inactive'}`}
              />

              {sectionTitle('Codes & Identifiers')}
              <TextField
                label="SKU"
                required
                fullWidth
                value={form.sku}
                onChange={(e) => patch({ sku: e.target.value })}
                disabled={formDisabled}
                helperText="Item code — separate from barcode"
              />
              <TextField
                label="HSN Code"
                fullWidth
                value={form.hsnCode}
                onChange={(e) => patch({ hsnCode: e.target.value })}
                disabled={formDisabled}
              />
              <TextField
                label="Barcode"
                fullWidth
                value={form.barcode}
                onChange={(e) => patch({ barcode: e.target.value })}
                onBlur={() => {
                  if (form.barcode.trim()) void applyBarcodeValue(form.barcode);
                }}
                disabled={formDisabled}
                helperText="Manufacturer or generated numeric barcode for scanning (never derived from SKU)"
                placeholder="Scan or type barcode"
              />
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={formDisabled}
                  onClick={() => setScannerOpen(true)}
                >
                  Scan Barcode
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={formDisabled || generatingBarcode}
                  onClick={() => {
                    setGeneratingBarcode(true);
                    void generateUniqueNumericBarcode()
                      .then((code) => applyBarcodeValue(code))
                      .catch((e: unknown) =>
                        setSubmitError(e instanceof Error ? e.message : 'Could not generate barcode')
                      )
                      .finally(() => setGeneratingBarcode(false));
                  }}
                >
                  {generatingBarcode ? 'Generating…' : 'Generate Barcode'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!isEdit || !form.barcode.trim() || formDisabled}
                  onClick={() => setPrintDialogOpen(true)}
                >
                  Print Barcode
                </Button>
              </Stack>
              {!form.barcode.trim() ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No barcode assigned
                </Typography>
              ) : (
                <BarcodeGenerator
                  barcode={form.barcode}
                  itemName={form.name || 'Item'}
                  sku={form.sku}
                  price={form.salePrice}
                  mrp={form.mrp}
                  compact
                />
              )}

              <TextField
                label="Additional Barcodes"
                fullWidth
                multiline
                minRows={2}
                value={form.additionalBarcodes}
                onChange={(e) => patch({ additionalBarcodes: e.target.value })}
                onBlur={() => void validateAllBarcodes(form)}
                disabled={formDisabled}
                placeholder="8901000000099; 8901000000100"
                helperText="Inner box, master carton, manufacturer codes — separate with ; or new line. Any code finds this item."
              />

              {(isEdit &&
                (form.barcode !== barcodeSnapshot.primary ||
                  form.additionalBarcodes !== barcodeSnapshot.additional)) ||
              (!isEdit && (form.barcode.trim() || form.additionalBarcodes.trim())) ? (
                <TextField
                  label="Barcode change reason (optional)"
                  fullWidth
                  value={form.barcodeChangeReason}
                  onChange={(e) => patch({ barcodeChangeReason: e.target.value })}
                  disabled={formDisabled}
                  placeholder="e.g. Manufacturer label update, inner box code added"
                />
              ) : null}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="UPC" fullWidth value={form.upc} onChange={(e) => patch({ upc: e.target.value })} disabled={formDisabled} />
                <TextField label="EAN" fullWidth value={form.ean} onChange={(e) => patch({ ean: e.target.value })} disabled={formDisabled} />
                <TextField label="ISBN" fullWidth value={form.isbn} onChange={(e) => patch({ isbn: e.target.value })} disabled={formDisabled} />
              </Stack>

              {sectionTitle('Units & Tax')}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth size="small" required disabled={formDisabled}>
                  <InputLabel>Primary Unit</InputLabel>
                  <Select
                    label="Primary Unit"
                    value={form.unitId}
                    onChange={(e) => patch({ unitId: e.target.value })}
                    {...SELECT_MENU_Z}
                  >
                    {units.map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.symbol || u.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small" disabled={formDisabled}>
                  <InputLabel>Secondary Unit</InputLabel>
                  <Select
                    label="Secondary Unit"
                    value={form.secondaryUnitId}
                    onChange={(e) => patch({ secondaryUnitId: e.target.value })}
                    {...SELECT_MENU_Z}
                  >
                    <MenuItem value="">None</MenuItem>
                    {units.map((u) => (
                      <MenuItem key={u.id} value={u.id}>
                        {u.symbol || u.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {form.secondaryUnitId ? (
                  <TextField
                    label="Conversion Ratio"
                    type="number"
                    fullWidth
                    required
                    value={form.conversionRatio}
                    onChange={(e) => patch({ conversionRatio: e.target.value })}
                    inputProps={{ min: 0, step: '0.0001' }}
                    disabled={formDisabled}
                  />
                ) : null}
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <FormControl fullWidth size="small" disabled={formDisabled}>
                  <InputLabel>Tax</InputLabel>
                  <Select
                    label="Tax"
                    value={form.taxClass}
                    onChange={(e) => patch({ taxClass: e.target.value as InventoryTaxClass })}
                    {...SELECT_MENU_Z}
                  >
                    <MenuItem value="TAXABLE">Taxable</MenuItem>
                    <MenuItem value="NON_TAXABLE">Non-taxable</MenuItem>
                    <MenuItem value="EXEMPT">Tax Exempt</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="GST Rate (%)"
                  type="number"
                  fullWidth
                  value={form.gstRate}
                  onChange={(e) => patch({ gstRate: e.target.value })}
                  disabled={formDisabled}
                />
              </Stack>

              <FormGroup row>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.trackBatch}
                      onChange={(_, checked) => patch({ trackBatch: checked })}
                      disabled={formDisabled}
                    />
                  }
                  label="Track Batch"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.trackSerial}
                      onChange={(_, checked) => patch({ trackSerial: checked })}
                      disabled={formDisabled}
                    />
                  }
                  label="Track Serial"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={form.trackExpiry}
                      onChange={(_, checked) => patch({ trackExpiry: checked })}
                      disabled={formDisabled}
                    />
                  }
                  label="Track Expiry"
                />
              </FormGroup>

              {sectionTitle('Pricing')}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="Purchase Price (₹)" type="number" fullWidth value={form.purchasePrice} onChange={(e) => patch({ purchasePrice: e.target.value })} disabled={formDisabled} />
                <TextField label="Selling Price (₹)" type="number" fullWidth value={form.salePrice} onChange={(e) => patch({ salePrice: e.target.value })} disabled={formDisabled} />
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField label="MRP" type="number" fullWidth value={form.mrp} onChange={(e) => patch({ mrp: e.target.value })} disabled={formDisabled} />
                <TextField label="Wholesale Price" type="number" fullWidth value={form.wholesalePrice} onChange={(e) => patch({ wholesalePrice: e.target.value })} disabled={formDisabled} />
                <TextField label="Distributor Price" type="number" fullWidth value={form.distributorPrice} onChange={(e) => patch({ distributorPrice: e.target.value })} disabled={formDisabled} />
              </Stack>

              {sectionTitle('Stock')}
              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Typography variant="body2" fontWeight={600}>
                    Godown / Warehouse
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" startIcon={<AddIcon />} onClick={() => setGodownQuickOpen(true)} disabled={formDisabled}>
                      Add location
                    </Button>
                    <Button size="small" startIcon={<AddIcon />} onClick={addGodownRow} disabled={localGodowns.length === 0 || formDisabled}>
                      Add row
                    </Button>
                  </Stack>
                </Stack>
                {localGodowns.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No godowns found. Add a location or create godowns in Settings → Godown Master.
                  </Typography>
                ) : (
                  form.godownAllocations.map((row, index) => (
                    <Stack key={index} direction="row" spacing={1} sx={{ mb: 1 }}>
                      <FormControl size="small" sx={{ flex: 1 }} disabled={formDisabled}>
                        <InputLabel>Godown</InputLabel>
                        <Select
                          label="Godown"
                          value={row.godownId}
                          onChange={(e) => updateGodownRow(index, { godownId: e.target.value })}
                          {...SELECT_MENU_Z}
                        >
                          {localGodowns.map((g) => (
                            <MenuItem key={g.id} value={g.id}>
                              {g.name}
                              {g.isDefault ? ' (Default)' : ''}
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
                        disabled={formDisabled || isEdit}
                      />
                      <IconButton size="small" onClick={() => removeGodownRow(index)} disabled={form.godownAllocations.length <= 1 || formDisabled || isEdit}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ))
                )}
                {!isEdit ? (
                  <Typography variant="caption" color="text.secondary">
                    If opening stock is set and godown quantities are blank, stock is saved to the default godown automatically.
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Godown quantities are read-only on edit — use stock adjustments to change stock.
                  </Typography>
                )}
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Opening Stock"
                  type="number"
                  fullWidth
                  value={form.openingStock}
                  onChange={(e) => patch({ openingStock: e.target.value })}
                  inputProps={{ min: 0, step: '0.01' }}
                  disabled={isEdit || formDisabled}
                />
                <TextField
                  label="Opening Value"
                  type="number"
                  fullWidth
                  value={form.openingValue}
                  onChange={(e) => patch({ openingValue: e.target.value })}
                  inputProps={{ min: 0, step: '0.01' }}
                  disabled={isEdit || formDisabled}
                />
                <TextField
                  label="Reorder Level (Low Stock Threshold)"
                  type="number"
                  fullWidth
                  value={form.reorderLevel}
                  onChange={(e) => patch({ reorderLevel: e.target.value })}
                  placeholder={`Default: ${defaultThresholdLabel}`}
                  inputProps={{ min: 0 }}
                  disabled={formDisabled}
                  helperText={`Leave blank to use global default (${defaultThresholdLabel})`}
                />
              </Stack>

              {sectionTitle('Other')}
              <TextField
                label="Description"
                fullWidth
                multiline
                minRows={3}
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                disabled={formDisabled}
              />

              <Box>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                  Item Image
                </Typography>
                <Button variant="outlined" component="label" size="small" disabled={formDisabled}>
                  Upload image
                  <input type="file" hidden accept="image/*" onChange={(e) => handleImage(e.target.files?.[0] ?? null)} />
                </Button>
                {form.imageDataUrl ? (
                  <Box component="img" src={form.imageDataUrl} alt="Preview" sx={{ display: 'block', mt: 1, maxHeight: 120, borderRadius: 1 }} />
                ) : null}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={saving || loadingItem || !form.name.trim() || !form.unitId || !form.categoryId}
            onClick={() => void handleSave()}
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Item'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={godownQuickOpen} onClose={() => !quickGodownSaving && setGodownQuickOpen(false)} fullWidth maxWidth="sm" sx={NESTED_DIALOG_SX}>
        <DialogTitle>Add godown</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField label="Godown name" value={quickGodownName} onChange={(e) => setQuickGodownName(e.target.value)} fullWidth required disabled={quickGodownSaving} />
            <TextField label="Code (optional)" value={quickGodownCode} onChange={(e) => setQuickGodownCode(e.target.value)} fullWidth disabled={quickGodownSaving} />
            {quickGodownError ? <Alert severity="error">{quickGodownError}</Alert> : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => !quickGodownSaving && setGodownQuickOpen(false)} disabled={quickGodownSaving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleQuickCreateGodown()} disabled={quickGodownSaving}>
            {quickGodownSaving ? 'Saving…' : 'Create godown'}
          </Button>
        </DialogActions>
      </Dialog>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={(code) => void applyBarcodeValue(code)}
      />

      <BarcodeDuplicateDialog
        open={Boolean(duplicateConflict)}
        barcode={duplicateConflict?.barcode ?? ''}
        itemName={duplicateConflict?.item.name ?? ''}
        sku={duplicateConflict?.item.sku ?? ''}
        onCancel={() => setDuplicateConflict(null)}
        onOpenExisting={() => {
          const id = duplicateConflict?.item.id;
          setDuplicateConflict(null);
          if (id) onOpenExistingItem?.(id);
        }}
      />

      <PrintBarcodeLabelDialog
        open={printDialogOpen}
        item={
          form.barcode.trim()
            ? {
                name: form.name || 'Item',
                sku: form.sku,
                barcode: form.barcode.trim(),
                pricing: {
                  sale: form.salePrice !== '' ? Number(form.salePrice) : undefined,
                  mrp: form.mrp !== '' ? Number(form.mrp) : undefined,
                },
              }
            : null
        }
        onClose={() => setPrintDialogOpen(false)}
      />
    </>
  );
}

export function formValuesToPayload(
  values: ItemFormValues,
  options?: { isEdit?: boolean }
): Partial<InventoryItem> {
  const parseNum = (v: string, fallback = 0) => {
    const n = Number(v);
    return Number.isNaN(n) ? fallback : n;
  };

  const pricing: InventoryItem['pricing'] = {};
  if (values.purchasePrice !== '') pricing.purchase = parseNum(values.purchasePrice);
  if (values.salePrice !== '') pricing.sale = parseNum(values.salePrice);
  if (values.mrp !== '') pricing.mrp = parseNum(values.mrp);
  if (values.wholesalePrice !== '') pricing.wholesale = parseNum(values.wholesalePrice);
  if (values.distributorPrice !== '') pricing.distributor = parseNum(values.distributorPrice);

  const reorderTrimmed = values.reorderLevel.trim();
  const reorderLevel =
    reorderTrimmed === ''
      ? options?.isEdit
        ? null
        : readInventorySettings().globalLowStockThreshold
      : parseNum(reorderTrimmed, 0);

  const sku = values.sku.trim() || generateId('SKU').slice(-12).toUpperCase();

  const additionalParsed = parseAdditionalBarcodes(values.additionalBarcodes);

  const base: Partial<InventoryItem> = {
    name: values.name.trim(),
    itemType: values.itemType,
    brand: values.brand.trim() || null,
    categoryId: values.categoryId || null,
    status: values.status,
    sku,
    hsnCode: values.hsnCode.trim() || null,
    barcode: values.barcode.trim() || null,
    additionalBarcodes: additionalParsed.length ? additionalParsed : null,
    upc: values.upc.trim() || null,
    ean: values.ean.trim() || null,
    isbn: values.isbn.trim() || null,
    unitId: values.unitId,
    secondaryUnitId: values.secondaryUnitId || null,
    conversionRatio:
      values.secondaryUnitId && values.conversionRatio
        ? parseNum(values.conversionRatio, 0)
        : undefined,
    taxClass: values.taxClass,
    gstRate: parseNum(values.gstRate, 0),
    trackBatch: values.trackBatch,
    trackSerial: values.trackSerial,
    trackExpiry: values.trackExpiry,
    pricing: Object.keys(pricing).length ? pricing : undefined,
    reorderLevel,
    description: values.description.trim() || null,
    images: values.imageDataUrl ? [values.imageDataUrl] : undefined,
    createdSource: 'USER',
  };

  if (options?.isEdit) {
    return {
      ...base,
      barcodeChangeReason: values.barcodeChangeReason.trim() || undefined,
    } as Partial<InventoryItem> & { barcodeChangeReason?: string };
  }

  const godownStocks: InventoryGodownStock[] = values.godownAllocations
    .filter((row) => row.godownId && Number(row.quantity) >= 0)
    .map((row) => ({ godownId: row.godownId, quantity: Number(row.quantity || 0) }));

  const allocSum = godownStocks.reduce((sum, row) => sum + row.quantity, 0);
  const openingStock = parseNum(values.openingStock, 0);
  let splits = godownStocks.filter((s) => s.quantity > 0);
  if (openingStock > 0 && splits.length === 0 && values.godownAllocations[0]?.godownId) {
    splits = [{ godownId: values.godownAllocations[0].godownId, quantity: openingStock }];
  }
  const currentStock = splits.length > 0 ? splits.reduce((s, r) => s + r.quantity, 0) : openingStock;

  return {
    ...base,
    barcodeChangeReason: values.barcodeChangeReason.trim() || undefined,
    godownStocks: splits.length ? splits : godownStocks.length ? godownStocks : undefined,
    openingStock: openingStock || currentStock,
    openingValue: parseNum(values.openingValue, 0),
    currentStock,
  } as Partial<InventoryItem> & { barcodeChangeReason?: string };
}

/** Self-contained modal that loads masters and saves via itemsApi — for vouchers / legacy routes. */
export function ItemFormModalStandalone({
  open,
  itemId,
  initialBarcode,
  nested,
  onClose,
  onSaved,
  onOpenExistingItem,
}: {
  open: boolean;
  itemId: string | null;
  initialBarcode?: string;
  nested?: boolean;
  onClose: () => void;
  onSaved?: (item: InventoryItem) => void;
  onOpenExistingItem?: (itemId: string) => void;
}) {
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [printItem, setPrintItem] = useState<InventoryItem | null>(null);

  const loadMasters = useCallback(async () => {
    const [cats, uns, gds, brands] = await Promise.all([
      itemCategoryService.seedDefaults().then(() => itemCategoryService.list()),
      import('../../services/masters/unitOfMeasureService').then((m) => m.unitOfMeasureService.list()),
      godownService.seedDefaults().then(() => godownService.list({ includeInactive: false })),
      inventoryItemService.listDistinctBrands(),
    ]);
    setCategories(cats);
    setUnits(uns);
    setGodowns(gds);
    setBrandOptions(brands);
  }, []);

  useEffect(() => {
    if (open) void loadMasters();
  }, [open, loadMasters]);

  const handleSubmit = async (values: ItemFormValues) => {
    setSaving(true);
    try {
      const payload = formValuesToPayload(values, { isEdit: Boolean(itemId) });
      const item = itemId
        ? await itemsApi.update(itemId, payload)
        : await itemsApi.create(payload);
      if (!itemId && item.barcode?.trim()) {
        setPrintItem(item);
      }
      onSaved?.(item);
      if (itemId || !item.barcode?.trim()) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ItemFormModal
      open={open}
      itemId={itemId}
      initialBarcode={initialBarcode}
      units={units}
      categories={categories}
      godowns={godowns}
      brandOptions={brandOptions}
      saving={saving}
      nested={nested}
      onClose={onClose}
      onSubmit={handleSubmit}
      onOpenExistingItem={onOpenExistingItem}
      onCategoriesChange={() => void loadMasters()}
      onGodownsChange={() => void loadMasters()}
      onBrandCreated={(brand) => {
        setBrandOptions((prev) => (prev.includes(brand) ? prev : [...prev, brand].sort()));
      }}
    />
      <PrintBarcodeLabelDialog
        open={Boolean(printItem)}
        item={printItem}
        onClose={() => {
          setPrintItem(null);
          onClose();
        }}
      />
    </>
  );
}
