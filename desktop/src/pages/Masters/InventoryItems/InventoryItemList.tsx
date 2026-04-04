import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RestoreIcon from '@mui/icons-material/Restore';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadIcon from '@mui/icons-material/Upload';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';

import { inventoryItemService } from '../../../services/masters/inventoryItemService';
import { itemCategoryService } from '../../../services/masters/itemCategoryService';
import { unitOfMeasureService } from '../../../services/masters/unitOfMeasureService';
import { InventoryItem, InventoryStatus, ItemCategory, UnitOfMeasure } from '../../../types/masters';
import { useMasterList } from '../../../hooks/useMasterList';
import { usePermission } from '../../../hooks/usePermission';
import {
  exportInventoryItemsExcel,
  parseInventoryExcelBuffer,
} from './inventoryItemBulkExcel';

const statusOptions: { value: 'ALL' | InventoryStatus; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

const normalizeBulkRows = (rows: unknown): Partial<InventoryItem>[] => {
  if (!Array.isArray(rows)) {
    throw new Error('Uploaded file must contain an array of inventory items');
  }

  const stringFields: (keyof Pick<InventoryItem, 'id' | 'name' | 'sku' | 'barcode' | 'unitId' | 'categoryId'>)[] = [
    'id',
    'name',
    'sku',
    'barcode',
    'unitId',
    'categoryId',
  ];

  return rows.map((row, index) => {
    if (typeof row !== 'object' || row === null) {
      throw new Error(`Row ${index + 1} must be an object`);
    }

    const item = row as Partial<InventoryItem>;

    stringFields.forEach((field) => {
      const value = item[field];
      if (value == null) {
        return;
      }
      if (typeof value !== 'string') {
        throw new Error(`Row ${index + 1}: "${field}" must be a string`);
      }
      if (field === 'name' && !value.trim()) {
        throw new Error(`Row ${index + 1}: "name" cannot be empty`);
      }
    });

    if (!item.name || !item.name.trim()) {
      throw new Error(`Row ${index + 1}: "name" is required`);
    }

    if (item.status && item.status !== 'ACTIVE' && item.status !== 'INACTIVE') {
      throw new Error(`Row ${index + 1}: "status" must be "ACTIVE" or "INACTIVE"`);
    }

    return item;
  });
};

const InventoryItemList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can } = usePermission();

  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [units, setUnits] = useState<UnitOfMeasure[]>([]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'UNCATEGORIZED' | string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | InventoryStatus>('ALL');
  const [showInactive, setShowInactive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkParsedRows, setBulkParsedRows] = useState<Partial<InventoryItem>[] | null>(null);
  const [bulkParsingError, setBulkParsingError] = useState<string | null>(null);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkResultSummary, setBulkResultSummary] = useState<string | null>(null);
  const [bulkResultErrors, setBulkResultErrors] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    itemCategoryService
      .list({ includeInactive: false })
      .then(setCategories)
      .catch(() => setCategories([]));
    unitOfMeasureService
      .list({ includeInactive: false })
      .then(setUnits)
      .catch(() => setUnits([]));
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q != null && q !== '') {
      setSearch(q);
    }
  }, [searchParams]);

  const fetchItems = useCallback(() => {
    const categoryId =
      selectedCategory === 'ALL'
        ? undefined
        : selectedCategory === 'UNCATEGORIZED'
        ? null
        : selectedCategory;
    const status = statusFilter === 'ALL' ? undefined : statusFilter;
    return inventoryItemService.list({
      includeInactive: showInactive || status === 'INACTIVE',
      categoryId,
      status,
      search,
    });
  }, [search, selectedCategory, statusFilter, showInactive]);

  const { data: items, loading, error, refresh } = useMasterList<InventoryItem>(fetchItems);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [items]);

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((cat) => map.set(cat.id, cat.name));
    return map;
  }, [categories]);

  const unitMap = useMemo(() => {
    const map = new Map<string, string>();
    units.forEach((unit) => map.set(unit.id, unit.name));
    return map;
  }, [units]);

  const filteredItems = items; // Service already handles filtering

  const allVisibleIds = useMemo(() => filteredItems.map((item) => item.id), [filteredItems]);
  const allSelected = useMemo(
    () => allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id)),
    [allVisibleIds, selectedIds]
  );
  const isIndeterminate = selectedIds.size > 0 && !allSelected;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedIds(() => {
      if (allSelected) {
        return new Set();
      }
      return new Set(allVisibleIds);
    });
  };

  const handleSoftDelete = async (id: string) => {
    try {
      await inventoryItemService.softDelete(id);
      setActionMessage('Inventory item marked inactive');
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError((err as Error).message || 'Failed to deactivate inventory item');
      setActionMessage(null);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await inventoryItemService.restore(id);
      setActionMessage('Inventory item reactivated');
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError((err as Error).message || 'Failed to restore inventory item');
      setActionMessage(null);
    }
  };

  const handleRefresh = async () => {
    setActionMessage(null);
    setActionError(null);
    await refresh();
  };

  const handleDownloadExcel = async () => {
    const categoryNameById = new Map<string, string>();
    categories.forEach((c) => categoryNameById.set(c.id, c.name));
    const unitNameById = new Map<string, string>();
    units.forEach((u) => unitNameById.set(u.id, u.name));

    try {
      const buffer = await exportInventoryItemsExcel(filteredItems, categoryNameById, unitNameById);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `inventory-items-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setActionError((err as Error).message || 'Failed to export Excel');
    }
  };

  const openBulkDialog = () => {
    setBulkDialogOpen(true);
    setBulkParsedRows(null);
    setBulkParsingError(null);
    setBulkFileName(null);
    setBulkResultSummary(null);
    setBulkResultErrors([]);
  };

  const closeBulkDialog = () => {
    if (bulkUploading) return;
    setBulkDialogOpen(false);
  };

  const handleBulkFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBulkFileName(file.name);
    setBulkParsingError(null);
    setBulkParsedRows(null);
    setBulkResultSummary(null);
    setBulkResultErrors([]);
    const nameLower = file.name.toLowerCase();
    const isJson = nameLower.endsWith('.json') || file.type === 'application/json';
    try {
      let normalized: Partial<InventoryItem>[];
      if (isJson) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        normalized = normalizeBulkRows(parsed);
      } else {
        const buffer = await file.arrayBuffer();
        const rows = await parseInventoryExcelBuffer(buffer, categories, units);
        normalized = normalizeBulkRows(rows);
      }
      setBulkParsedRows(normalized);
    } catch (err) {
      setBulkParsingError((err as Error).message || 'Failed to read uploaded file');
    } finally {
      event.target.value = '';
    }
  };

  const handleProcessBulkUpload = async () => {
    if (!bulkParsedRows || !bulkParsedRows.length) {
      setBulkParsingError('Please choose an Excel (.xlsx) or JSON file before uploading');
      return;
    }
    setBulkUploading(true);
    setBulkParsingError(null);
    try {
      const result = await inventoryItemService.bulkUpsert(bulkParsedRows);
      const summary = `✓ ${result.created} item(s) added, ${result.updated} item(s) updated`;
      setBulkResultSummary(summary);
      setBulkResultErrors(result.errors);
      setActionMessage(`Bulk upload completed: ${result.created} created, ${result.updated} updated`);
      if (result.errors.length) {
        setActionError(result.errors.slice(0, 10).join('; '));
      } else {
        setActionError(null);
      }
      await refresh();
    } catch (err) {
      setBulkResultSummary(null);
      setBulkResultErrors([]);
      const message = (err as Error).message || 'Bulk upload failed';
      setBulkParsingError(message);
      setActionMessage(null);
      setActionError(message);
    } finally {
      setBulkUploading(false);
    }
  };

  const openBulkDeleteDialog = () => {
    if (!selectedIds.size) return;
    setBulkDeleteOpen(true);
  };

  const handleBulkDelete = async () => {
    if (!selectedIds.size) return;
    setBulkDeleting(true);
    try {
      const count = await inventoryItemService.bulkSoftDelete(Array.from(selectedIds));
      setActionMessage(`${count} inventory items marked inactive`);
      setActionError(null);
      setSelectedIds(new Set());
      await refresh();
    } catch (err) {
      setActionMessage(null);
      setActionError((err as Error).message || 'Failed to bulk delete items');
    } finally {
      setBulkDeleting(false);
      setBulkDeleteOpen(false);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setSelectedCategory('ALL');
    setStatusFilter('ALL');
    setShowInactive(false);
  };

  const canView = can('view-inventory');
  const canManage = can('manage-inventory');

  if (!canView) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">You do not have permission to view inventory items.</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5}>
        <Typography variant="h5" fontWeight={600}>
          Inventory Items
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" rowGap={1}>
          <Button variant="outlined" size="small" startIcon={<FileDownloadIcon />} onClick={() => void handleDownloadExcel()}>
            Download Excel
          </Button>
          {canManage && (
            <>
              <Button variant="outlined" size="small" startIcon={<UploadIcon />} onClick={openBulkDialog}>
                Bulk Upload/Edit
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                startIcon={<DeleteSweepIcon />}
                onClick={openBulkDeleteDialog}
                disabled={!selectedIds.size}
              >
                Bulk Delete ({selectedIds.size})
              </Button>
            </>
          )}
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Button variant="contained" onClick={() => navigate('/masters/inventory-items/new')}>
              New Inventory Item
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Search"
                placeholder="Search by name, SKU, or barcode"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
              />
              <FormControl fullWidth>
                <InputLabel id="category-filter-label">Category</InputLabel>
                <Select
                  labelId="category-filter-label"
                  label="Category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as typeof selectedCategory)}
                >
                  <MenuItem value="ALL">All categories</MenuItem>
                  <MenuItem value="UNCATEGORIZED">Uncategorized</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="status-filter-label">Status</InputLabel>
                <Select
                  labelId="status-filter-label"
                  label="Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  {statusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography variant="body2">Show inactive</Typography>
                <Switch checked={showInactive} onChange={(_, checked) => setShowInactive(checked)} />
              </Stack>
              <Button variant="text" onClick={handleClearFilters} sx={{ alignSelf: { xs: 'flex-end', md: 'flex-end' } }}>
                Clear filters
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {actionMessage && <Alert severity="success">{actionMessage}</Alert>}
      {actionError && <Alert severity="error">{actionError}</Alert>}
      {error && <Alert severity="error">{error.message}</Alert>}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={6}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={isIndeterminate}
                      checked={allSelected}
                      onChange={handleSelectAll}
                      inputProps={{ 'aria-label': 'Select all items' }}
                    />
                  </TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell align="right">Current Stock</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No inventory items found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onChange={() => toggleSelect(item.id)}
                          inputProps={{ 'aria-label': `Select ${item.name}` }}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography fontWeight={600}>{item.name}</Typography>
                          {item.barcode ? (
                            <Typography variant="caption" color="text.secondary">
                              Barcode: {item.barcode}
                            </Typography>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>{item.sku}</TableCell>
                      <TableCell>{item.categoryId ? categoryMap.get(item.categoryId) ?? '—' : 'Uncategorized'}</TableCell>
                      <TableCell>{unitMap.get(item.unitId) ?? '—'}</TableCell>
                      <TableCell align="right">{item.currentStock.toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={item.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                          color={item.status === 'ACTIVE' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="Edit">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/masters/inventory-items/${item.id}/edit`)}
                                disabled={!canManage}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {item.status === 'INACTIVE' ? (
                            <Tooltip title="Restore">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleRestore(item.id)}
                                  disabled={!canManage}
                                >
                                  <RestoreIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Deactivate">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleSoftDelete(item.id)}
                                  disabled={!canManage}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={bulkDialogOpen} onClose={closeBulkDialog} fullWidth maxWidth="sm">
        <DialogTitle>Bulk Upload or Edit Inventory Items</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                How to prepare your file
              </Typography>
              <Typography variant="body2" color="text.secondary">
                1. Click “Download Excel” to export the current list (or a sample template if empty).
              </Typography>
              <Typography variant="body2" color="text.secondary">
                2. Edit the spreadsheet — use category / unit names (or IDs in categoryId / unitId columns).
              </Typography>
              <Typography variant="body2" color="text.secondary">
                3. Upload the .xlsx file here. JSON upload is still supported for advanced use.
              </Typography>
              <Typography variant="caption" color="text.secondary" component="div">
                Non-zero opening stock needs godown splits: use column godownStocksJson with a JSON array of objects
                (fields godownId and quantity), or keep opening and current stock at 0.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button variant="contained" component="label">
                Choose Excel or JSON
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json"
                  onChange={handleBulkFileSelected}
                />
              </Button>
              <Typography variant="body2" color={bulkFileName ? 'text.primary' : 'text.secondary'}>
                {bulkFileName ?? 'No file selected'}
              </Typography>
            </Stack>

            {bulkParsingError && (
              <Alert severity="error" onClose={() => setBulkParsingError(null)}>
                {bulkParsingError}
              </Alert>
            )}

            {bulkParsedRows && (
              <Box>
                <Typography variant="subtitle2">Preview ({bulkParsedRows.length} row(s))</Typography>
                <Stack spacing={0.5} mt={1}>
                  {bulkParsedRows.slice(0, 5).map((row, idx) => (
                    <Typography key={`${row.id ?? row.sku ?? idx}`} variant="body2">
                      • {row.name} {row.sku ? `(SKU: ${row.sku})` : ''}
                    </Typography>
                  ))}
                </Stack>
                {bulkParsedRows.length > 5 && (
                  <Typography variant="caption" color="text.secondary">
                    + {bulkParsedRows.length - 5} more item(s)
                  </Typography>
                )}
              </Box>
            )}

            {bulkResultSummary && <Alert severity="success">{bulkResultSummary}</Alert>}
            {bulkResultErrors.length > 0 && (
              <Alert severity="warning">
                ⚠️ {bulkResultErrors.length} item(s) failed:
                <Box component="ul" sx={{ pl: 3, mt: 1, mb: 0 }}>
                  {bulkResultErrors.slice(0, 5).map((err, idx) => (
                    <li key={idx}>
                      <Typography variant="body2">{err}</Typography>
                    </li>
                  ))}
                </Box>
                {bulkResultErrors.length > 5 && (
                  <Typography variant="caption" color="text.secondary">
                    + {bulkResultErrors.length - 5} more error(s)
                  </Typography>
                )}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBulkDialog} disabled={bulkUploading}>
            Close
          </Button>
          <Button
            onClick={handleProcessBulkUpload}
            variant="contained"
            disabled={bulkUploading || !bulkParsedRows || !bulkParsedRows.length}
          >
            {bulkUploading ? 'Processing…' : 'Upload & Process'}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={bulkDeleteOpen} onClose={() => setBulkDeleteOpen(false)}>
        <DialogTitle>Bulk Delete Inventory Items</DialogTitle>
        <DialogContent>
          <DialogContentText>
            You are about to mark {selectedIds.size} inventory item(s) as inactive. This action can be reversed by restoring the
            item later. Continue?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>
            Cancel
          </Button>
          <Button onClick={handleBulkDelete} color="error" disabled={bulkDeleting}>
            {bulkDeleting ? 'Deleting…' : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
};

export default InventoryItemList;
