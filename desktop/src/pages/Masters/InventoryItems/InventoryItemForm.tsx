import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';

import { InventoryItem, InventoryStatus, ItemCategory, UnitOfMeasure, Godown } from '../../../types/masters';
import { inventoryItemService } from '../../../services/masters/inventoryItemService';
import { itemCategoryService } from '../../../services/masters/itemCategoryService';
import { unitOfMeasureService } from '../../../services/masters/unitOfMeasureService';
import { godownService } from '../../../services/masters/godownService';
import { useMasterForm } from '../../../hooks/useMasterForm';
import { usePermission } from '../../../hooks/usePermission';
import { useFocusField } from '../../../hooks/useFocusField';
import { focusRegistry } from '../../../services/focus/focusRegistry';

type InventoryItemInput = Partial<InventoryItem>;

interface GodownInput {
  godownId: string;
  name: string;
  quantity: string;
}

const priceFields = [
  { key: 'purchase', label: 'Purchase Price' },
  { key: 'sale', label: 'Sale Price' },
  { key: 'mrp', label: 'MRP' },
  { key: 'wholesale', label: 'Wholesale Price' },
  { key: 'distributor', label: 'Distributor Price' },
] as const;

const SCREEN_ID = 'inventory-item-form';
const CATEGORY_DIALOG_SCREEN_ID = 'inventory-item-category-dialog';
const PRICE_FIELD_ORDER_START = 20;
const GODOWN_FIELD_ORDER_START = 200;

export type InventoryItemFormProps = {
  /** Open inside Sales Voucher dialog — create only, no navigation. */
  embedded?: boolean;
  onSaved?: (item: InventoryItem) => void;
  onCancel?: () => void;
};

const InventoryItemForm = ({ embedded = false, onSaved, onCancel }: InventoryItemFormProps = {}) => {
  const params = useParams<{ id: string }>();
  const id = embedded ? undefined : params.id;
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { can } = usePermission();

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [godownInputs, setGodownInputs] = useState<GodownInput[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', code: '' });
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryDialogError, setCategoryDialogError] = useState<string | null>(null);

  const { entity, loading, saving, error, load, create, update, resetError } = useMasterForm<
    InventoryItem,
    InventoryItemInput
  >({
    load: async (entityId) => {
      const item = await inventoryItemService.getById(entityId);
      if (!item) {
        throw new Error('Inventory item not found');
      }
      return item;
    },
    create: async (payload) => inventoryItemService.create(payload),
    update: async (entityId, payload) => inventoryItemService.update(entityId, payload),
  });

  const refreshCategories = useCallback(async () => {
    try {
      const list = await itemCategoryService.list({ includeInactive: false });
      setCategories(list);
    } catch {
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadUnits = async () => {
      try {
        let list = await unitOfMeasureService.list({ includeInactive: false });
        if (!list.length) {
          await unitOfMeasureService.seedDefaults();
          list = await unitOfMeasureService.list({ includeInactive: false });
        }
        if (!cancelled) setUnits(list);
      } catch {
        if (!cancelled) setUnits([]);
      }
    };

    const loadGodowns = async () => {
      try {
        const list = await godownService.list({ includeInactive: false });
        if (cancelled) return;
        setGodowns(list);
        if (!isEditMode) {
          setGodownInputs(
            list.map((g) => ({
              godownId: g.id,
              name: g.name,
              quantity: '',
            }))
          );
        }
      } catch {
        if (!cancelled) {
          setGodowns([]);
          if (!isEditMode) setGodownInputs([]);
        }
      }
    };

    void (async () => {
      if (!cancelled) await refreshCategories();
    })();
    void loadUnits();
    void loadGodowns();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, refreshCategories]);

  useEffect(() => {
    if (isEditMode && id) {
      void load(id);
    }
  }, [id, isEditMode, load]);

  const [formState, setFormState] = useState({
    name: '',
    sku: '',
    brand: '',
    barcode: '',
    categoryId: '',
    unitId: '',
    secondaryUnitId: '',
    conversionRatio: '',
    gstRate: '0',
    hsnCode: '',
    pricing: {
      purchase: '',
      sale: '',
      mrp: '',
      wholesale: '',
      distributor: '',
    },
    trackBatch: false,
    trackSerial: false,
    trackExpiry: false,
    openingStock: '0',
    openingValue: '0',
    reorderLevel: '',
    status: 'ACTIVE' as InventoryStatus,
  });

  const formDisabled = saving || loading;

  const nameFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 1,
    disabled: formDisabled,
  });
  const skuFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 2,
    disabled: formDisabled,
  });
  const brandFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 3,
    disabled: formDisabled,
  });
  const barcodeFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 4,
    disabled: formDisabled,
  });
  const categoryFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 5,
    disabled: formDisabled,
  });
  const categoryAddButtonRef = useFocusField<HTMLButtonElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 5.1,
    disabled: formDisabled,
    id: 'inventory-item-category-add-button',
  });
  const primaryUnitFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 6,
    disabled: formDisabled,
  });
  const secondaryUnitFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 7,
    disabled: formDisabled,
  });
  const conversionRatioFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 8,
    disabled: formDisabled || !formState.secondaryUnitId,
  });
  const gstRateFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 9,
    disabled: formDisabled,
  });
  const hsnFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 10,
    disabled: formDisabled,
  });

  const trackBatchFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'flags',
    order: 40,
    disabled: formDisabled,
  });
  const trackSerialFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'flags',
    order: 41,
    disabled: formDisabled,
  });
  const trackExpiryFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'flags',
    order: 42,
    disabled: formDisabled,
  });

  const openingStockFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'stock',
    order: 50,
    disabled: formDisabled || isEditMode,
  });
  const openingValueFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'stock',
    order: 51,
    disabled: formDisabled || isEditMode,
  });
  const reorderLevelFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'stock',
    order: 52,
    disabled: formDisabled,
  });
  const statusFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'status',
    order: 60,
    disabled: formDisabled,
  });
  const categoryDialogNameFieldRef = useFocusField<HTMLInputElement>({
    screenId: CATEGORY_DIALOG_SCREEN_ID,
    section: 'dialog',
    order: 1,
    disabled: categorySaving,
    id: 'inventory-item-category-dialog-name',
  });
  const categoryDialogCodeFieldRef = useFocusField<HTMLInputElement>({
    screenId: CATEGORY_DIALOG_SCREEN_ID,
    section: 'dialog',
    order: 2,
    disabled: categorySaving,
    id: 'inventory-item-category-dialog-code',
  });
  const categoryDialogCancelButtonRef = useFocusField<HTMLButtonElement>({
    screenId: CATEGORY_DIALOG_SCREEN_ID,
    section: 'dialog',
    order: 3,
    disabled: categorySaving,
    id: 'inventory-item-category-dialog-cancel',
  });
  const categoryDialogCreateButtonRef = useFocusField<HTMLButtonElement>({
    screenId: CATEGORY_DIALOG_SCREEN_ID,
    section: 'dialog',
    order: 4,
    disabled: categorySaving,
    id: 'inventory-item-category-dialog-create',
  });

  useEffect(() => {
    if (categoryDialogOpen) {
      focusRegistry.queueFocus('inventory-item-category-dialog-name');
    }
  }, [categoryDialogOpen]);

  useEffect(() => {
    if (entity && isEditMode) {
      setFormState({
        name: entity.name,
        sku: entity.sku,
        barcode: entity.barcode ?? '',
        brand: entity.brand ?? '',
        categoryId: entity.categoryId ?? '',
        unitId: entity.unitId,
        secondaryUnitId: entity.secondaryUnitId ?? '',
        conversionRatio: entity.conversionRatio ? String(entity.conversionRatio) : '',
        gstRate: String(entity.gstRate ?? 0),
        hsnCode: entity.hsnCode ?? '',
        pricing: {
          purchase: entity.pricing?.purchase !== undefined ? String(entity.pricing.purchase) : '',
          sale: entity.pricing?.sale !== undefined ? String(entity.pricing.sale) : '',
          mrp: entity.pricing?.mrp !== undefined && entity.pricing?.mrp !== null ? String(entity.pricing.mrp) : '',
          wholesale:
            entity.pricing?.wholesale !== undefined && entity.pricing?.wholesale !== null
              ? String(entity.pricing.wholesale)
              : '',
          distributor:
            entity.pricing?.distributor !== undefined && entity.pricing?.distributor !== null
              ? String(entity.pricing.distributor)
              : '',
        },
        trackBatch: Boolean(entity.trackBatch),
        trackSerial: Boolean(entity.trackSerial),
        trackExpiry: Boolean(entity.trackExpiry),
        openingStock: String(entity.openingStock ?? 0),
        openingValue: String(entity.openingValue ?? 0),
        reorderLevel: entity.reorderLevel !== null && entity.reorderLevel !== undefined ? String(entity.reorderLevel) : '',
        status: entity.status,
      });
    }
  }, [entity, isEditMode]);

  const canView = can('view-inventory');
  const canManage = can('manage-inventory');

  const categoryOptions = useMemo(() => categories.map((cat) => ({ value: cat.id, label: cat.name })), [categories]);

  const unitOptions = useMemo(
    () => units.map((unit) => ({ value: unit.id, label: `${unit.name} (${unit.symbol})` })),
    [units]
  );

  const handleChange = (field: keyof typeof formState, value: any) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handlePricingChange = (field: keyof typeof formState.pricing, value: string) => {
    setFormState((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        [field]: value,
      },
    }));
  };

  const handleGodownQuantityChange = (godownId: string, value: string) => {
    setGodownInputs((prev) =>
      prev.map((entry) => (entry.godownId === godownId ? { ...entry, quantity: value } : entry))
    );
  };

  const buildPayload = (): InventoryItemInput => {
    const parseNumber = (value: string, fallback = 0) => {
      const parsed = Number(value);
      return Number.isNaN(parsed) ? fallback : parsed;
    };

    const pricingEntries = priceFields.reduce<Record<string, number>>((acc, field) => {
      const raw = formState.pricing[field.key];
      if (raw !== '' && raw !== null && raw !== undefined) {
        const num = parseNumber(raw, 0);
        acc[field.key] = num;
      }
      return acc;
    }, {});

    const payload: InventoryItemInput = {
      name: formState.name.trim(),
      sku: formState.sku.trim(),
      brand: formState.brand.trim() || null,
      barcode: formState.barcode.trim() || null,
      categoryId: formState.categoryId || null,
      unitId: formState.unitId || undefined,
      secondaryUnitId: formState.secondaryUnitId || null,
      conversionRatio:
        formState.secondaryUnitId && formState.conversionRatio ? parseNumber(formState.conversionRatio, 0) : undefined,
      gstRate: parseNumber(formState.gstRate, 0),
      hsnCode: formState.hsnCode.trim(),
      pricing: Object.keys(pricingEntries).length ? (pricingEntries as InventoryItem['pricing']) : undefined,
      trackBatch: formState.trackBatch,
      trackSerial: formState.trackSerial,
      trackExpiry: formState.trackExpiry,
      openingStock: parseNumber(formState.openingStock, 0),
      openingValue: parseNumber(formState.openingValue, 0),
      reorderLevel: formState.reorderLevel ? parseNumber(formState.reorderLevel, 0) : null,
      status: formState.status,
    };

    if (!isEditMode) {
      const splits = godownInputs
        .map((entry) => ({
          godownId: entry.godownId,
          quantity: parseNumber(entry.quantity, 0),
        }))
        .filter((entry) => entry.quantity > 0);
      if (splits.length) {
        payload.godownStocks = splits;
      }
    }

    return payload;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) {
      setSubmitError('You do not have permission to manage inventory.');
      return;
    }
    if (!formState.name.trim()) {
      setSubmitError('Item name is required.');
      return;
    }
    if (!formState.sku.trim()) {
      setSubmitError('SKU is required.');
      return;
    }
    if (!formState.categoryId) {
      setSubmitError('Category is required.');
      return;
    }
    if (!formState.unitId) {
      setSubmitError('Primary unit is required.');
      return;
    }
    if (!formState.hsnCode.trim()) {
      setSubmitError('HSN code is required.');
      return;
    }
    if (formState.secondaryUnitId && !formState.conversionRatio) {
      setSubmitError('Conversion ratio is required when secondary unit is selected.');
      return;
    }
    try {
      setSubmitError(null);
      const payload = buildPayload();
      if (isEditMode && id) {
        await update(id, payload);
        navigate('/masters/inventory-items');
      } else {
        const created = await create(payload);
        if (embedded && onSaved) {
          onSaved(created);
        } else {
          navigate('/masters/inventory-items');
        }
      }
    } catch (err) {
      setSubmitError((err as Error).message ?? 'Failed to save inventory item');
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">You do not have permission to view inventory items.</Alert>
        </CardContent>
      </Card>
    );
  }

  const renderGodownSplits = () => {
    if (isEditMode && entity) {
      if (!entity.godownStocks || entity.godownStocks.length === 0) {
        return (
          <Alert severity="info" sx={{ mt: 2 }}>
            No godown splits recorded for this item.
          </Alert>
        );
      }
      return (
        <Box>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Godown Stock Distribution (read-only)
          </Typography>
          <Grid container spacing={2}>
            {entity.godownStocks.map((split) => {
              const godownName = godowns.find((g) => g.id === split.godownId)?.name ?? split.godownId;
              return (
                <Grid item xs={12} md={6} key={split.godownId}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography fontWeight={600}>{godownName}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {split.quantity.toFixed(4)} units
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>
          Godown Stock Allocation
        </Typography>
        {godownInputs.length === 0 ? (
          <Alert severity="info">No active godowns found. Please create a godown to allocate stock.</Alert>
        ) : (
          <Grid container spacing={2}>
            {godownInputs.map((entry, index) => (
              <Grid item xs={12} md={6} key={entry.godownId}>
                <GodownQuantityInput
                  label={entry.name}
                  value={entry.quantity}
                  disabled={formDisabled}
                  order={GODOWN_FIELD_ORDER_START + index}
                  onChange={(value) => handleGodownQuantityChange(entry.godownId, value)}
                />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    );
  };

  const closeCategoryDialog = () => {
    setCategoryDialogOpen(false);
    setCategoryDialogError(null);
    setNewCategory({ name: '', code: '' });
    focusRegistry.queueFocus('inventory-item-category-add-button');
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      setCategoryDialogError('Category name is required.');
      return;
    }
    try {
      setCategorySaving(true);
      setCategoryDialogError(null);
      await itemCategoryService.create({
        name: newCategory.name.trim(),
        code: newCategory.code.trim() || undefined,
      });
      await refreshCategories();
      closeCategoryDialog();
    } catch (err) {
      setCategoryDialogError((err as Error).message ?? 'Failed to create category');
    } finally {
      setCategorySaving(false);
    }
  };

  return (
    <>
      <Card component="form" onSubmit={handleSubmit}>
        <CardContent>
        <Stack spacing={3}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              {!embedded && (
                <>
                  <Typography variant="h5" fontWeight={600}>
                    {isEditMode ? 'Edit Inventory Item' : 'New Inventory Item'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isEditMode ? 'Update inventory details' : 'Enter details to create an inventory item'}
                  </Typography>
                </>
              )}
              {embedded && (
                <Typography variant="subtitle1" fontWeight={600}>
                  New Inventory Item
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              {embedded && onCancel && (
                <Button type="button" variant="outlined" onClick={onCancel} disabled={saving}>
                  Cancel
                </Button>
              )}
              <Button type="submit" variant="contained" disabled={saving || !canManage}>
                {saving ? <CircularProgress size={18} color="inherit" /> : isEditMode ? 'Save Changes' : 'Create'}
              </Button>
            </Stack>
          </Stack>

          {error && (
            <Alert severity="error" onClose={resetError}>
              {error.message}
            </Alert>
          )}
          {submitError && (
            <Alert severity="error" onClose={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Item Name"
                value={formState.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                fullWidth
                disabled={formDisabled}
                inputRef={nameFieldRef}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="SKU"
                value={formState.sku}
                onChange={(e) => handleChange('sku', e.target.value)}
                required
                fullWidth
                disabled={formDisabled}
                inputRef={skuFieldRef}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Brand Name"
                value={formState.brand}
                onChange={(e) => handleChange('brand', e.target.value)}
                fullWidth
                disabled={formDisabled}
                inputRef={brandFieldRef}
                helperText="Used only for filtering/reporting"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Barcode"
                value={formState.barcode}
                onChange={(e) => handleChange('barcode', e.target.value)}
                fullWidth
                disabled={formDisabled}
                inputRef={barcodeFieldRef}
              />
            </Grid>
            {/* Category */}
            <Grid item xs={12} md={5}>
              <FormControl fullWidth disabled={formDisabled}>
                <InputLabel id="category-label">Category</InputLabel>
                <Select
                  labelId="category-label"
                  label="Category"
                  value={formState.categoryId}
                  onChange={(e) => handleChange('categoryId', e.target.value)}
                  required
                  inputRef={categoryFieldRef}
                >
                  {categoryOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={1} alignSelf="flex-end">
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setCategoryDialogOpen(true)}
                ref={categoryAddButtonRef}
                disabled={formDisabled}
              >
                Add
              </Button>
            </Grid>

            {/* Primary Unit */}
            <Grid item xs={12} md={3}>
              <FormControl fullWidth disabled={formDisabled}>
                <InputLabel id="unit-label">Primary Unit</InputLabel>
                <Select
                  labelId="unit-label"
                  label="Primary Unit"
                  value={formState.unitId}
                  onChange={(e) => handleChange('unitId', e.target.value)}
                  required
                  inputRef={primaryUnitFieldRef}
                >
                  {unitOptions.map((unit) => (
                    <MenuItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Secondary Unit */}
            <Grid item xs={12} md={3}>
              <FormControl fullWidth disabled={formDisabled}>
                <InputLabel id="secondary-unit-label">Secondary Unit</InputLabel>
                <Select
                  labelId="secondary-unit-label"
                  label="Secondary Unit"
                  value={formState.secondaryUnitId}
                  onChange={(e) => handleChange('secondaryUnitId', e.target.value)}
                  inputRef={secondaryUnitFieldRef}
                >
                  <MenuItem value="">None</MenuItem>
                  {unitOptions.map((unit) => (
                    <MenuItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Conversion Ratio */}
            {formState.secondaryUnitId && (
              <Grid item xs={12} md={3}>
                <TextField
                  label="Conversion Ratio"
                  type="number"
                  value={formState.conversionRatio}
                  onChange={(e) => handleChange('conversionRatio', e.target.value)}
                  fullWidth
                  inputProps={{ min: 0, step: '0.0001' }}
                  required
                  disabled={formDisabled}
                  inputRef={conversionRatioFieldRef}
                />
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <TextField
                label="GST Rate (%)"
                type="number"
                value={formState.gstRate}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  handleChange('gstRate', e.target.value)
                }
                fullWidth
                inputProps={{ min: 0, step: '0.01' }}
                disabled={formDisabled}
                inputRef={gstRateFieldRef}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="HSN Code"
                value={formState.hsnCode}
                onChange={(e) => handleChange('hsnCode', e.target.value)}
                fullWidth
                disabled={formDisabled}
                inputRef={hsnFieldRef}
              />
            </Grid>
          </Grid>

          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              Pricing
            </Typography>
            <Grid container spacing={2}>
              {priceFields.map((field, index) => (
                <Grid item xs={12} md={4} key={field.key}>
                  <PriceFieldInput
                    label={field.label}
                    value={formState.pricing[field.key]}
                    onChange={(value) => handlePricingChange(field.key, value)}
                    disabled={formDisabled}
                    order={PRICE_FIELD_ORDER_START + index}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>

          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.trackBatch}
                  onChange={(_, checked) => handleChange('trackBatch', checked)}
                  disabled={formDisabled}
                  inputRef={trackBatchFieldRef}
                />
              }
              label="Track Batch"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.trackSerial}
                  onChange={(_, checked) => handleChange('trackSerial', checked)}
                  disabled={formDisabled}
                  inputRef={trackSerialFieldRef}
                />
              }
              label="Track Serial"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formState.trackExpiry}
                  onChange={(_, checked) => handleChange('trackExpiry', checked)}
                  disabled={formDisabled}
                  inputRef={trackExpiryFieldRef}
                />
              }
              label="Track Expiry"
            />
          </FormGroup>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Opening Stock"
                type="number"
                value={formState.openingStock}
                onChange={(e) => handleChange('openingStock', e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: '0.01' }}
                disabled={isEditMode || formDisabled}
                inputRef={openingStockFieldRef}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Opening Value"
                type="number"
                value={formState.openingValue}
                onChange={(e) => handleChange('openingValue', e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: '0.01' }}
                disabled={isEditMode || formDisabled}
                inputRef={openingValueFieldRef}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Reorder Level"
                type="number"
                value={formState.reorderLevel}
                onChange={(e) => handleChange('reorderLevel', e.target.value)}
                fullWidth
                inputProps={{ min: 0, step: '0.01' }}
                disabled={formDisabled}
                inputRef={reorderLevelFieldRef}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={formState.status === 'ACTIVE'}
                    onChange={(_, checked) => handleChange('status', checked ? 'ACTIVE' : 'INACTIVE')}
                    disabled={formDisabled}
                    inputRef={statusFieldRef}
                  />
                }
                label={`Status: ${formState.status === 'ACTIVE' ? 'Active' : 'Inactive'}`}
              />
            </Grid>
          </Grid>

          {renderGodownSplits()}
        </Stack>
        </CardContent>
      </Card>

      <Dialog open={categoryDialogOpen} onClose={closeCategoryDialog} fullWidth maxWidth="sm">
        <DialogTitle>Add Category</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Category Name"
              value={newCategory.name}
              onChange={(e) => setNewCategory((prev) => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              disabled={categorySaving}
              inputRef={categoryDialogNameFieldRef}
            />
            <TextField
              label="Code (optional)"
              value={newCategory.code}
              onChange={(e) => setNewCategory((prev) => ({ ...prev, code: e.target.value }))}
              fullWidth
              disabled={categorySaving}
              inputRef={categoryDialogCodeFieldRef}
            />
            {categoryDialogError && <Alert severity="error">{categoryDialogError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCategoryDialog} disabled={categorySaving} ref={categoryDialogCancelButtonRef}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateCategory}
            variant="contained"
            disabled={categorySaving}
            ref={categoryDialogCreateButtonRef}
          >
            {categorySaving ? 'Saving...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default InventoryItemForm;

interface PriceFieldInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  order: number;
}

const PriceFieldInput = memo(({ label, value, onChange, disabled, order }: PriceFieldInputProps) => {
  const inputRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'pricing',
    order,
    disabled,
  });

  return (
    <TextField
      label={label}
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
      inputProps={{ min: 0, step: '0.01' }}
      disabled={disabled}
      inputRef={inputRef}
    />
  );
});

interface GodownQuantityInputProps {
  label: string;
  value: string;
  disabled: boolean;
  order: number;
  onChange: (value: string) => void;
}

const GodownQuantityInput = memo(({ label, value, disabled, order, onChange }: GodownQuantityInputProps) => {
  const inputRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'godowns',
    order,
    disabled,
  });

  return (
    <TextField
      label={label}
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
      inputProps={{ min: 0, step: '0.01' }}
      disabled={disabled}
      inputRef={inputRef}
    />
  );
});
