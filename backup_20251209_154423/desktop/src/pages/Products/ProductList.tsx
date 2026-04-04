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
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  UploadFile as UploadFileIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';

import type { RootState } from '../../store';
import type { Product } from '../../store/slices/productSlice';
import {
  fetchProducts,
  deleteProduct,
  bulkImportProducts,
  clearError,
  selectProducts,
  selectProductsLoading,
  selectProductsUploading,
  selectProductsError,
} from '../../store/slices/productSlice';

/**
 * NOTE: useDispatch is typed as `any` here to avoid mismatches while store
 * has temporary casts. If you later remove casts in store.ts, replace with:
 *   const dispatch = useDispatch<AppDispatch>();
 */
export default function ProductList(): JSX.Element {
  const navigate = useNavigate();
  const dispatch = useDispatch<any>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const items = useSelector((state: RootState) => selectProducts(state));
  const loading = useSelector((state: RootState) => selectProductsLoading(state));
  const uploading = useSelector((state: RootState) => selectProductsUploading(state));
  const error = useSelector((state: RootState) => selectProductsError(state));

  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // dispatch thunk; useDispatch<any>() prevents "UnknownAction" TS error here
    dispatch(fetchProducts());
  }, [dispatch]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    await dispatch(deleteProduct(id));
  };

  const handleImportClick = () => fileInputRef.current?.click();

  // make handler async so we can await dispatch and avoid .then on unknown
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const arrayBuffer = evt.target?.result as ArrayBuffer;
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      const formattedData: Product[] = (data as any[]).map((row: any) => ({
        id: String(row.Code ?? row.code ?? `tmp-${Math.floor(Math.random() * 1000000)}`),
        name: String(row.Name ?? row.name ?? 'Unnamed Product'),
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

      if (formattedData.length > 0) {
        // await dispatch so TS sees Promise-like flow (we used useDispatch<any()])
        await dispatch(bulkImportProducts(formattedData));
        await dispatch(fetchProducts());
        window.alert(`${formattedData.length} products imported successfully!`);
      }
    };

    reader.readAsArrayBuffer(file);
    e.currentTarget.value = '';
  };

  const downloadSample = () => {
    const sampleData = [
      {
        Name: 'Sample Product',
        Code: 'P001',
        HSN: '8544',
        MRP: 100,
        SalePrice: 90,
        PurchasePrice: 70,
        Stock: 50,
        Unit: 'PCS',
        GSTRate: 18,
      },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, 'bulk_upload_sample.xlsx');
  };

  const filteredProducts = (items ?? []).filter((p: Product) =>
    `${p.name ?? ''}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    `${p.hsn ?? ''}`.includes(searchTerm)
  );

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Product Inventory</Typography>
        <Box display="flex" gap={2}>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".xlsx, .xls, .csv"
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
            disabled={uploading}
          >
            {uploading ? 'Importing...' : 'Bulk Import'}
          </Button>

          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/products/new')}>
            Add Product
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
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 3 }}>
                  No products found. Add new or import from Excel.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product: Product) => (
                <TableRow key={product.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{product.name}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {product.sku ?? product.id}
                    </Typography>
                  </TableCell>

                  <TableCell>{product.hsn}</TableCell>
                  <TableCell align="right">{Number(product.purchasePrice ?? 0).toFixed(2)}</TableCell>
                  <TableCell align="right">{Number(product.mrp ?? 0).toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    {Number(product.salePrice ?? 0).toFixed(2)}
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={`${product.stock ?? 0} ${product.unit ?? ''}`}
                      color={Number(product.stock ?? 0) < (product.minStockLevel ?? 5) ? 'error' : 'default'}
                      size="small"
                    />
                  </TableCell>

                  <TableCell align="center">{product.gstRate ?? 0}%</TableCell>

                  <TableCell align="center">
                    <IconButton color="primary" onClick={() => navigate(`/products/edit/${product.id}`)}>
                      <EditIcon />
                    </IconButton>
                    <IconButton color="error" onClick={() => handleDelete(String(product.id))}>
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
