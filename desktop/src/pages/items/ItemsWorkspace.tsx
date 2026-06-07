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
import { ItemsToolbar } from '../../components/items/ItemsToolbar';
import { ItemDetailPanel } from '../../components/items/ItemDetailPanel';
import { ItemFormModal, formValuesToPayload, type ItemFormValues } from '../../components/items/ItemFormModal';
import { usePermission } from '../../hooks/usePermission';
import { ItemImportDialog } from '../../components/items/ItemImportDialog';
import { exportItemsCsv, exportItemsExcel } from '../../services/items/itemImportService';
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
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [transactions, setTransactions] = useState<ItemTransactionRow[]>([]);
  const [history, setHistory] = useState<ItemHistoryEntry[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u.symbol || u.name])), [units]);
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const loadItems = useCallback(async () => {
    try {
      const status =
        filter === 'ACTIVE' ? 'ACTIVE' : filter === 'INACTIVE' ? 'INACTIVE' : undefined;
      const categoryId =
        filter !== 'ALL' && filter !== 'ACTIVE' && filter !== 'INACTIVE' ? filter : undefined;
      const list = await itemsApi.list({
        includeInactive: filter === 'INACTIVE' || filter === 'ALL',
        status,
        categoryId: categoryId ?? undefined,
        search: search.trim() || undefined,
      });
      setItems(list);
      if (selectedId && !list.some((i) => i.id === selectedId)) setSelectedId(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [filter, search, selectedId]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormMode('create');
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
    void loadItems();
  }, [loadItems]);

  useInventoryItemsChanged(loadItems);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  const formItem = useMemo(() => {
    if (formMode === 'edit') {
      return items.find((i) => i.id === (editItemId ?? selectedId)) ?? selectedItem;
    }
    return null;
  }, [formMode, editItemId, selectedId, selectedItem, items]);

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

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.name} ${i.sku} ${i.hsnCode ?? ''}`.toLowerCase().includes(q));
  }, [items, search]);

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
      const payload = formValuesToPayload(values);
      if (formMode === 'create') {
        const created = await itemsApi.create(payload);
        setSelectedId(created.id);
      } else if (formItem) {
        await itemsApi.update(formItem.id, payload);
      }
      setFormOpen(false);
      setEditItemId(null);
      await loadItems();
      if (selectedId) await loadDetail(selectedId);
    } catch (err) {
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
    const exportRows = selectedIds.size > 0 ? items.filter((i) => selectedIds.has(i.id)) : items;
    const catNames = new Map(categories.map((c) => [c.id, c.name]));
    const unitNames = new Map(units.map((u) => [u.id, u.symbol || u.name]));
    await exportItemsExcel(exportRows, catNames, unitNames);
  };

  const handleExportCsv = async () => {
    const exportRows = selectedIds.size > 0 ? items.filter((i) => selectedIds.has(i.id)) : items;
    const catNames = new Map(categories.map((c) => [c.id, c.name]));
    const unitNames = new Map(units.map((u) => [u.id, u.symbol || u.name]));
    await exportItemsCsv(exportRows, catNames, unitNames);
  };

  const openEdit = (id: string) => {
    setEditItemId(id);
    setFormMode('edit');
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
            filter={filter}
            search={search}
            onFilterChange={setFilter}
            onSearchChange={setSearch}
            onNew={() => { setFormMode('create'); setFormOpen(true); }}
            onBulkDelete={canManage ? () => void handleBulkDelete() : undefined}
            onExport={() => void handleExport()}
            onExportCsv={() => void handleExportCsv()}
            onImport={canManage ? () => setImportOpen(true) : undefined}
          />

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
            `Import complete: ${result.created} created, ${result.updated} updated` +
              (result.errors.length ? ` (${result.errors.length} row errors during save)` : '')
          );
          await loadItems();
        }}
      />

      <ItemFormModal
        open={formOpen}
        mode={formMode}
        item={formItem}
        units={units}
        categories={categories}
        godowns={godowns}
        saving={saving}
        onClose={() => { setFormOpen(false); setEditItemId(null); }}
        onSubmit={(v) => void handleSubmit(v)}
        onCategoriesChange={() => void reloadCategories()}
      />
    </Box>
  );
}
