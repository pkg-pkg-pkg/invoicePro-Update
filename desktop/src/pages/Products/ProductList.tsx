// src/pages/Products/ProductList.tsx
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  Checkbox,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  UploadFile as UploadFileIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import readXlsxFile from 'read-excel-file';
import Papa from 'papaparse';
import ExcelJS from 'exceljs';

import type { RootState } from '../../store';
import type { Product } from '../../store/slices/productSlice';
import {
  fetchProducts,
  deleteProduct,
  bulkDeleteProducts,
  bulkImportProducts,
  clearError,
  selectProducts,
  selectProductsLoading,
  selectProductsUploading,
  selectProductsError,
} from '../../store/slices/productSlice';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * NOTE: useDispatch is typed as `any` here to avoid mismatches while store
 * has temporary casts. If you later remove casts in store.ts, replace with:
 *   const dispatch = useDispatch<AppDispatch>();
 */
export default function ProductList(): JSX.Element {
  const navigate = useNavigate();
  const dispatch = useDispatch<any>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { canAccessFeature } = usePermissions();
  const canView = canAccessFeature('view-products');
  const canCreate = canAccessFeature('create-product');
  const canEdit = canAccessFeature('edit-product');
  const canDelete = canAccessFeature('delete-product');
  const canManageInventory = canAccessFeature('manage-inventory');

  const items = useSelector((state: RootState) => selectProducts(state));
  const loading = useSelector((state: RootState) => selectProductsLoading(state));
  const uploading = useSelector((state: RootState) => selectProductsUploading(state));
  const error = useSelector((state: RootState) => selectProductsError(state));

  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    // dispatch thunk; useDispatch<any>() prevents "UnknownAction" TS error here
    dispatch(fetchProducts());
  }, [dispatch]);

  const handleDelete = async (id: string) => {
    if (!canDelete) {
      window.alert('You do not have permission to delete products');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    await dispatch(deleteProduct(id));
  };

  const handleBulkDelete = async () => {
    if (!canDelete) {
      window.alert('You do not have permission to delete products');
      return;
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected products?`)) return;

    const res = await dispatch(bulkDeleteProducts(ids));
    const payload = (res as any)?.payload as any;
    const blocked = Array.isArray(payload?.blocked) ? payload.blocked : [];
    const deleted = Array.isArray(payload?.deleted) ? payload.deleted : [];
    setSelectedIds(new Set());
    setPage(0);

    if (blocked.length > 0) {
      window.alert(
        `Deleted: ${deleted.length}\nBlocked: ${blocked.length}\n\nBlocked items are used in billing or failed to delete.`
      );
    }
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(String(id));
      else next.delete(String(id));
      return next;
    });
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const mapRowsToProducts = (rows: any[]): Product[] => {
    const stamp = Date.now();
    return (rows as any[]).map((row: any, idx: number) => ({
      id: String(row.Code ?? row.code ?? `tmp-${stamp}-${idx}`),
      name: String(row.Name ?? row.name ?? 'Unnamed Product'),
      brandName: String(row.Brand ?? row.brand ?? 'Generic'),
      companyName: String(row.Company ?? row.company ?? 'Generic'),
      sku: row.SKU ?? row.sku,
      code: row.Code ?? row.code,
      hsn: String(row.HSN ?? row.hsn ?? '0000'),
      mrp: Number(row.MRP ?? row.mrp ?? 0),
      salePrice: Number(row.SalePrice ?? row.salePrice ?? 0),
      purchasePrice: Number(row.PurchasePrice ?? row.purchasePrice ?? 0),
      stock: Number(row.Stock ?? row.stock ?? 0),
      unit: String(row.Unit ?? row.unit ?? 'PCS'),
      gstRate: Number(row.GSTRate ?? row.gstRate ?? 18),
      minStockLevel: Number(row.MinStockLevel ?? row.minStockLevel ?? 5),
    }));
  };

  // make handler async so we can await dispatch and avoid .then on unknown
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const name = String(file.name ?? '').toLowerCase();
      const isCsv = name.endsWith('.csv');
      const isXlsx = name.endsWith('.xlsx');
      const isXls = name.endsWith('.xls');

      if (isXls) {
        window.alert('Old .xls format is not supported. Please save as .xlsx or .csv.');
        return;
      }

      let rowsAsObjects: any[] = [];

      if (isCsv) {
        const parsed = await new Promise<Papa.ParseResult<any>>((resolve, reject) => {
          Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (res) => resolve(res as any),
            error: (err) => reject(err),
          });
        });
        rowsAsObjects = (parsed.data ?? []) as any[];
      } else if (isXlsx) {
        const rows = await readXlsxFile(file);
        if (!rows.length) {
          window.alert('Empty file');
          return;
        }
        const headers = (rows[0] as any[]).map((h) => String(h ?? '').trim());
        rowsAsObjects = rows.slice(1).map((r: any[]) => {
          const obj: any = {};
          headers.forEach((h, i) => {
            if (!h) return;
            obj[h] = r?.[i];
          });
          return obj;
        });
      } else {
        window.alert('Unsupported file type. Please upload .xlsx or .csv');
        return;
      }

      const formattedData = mapRowsToProducts(rowsAsObjects);
      if (formattedData.length > 0) {
        await dispatch(bulkImportProducts(formattedData));
        await dispatch(fetchProducts());
        window.alert(`${formattedData.length} products imported successfully!`);
      }
    } finally {
      e.currentTarget.value = '';
    }
  };

  const downloadSample = async () => {
    const headers = [
      'Name',
      'Code',
      'HSN',
      'MRP',
      'SalePrice',
      'PurchasePrice',
      'Stock',
      'Unit',
      'GSTRate',
      'Brand',
      'Company',
      'MinStockLevel',
    ];

    const sampleRow = [
      'Sample Product',
      'P001',
      '8544',
      100,
      90,
      70,
      50,
      'PCS',
      18,
      'Generic',
      'Generic',
      5,
    ];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');
    ws.addRow(headers);
    ws.addRow(sampleRow);

    const buffer = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_upload_sample.xlsx';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const filteredProducts = (items ?? []).filter((p: Product) =>
    `${p.name ?? ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${p.hsn ?? ''}`.includes(searchTerm)
  );

  const pagedProducts = filteredProducts.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const allChecked = pagedProducts.length > 0 && pagedProducts.every((p) => selectedIds.has(String(p.id)));
  const someChecked = pagedProducts.some((p) => selectedIds.has(String(p.id)));

  if (!canView) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have permission to view products</Alert>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Product Inventory</Typography>
        <Box display="flex" gap={2}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".xlsx, .csv"
            onChange={handleFileUpload}
          />

          <Tooltip title="Download Sample Excel Format">
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<FileDownloadIcon />}
              onClick={downloadSample}
            >
              Template
            </Button>
          </Tooltip>

          <Button
            variant="outlined"
            startIcon={uploading ? <CircularProgress size={20} /> : <UploadFileIcon />}
            onClick={handleImportClick}
            disabled={uploading || !canManageInventory}
          >
            {uploading ? 'Importing...' : 'Bulk Import'}
          </Button>

          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/products/new')} disabled={!canCreate}>
            Add Product
          </Button>

          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={handleBulkDelete}
            disabled={selectedIds.size === 0 || loading || !canDelete}
          >
            Delete Selected ({selectedIds.size})
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => dispatch(clearError())} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 2, p: 2 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search by Name or HSN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          size="small"
        />
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={allChecked}
                  indeterminate={!allChecked && someChecked}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      for (const p of pagedProducts) {
                        const id = String(p.id);
                        if (checked) next.add(id);
                        else next.delete(id);
                      }
                      return next;
                    });
                  }}
                />
              </TableCell>
              <TableCell><strong>Name / Code</strong></TableCell>
              <TableCell><strong>HSN</strong></TableCell>
              <TableCell align="right"><strong>Purchase (₹)</strong></TableCell>
              <TableCell align="right"><strong>MRP (₹)</strong></TableCell>
              <TableCell align="right"><strong>Sale Price (₹)</strong></TableCell>
              <TableCell align="center"><strong>Stock</strong></TableCell>
              <TableCell align="center"><strong>GST %</strong></TableCell>
              <TableCell align="center"><strong>Actions</strong></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 3 }}>
                  No products found. Add new or import from Excel.
                </TableCell>
              </TableRow>
            ) : (
              pagedProducts.map((product: Product) => (
                <TableRow key={product.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.has(String(product.id))}
                      onChange={(e) => toggleSelect(String(product.id), e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{product.name}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {product.sku ?? product.id}
                    </Typography>
                  </TableCell>

                  <TableCell>{(product.hsn ?? (product as any).hsnCode ?? '') as any}</TableCell>
                  <TableCell align="right">{Number(product.purchasePrice ?? 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(product.mrp ?? 0).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    {Number(product.salePrice ?? 0).toFixed(2)}
                  </TableCell>

                  <TableCell align="center">
                    {(() => {
                      const stock = Number((product as any).stock ?? (product as any).currentStock ?? (product as any).openingStock ?? 0);
                      const unit = String((product as any).unit ?? '').trim();
                      const min = Number((product as any).minStockLevel ?? (product as any).lowStockAlert ?? 5);
                      return (
                    <Chip
                      label={`${stock} ${unit}`}
                      color={stock < min ? 'error' : 'default'}
                      size="small"
                    />
                      );
                    })()}
                  </TableCell>

                  <TableCell align="center">{Number((product as any).gstRate ?? 0)}%</TableCell>

                  <TableCell align="center">
                    <IconButton color="primary" onClick={() => navigate(`/products/edit/${product.id}`)} disabled={!canEdit}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDelete(String(product.id))} disabled={!canDelete}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={filteredProducts.length}
        page={page}
        onPageChange={(_e, newPage) => setPage(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => {
          setRowsPerPage(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[10, 25, 50, 100]}
      />
    </Box>
  );
}
