import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  FileDownload as FileDownloadIcon,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store';
import {
  fetchSuppliers,
  deleteSupplier,
  setFilters,
  clearError,
} from '../../store/slices/partySlice';
import { Supplier } from '../../services/partyService';

export default function SupplierList() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { suppliers, loading, error, pagination, filters } = useSelector(
    (state: RootState) => state.parties
  );

  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchSuppliers(filters));
  }, [dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        dispatch(setFilters({ search: searchTerm, page: 1 }));
        dispatch(fetchSuppliers({ ...filters, search: searchTerm, page: 1 }));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, dispatch]);

  const handleSearch = () => {
    dispatch(setFilters({ search: searchTerm, page: 1 }));
    dispatch(fetchSuppliers({ ...filters, search: searchTerm, page: 1 }));
  };

  const handlePayableToggle = () => {
    const newHasPayable = !filters.hasPayable;
    dispatch(setFilters({ hasPayable: newHasPayable, page: 1 }));
    dispatch(fetchSuppliers({ ...filters, hasPayable: newHasPayable, page: 1 }));
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    dispatch(setFilters({ page: newPage + 1 }));
    dispatch(fetchSuppliers({ ...filters, page: newPage + 1 }));
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    dispatch(setFilters({ limit: newLimit, page: 1 }));
    dispatch(fetchSuppliers({ ...filters, limit: newLimit, page: 1 }));
  };

  const handleRefresh = () => {
    dispatch(fetchSuppliers(filters));
  };

  const handleAdd = () => {
    navigate('/suppliers/new');
  };

  const handleEdit = (id: string) => {
    navigate(`/suppliers/edit/${id}`);
  };

  const handleViewLedger = (id: string) => {
    navigate(`/suppliers/ledger/${id}`);
  };

  const handleDeleteClick = (id: string) => {
    setSupplierToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (supplierToDelete) {
      try {
        await dispatch(deleteSupplier(supplierToDelete)).unwrap();
        dispatch(fetchSuppliers(filters));
        setDeleteDialogOpen(false);
        setSupplierToDelete(null);
      } catch (err: any) {
        console.error('Delete error:', err);
      }
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Suppliers</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Supplier
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search by name, phone, or GSTIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1, minWidth: 300 }}
          />

          <Button
            variant={filters.hasPayable ? 'contained' : 'outlined'}
            color={filters.hasPayable ? 'warning' : 'primary'}
            onClick={handlePayableToggle}
          >
            Has Payable
          </Button>

          <IconButton onClick={handleRefresh} title="Refresh">
            <RefreshIcon />
          </IconButton>

          <IconButton title="Export to Excel">
            <FileDownloadIcon />
          </IconButton>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : suppliers.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No suppliers found</Typography>
          </Box>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>GSTIN</TableCell>
                  <TableCell>City/State</TableCell>
                  <TableCell align="right">Payable</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(suppliers as Supplier[]).map((supplier) => (
                  <TableRow key={supplier.id} hover>
                    <TableCell>{supplier.code || '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {supplier.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{supplier.phone}</TableCell>
                    <TableCell>{supplier.gstin || '-'}</TableCell>
                    <TableCell>
                      {supplier.city}, {supplier.state}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`₹${Number(supplier.currentBalance).toFixed(2)}`}
                        color={Number(supplier.currentBalance) > 0 ? 'warning' : 'success'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={supplier.isActive ? 'Active' : 'Inactive'}
                        color={supplier.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Ledger">
                        <IconButton size="small" onClick={() => handleViewLedger(supplier.id)}>
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(supplier.id)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(supplier.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={pagination.total}
              page={pagination.page - 1}
              onPageChange={handlePageChange}
              rowsPerPage={pagination.limit}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </TableContainer>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Supplier</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this supplier? This action cannot be undone.
            <br />
            <br />
            <strong>Note:</strong> Suppliers with existing transactions cannot be deleted.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

