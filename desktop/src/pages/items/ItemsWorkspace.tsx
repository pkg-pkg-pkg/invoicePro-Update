import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { itemsApi } from '../../services/items/itemsApi';
import { useInventoryItemsChanged } from '../../hooks/useActiveInventoryItems';
import { itemCategoryService } from '../../services/masters/itemCategoryService';
import { unitOfMeasureService } from '../../services/masters/unitOfMeasureService';
import { godownService } from '../../services/masters/godownService';
import { inventoryItemService } from '../../services/masters/inventoryItemService';
import type { InventoryItem, ItemCategory, ItemHistoryEntry, UnitOfMeasure, Godown } from '../../types/masters';
import type { ItemTransactionRow } from '../../services/items/itemsApi';
import type { StockAdjustment } from '../../types/masters';
import { ItemsListPanel } from '../../components/items/ItemsListPanel';
import { ItemsTablePanel } from '../../components/items/ItemsTablePanel';
import { ItemsToolbar, type BrandFilterKey } from '../../components/items/ItemsToolbar';
import { ItemDetailPanel } from '../../components/items/ItemDetailPanel';
import { ItemFormModal, formValuesToPayload, type ItemFormValues } from '../../components/items/ItemFormModal';
import { ItemNotFoundDialog } from '../../components/items/ItemNotFoundDialog';
import { PrintBarcodeLabelDialog } from '../../components/items/PrintBarcodeLabelDialog';
import { findItemsByBarcode, searchInventoryItems } from '../../services/barcode/barcodeLookup';
import { playScanBeep } from '../../services/barcode/scanBeep';
import { trackFeatureUsage } from '../../services/privacy/featureAnalyticsService';
import { useBarcodeWedge } from '../../hooks/useBarcodeWedge';
import { usePermission } from '../../hooks/usePermission';
import { ItemImportDialog } from '../../components/items/ItemImportDialog';
import { BulkBarcodePrintButton } from '../../components/items/BulkBarcodePrintButton';
import { exportItemsCsv, exportItemsExcel } from '../../services/items/itemImportService';
import { isBarcodeDuplicateError } from '../../services/barcode/barcodeUniqueness';
import { getItemsModuleTokens } from '../../theme/itemsModuleTheme';

type FilterKey = 'ALL' | 'ACTIVE' | 'INACTIVE' | string;

export default function ItemsWorkspace() {
  const theme = useTheme();
  const tok = getItemsModuleTokens(theme);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { can } = usePermission();
  const canManage = can('manage-inventory');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [brandFilter, setBrandFilter] = useState<BrandFilterKey>('ALL');
  const [brandOptions, setBrandOptions] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [transactions, setTransactions] = useState<ItemTransactionRow[]>([]);
  const [history, setHistory] = useState<ItemHistoryEntry[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formItemId, setFormItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [scanNotFoundOpen, setScanNotFoundOpen] = useState(false);
  const [pendingScanBarcode, setPendingScanBarcode] = useState('');
  const [printItem, setPrintItem] = useState<InventoryItem | null>(null);

  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u.symbol || u.name])), [units]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const loadBrandOptions = useCallback(async () => {
    const brands = await inventoryItemService.listDistinctBrands();
    setBrandOptions(brands);
  }, []);

  const registerNewBrand = useCallback((brand: string) => {
    const name = brand.trim();
    if (!name) return;
    setBrandOptions((prev) => {
      if (prev.some((b) => b.toLowerCase() === name.toLowerCase())) return prev;
      return [...prev, name].sort((a, b) => a.localeCompare(b));
    });
  }, []);

  const loadItems = useCallback(async () => {
    try {
      const status =
        filter === 'ACTIVE' ? 'ACTIVE' : filter === 'INACTIVE' ? 'INACTIVE' : undefined;
      const categoryId =
        filter !== 'ALL' && filter !== 'ACTIVE' && filter !== 'INACTIVE' ? filter : undefined;
      const brand =
        brandFilter === 'ALL'
          ? undefined
          : brandFilter === 'PRIMARY'
            ? null
            : brandFilter;
      const list = await itemsApi.list({
        includeInactive: filter === 'INACTIVE' || filter === 'ALL',
        status,
        categoryId: categoryId ?? undefined,
        brand,
        search: search.trim() || undefined,
      });
      setItems(list);
      if (selectedId && !list.some((i) => i.id === selectedId)) setSelectedId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [filter, brandFilter, search, selectedId]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormItemId(null);
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    }
    const editId = searchParams.get('edit');
    if (editId) {
      setFormItemId(editId);
      setSelectedId(editId);
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    }
    if (searchParams.get('import') === '1') {
      setImportOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const reloadCategories = useCallback(async () => {
    await itemCategoryService.seedDefaults();
    const cats = await itemCategoryService.list();
    setCategories(cats);
  }, []);

  useEffect(() => {
    void Promise.all([
      reloadCategories(),
      unitOfMeasureService.list(),
      godownService.seedDefaults().then(() => godownService.list({ includeInactive: false })),
    ]).then(([, uns, gds]) => {
      setUnits(uns);
      setGodowns(gds);
    });
  }, [reloadCategories]);

  useEffect(() => {
    void loadBrandOptions();
  }, [loadBrandOptions]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useInventoryItemsChanged(useCallback(() => {
    void loadBrandOptions();
    void loadItems();
  }, [loadBrandOptions, loadItems]));

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const [tx, hist] = await Promise.all([
        itemsApi.getTransactions(id),
        itemsApi.getHistory(id),
      ]);
      setTransactions(tx);
      setHistory(hist.history);
      setAdjustments(hist.adjustments);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else {
      setTransactions([]);
      setHistory([]);
      setAdjustments([]);
    }
  }, [selectedId, loadDetail]);

  const filteredItems = useMemo(() => searchInventoryItems(items, search), [items, search]);

  useBarcodeWedge({
    enabled: !formOpen && !importOpen && !scanNotFoundOpen,
    onScan: (code) => {
      const matches = findItemsByBarcode(items, code);
      if (matches.length === 1) {
        playScanBeep();
        trackFeatureUsage('barcodeScan');
        setSelectedId(matches[0].id);
        setSearch(code);
        return;
      }
      if (matches.length > 1) {
        setSearch(code);
        return;
      }
      setPendingScanBarcode(code);
      setScanNotFoundOpen(true);
    },
    isBlocked: () => formOpen || importOpen || scanNotFoundOpen,
  });

  const godownLabel = useCallback(
    (item: InventoryItem) => {
      const stocks = item.godownStocks?.filter((s) => s.quantity > 0) ?? [];
      if (stocks.length === 0) {
        const def = godowns.find((g) => g.isDefault)?.name ?? godowns[0]?.name;
        return def ?? '—';
      }
      return stocks
        .map((s) => {
          const name = godowns.find((g) => g.id === s.godownId)?.name ?? 'Godown';
          return `${name} (${s.quantity})`;
        })
        .join(', ');
    },
    [godowns]
  );

  const handleSubmit = async (values: ItemFormValues) => {
    setSaving(true);
    setError(null);
    try {
      const payload = formValuesToPayload(values, { isEdit: Boolean(formItemId) });
      if (formItemId) {
        await itemsApi.update(formItemId, payload);
      } else {
        const created = await itemsApi.create(payload);
        setSelectedId(created.id);
        if (created.barcode?.trim()) setPrintItem(created);
      }
      setFormOpen(false);
      setFormItemId(null);
      await loadBrandOptions();
      await loadItems();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
      if (isBarcodeDuplicateError(err)) return;
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!canManage || selectedIds.size === 0) return;
    for (const id of selectedIds) await itemsApi.remove(id);
    setSelectedIds(new Set());
    await loadItems();
  };

  const handleExport = async () => {
    const exportRows =
      selectedIds.size > 0
        ? filteredItems.filter((i) => selectedIds.has(i.id))
        : filteredItems;
    const catNames = new Map(categories.map((c) => [c.id, c.name]));
    const unitNames = new Map(units.map((u) => [u.id, u.symbol || u.name]));
    await exportItemsExcel(exportRows, catNames, unitNames);
  };

  const handleExportCsv = async () => {
    const exportRows =
      selectedIds.size > 0
        ? filteredItems.filter((i) => selectedIds.has(i.id))
        : filteredItems;
    const catNames = new Map(categories.map((c) => [c.id, c.name]));
    const unitNames = new Map(units.map((u) => [u.id, u.symbol || u.name]));
    await exportItemsCsv(exportRows, catNames, unitNames);
  };

  const openEdit = (id: string) => {
    setFormItemId(id);
    setFormOpen(true);
  };

  const handleDuplicate = async (id: string) => {
    const copy = await itemsApi.duplicate(id);
    await loadItems();
    setSelectedId(copy.id);
  };

  const handleDelete = async (id: string) => {
    if (!canManage) return;
    await itemsApi.remove(id);
    if (selectedId === id) setSelectedId(null);
    await loadItems();
  };

  const splitView = Boolean(selectedId);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: { lg: 'calc(100vh - 220px)' } }}>
      {!splitView ? (
        <Typography variant="h4" fontWeight={800} sx={{ mb: 1.5, color: tok.text }}>
          Items
        </Typography>
      ) : null}

      {error ? <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert> : null}
      {importMessage ? (
        <Alert severity="success" sx={{ mb: 1.5 }} onClose={() => setImportMessage(null)}>
          {importMessage}
        </Alert>
      ) : null}

      <Box
        sx={{
          display: 'flex',
          flex: 1,
          minHeight: 400,
          flexDirection: { xs: 'column', lg: 'row' },
          border: `1px solid ${tok.border}`,
          borderRadius: `${tok.radius}px`,
          bgcolor: tok.surface,
          overflow: 'hidden',
          transition: theme.transitions.create(['box-shadow'], { duration: 250 }),
        }}
      >
        <Box
          sx={{
            display: splitView ? { xs: 'none', lg: 'flex' } : 'flex',
            flexDirection: 'column',
            width: splitView ? { lg: 320 } : '100%',
            maxWidth: splitView ? { lg: 360 } : 'none',
            flexShrink: splitView ? 0 : 1,
            borderRight: splitView ? { lg: `1px solid ${tok.border}` } : 'none',
            transition: theme.transitions.create(['width', 'max-width'], { duration: 250, easing: 'ease-in-out' }),
            minWidth: 0,
          }}
        >
          <ItemsToolbar
            compact={splitView}
            categories={categories}
            brandOptions={brandOptions}
            filter={filter}
            brandFilter={brandFilter}
            search={search}
            onFilterChange={setFilter}
            onBrandFilterChange={setBrandFilter}
            onSearchChange={setSearch}
            onNew={() => { setFormItemId(null); setPendingScanBarcode(''); setFormOpen(true); }}
            onBulkDelete={canManage ? () => void handleBulkDelete() : undefined}
            onExport={() => void handleExport()}
            onExportCsv={() => void handleExportCsv()}
            onImport={canManage ? () => setImportOpen(true) : undefined}
          />

          {selectedIds.size > 0 ? (
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
              <BulkBarcodePrintButton
                items={items.filter((i) => selectedIds.has(i.id))}
              />
            </Box>
          ) : null}

          {splitView ? (
            <ItemsListPanel
              items={filteredItems}
              unitLabel={(id) => unitMap.get(id) ?? '—'}
              godownLabel={godownLabel}
              selectedId={selectedId}
              selectedIds={selectedIds}
              onSelect={setSelectedId}
              onToggleSelect={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              onToggleAll={() => {
                if (selectedIds.size === filteredItems.length) setSelectedIds(new Set());
                else setSelectedIds(new Set(filteredItems.map((i) => i.id)));
              }}
            />
          ) : (
            <ItemsTablePanel
              items={filteredItems}
              categoryLabel={(id) => (id ? categoryMap.get(id) ?? '—' : '—')}
              unitLabel={(id) => unitMap.get(id) ?? '—'}
              godownLabel={godownLabel}
              selectedId={selectedId}
              selectedIds={selectedIds}
              canManage={canManage}
              onSelect={setSelectedId}
              onToggleSelect={(id) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }}
              onToggleAll={() => {
                if (selectedIds.size === filteredItems.length) setSelectedIds(new Set());
                else setSelectedIds(new Set(filteredItems.map((i) => i.id)));
              }}
              onEdit={openEdit}
              onDuplicate={(id) => void handleDuplicate(id)}
              onDelete={(id) => void handleDelete(id)}
            />
          )}
        </Box>

        {splitView ? (
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              minHeight: { xs: 480, lg: 0 },
              transition: theme.transitions.create(['opacity', 'transform'], { duration: 250 }),
            }}
          >
            <ItemDetailPanel
              item={selectedItem}
              categoryName={selectedItem?.categoryId ? categoryMap.get(selectedItem.categoryId) ?? '—' : '—'}
              brandName={selectedItem?.brand?.trim() || 'Primary'}
              godowns={godowns}
              unitName={selectedItem ? unitMap.get(selectedItem.unitId) ?? '—' : '—'}
              loading={detailLoading}
              transactions={transactions}
              history={history}
              adjustments={adjustments}
              canManage={canManage}
              onEdit={() => selectedItem && openEdit(selectedItem.id)}
              onClose={() => setSelectedId(null)}
              onDuplicate={async () => {
                if (!selectedItem) return;
                await handleDuplicate(selectedItem.id);
              }}
              onDelete={async () => {
                if (!selectedItem) return;
                await handleDelete(selectedItem.id);
              }}
              onToggleStatus={async () => {
                if (!selectedItem || !canManage) return;
                await inventoryItemService.update(selectedItem.id, {
                  status: selectedItem.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
                });
                await loadItems();
                await loadDetail(selectedItem.id);
              }}
              onAdjustStock={() => navigate(`/items/adjustments/new?itemId=${selectedItem?.id ?? ''}`)}
            />
          </Box>
        ) : null}
      </Box>

      <ItemImportDialog
        open={importOpen}
        categories={categories}
        units={units}
        godowns={godowns}
        onClose={() => setImportOpen(false)}
        onImported={async (result) => {
          setImportMessage(
            `Imported: ${result.imported} · Updated: ${result.updated} · Failed: ${result.failed}`
          );
          await loadBrandOptions();
          await loadItems();
        }}
      />

      <ItemFormModal
        open={formOpen}
        itemId={formItemId}
        initialBarcode={pendingScanBarcode || undefined}
        units={units}
        categories={categories}
        godowns={godowns}
        brandOptions={brandOptions}
        saving={saving}
        onClose={() => { setFormOpen(false); setFormItemId(null); setPendingScanBarcode(''); }}
        onSubmit={(v) => void handleSubmit(v)}
        onOpenExistingItem={(id) => {
          setFormItemId(id);
          setPendingScanBarcode('');
        }}
        onCategoriesChange={() => void reloadCategories()}
        onGodownsChange={() => {
          void godownService.list({ includeInactive: false }).then(setGodowns);
        }}
        onBrandCreated={registerNewBrand}
      />

      <ItemNotFoundDialog
        open={scanNotFoundOpen}
        barcode={pendingScanBarcode}
        onCancel={() => {
          setScanNotFoundOpen(false);
          setPendingScanBarcode('');
        }}
        onConfirm={() => {
          setScanNotFoundOpen(false);
          setFormItemId(null);
          setFormOpen(true);
        }}
      />

      <PrintBarcodeLabelDialog
        open={Boolean(printItem)}
        item={printItem}
        onClose={() => setPrintItem(null)}
      />
    </Box>
  );
}
