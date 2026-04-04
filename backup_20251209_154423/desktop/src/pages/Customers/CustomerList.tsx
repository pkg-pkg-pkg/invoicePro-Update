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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  fetchCustomers,
  deleteCustomer,
  setFilters,
  clearError,
} from '../../store/slices/partySlice';
import { Customer } from '../../services/partyService';

export default function CustomerList() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { customers = [], loading = false, error = null, pagination = { total: 0, page: 1, limit: 50, totalPages: 0 }, filters = {} } = useSelector((state: RootState) => state.parties || { customers: [], loading: false, error: null });

  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchCustomers(filters));
  }, [dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        dispatch(setFilters({ search: searchTerm, page: 1 }));
        dispatch(fetchCustomers({ ...filters, search: searchTerm, page: 1 }));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, dispatch]);

  const handleSearch = () => {
    dispatch(setFilters({ search: searchTerm, page: 1 }));
    dispatch(fetchCustomers({ ...filters, search: searchTerm, page: 1 }));
  };

  const handleGroupChange = (group: string) => {
    dispatch(setFilters({ group, page: 1 }));
    dispatch(fetchCustomers({ ...filters, group, page: 1 }));
  };

  const handleOutstandingToggle = () => {
    const newHasOutstanding = !filters.hasOutstanding;
    dispatch(setFilters({ hasOutstanding: newHasOutstanding, page: 1 }));
    dispatch(fetchCustomers({ ...filters, hasOutstanding: newHasOutstanding, page: 1 }));
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    dispatch(setFilters({ page: newPage + 1 }));
    dispatch(fetchCustomers({ ...filters, page: newPage + 1 }));
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    dispatch(setFilters({ limit: newLimit, page: 1 }));
    dispatch(fetchCustomers({ ...filters, limit: newLimit, page: 1 }));
  };

  const handleRefresh = () => {
    dispatch(fetchCustomers(filters));
  };

  const handleAdd = () => {
    navigate('/customers/new');
  };

  const handleEdit = (id: string) => {
    navigate(`/customers/edit/${id}`);
  };

  const handleViewLedger = (id: string) => {
    navigate(`/customers/ledger/${id}`);
  };

  const handleDeleteClick = (id: string) => {
    setCustomerToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (customerToDelete) {
      try {
        await dispatch(deleteCustomer(customerToDelete)).unwrap();
        dispatch(fetchCustomers(filters));
        setDeleteDialogOpen(false);
        setCustomerToDelete(null);
      } catch (err: any) {
        // Error is handled by Redux
        console.error('Delete error:', err);
      }
    }
  };

  const handleExport = () => {
    alert('Export to Excel - Coming soon');
  };

  const getOutstandingColor = (outstanding: number, creditLimit: number) => {
    if (outstanding === 0) return 'success';
    if (outstanding > creditLimit) return 'error';
    if (outstanding > creditLimit * 0.8) return 'warning';
    return 'info';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Customers</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          Add Customer
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

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Group</InputLabel>
            <Select
              value={filters.group || ''}
              onChange={(e) => handleGroupChange(e.target.value)}
              label="Group"
            >
              <MenuItem value="">All Groups</MenuItem>
              <MenuItem value="RETAIL">Retail</MenuItem>
              <MenuItem value="WHOLESALE">Wholesale</MenuItem>
              <MenuItem value="DISTRIBUTOR">Distributor</MenuItem>
              <MenuItem value="VIP">VIP</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant={filters.hasOutstanding ? 'contained' : 'outlined'}
            color={filters.hasOutstanding ? 'warning' : 'primary'}
            onClick={handleOutstandingToggle}
          >
            Has Outstanding
          </Button>

          <IconButton onClick={handleRefresh} title="Refresh">
            <RefreshIcon />
          </IconButton>

          <IconButton onClick={handleExport} title="Export to Excel">
            <FileDownloadIcon />
          </IconButton>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : customers.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No customers found</Typography>
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
                  <TableCell>Group</TableCell>
                  <TableCell>City/State</TableCell>
                  <TableCell align="right">Credit Limit</TableCell>
                  <TableCell align="right">Outstanding</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(customers as Customer[]).map((customer) => (
                  <TableRow
                    key={customer.id}
                    hover
                    sx={{
                      bgcolor:
                        Number(customer.currentBalance) > Number(customer.creditLimit)
                          ? 'error.light'
                          : 'inherit',
                    }}
                  >
                    <TableCell>{customer.code || '-'}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {customer.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{customer.phone}</TableCell>
                    <TableCell>{customer.gstin || '-'}</TableCell>
                    <TableCell>
                      <Chip label={customer.group} size="small" />
                    </TableCell>
                    <TableCell>
                      {customer.city}, {customer.state}
                    </TableCell>
                    <TableCell align="right">
                      ₹{Number(customer.creditLimit).toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      <Chip
                        label={`₹${Number(customer.currentBalance).toFixed(2)}`}
                        color={getOutstandingColor(
                          Number(customer.currentBalance),
                          Number(customer.creditLimit)
                        )}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={customer.isActive ? 'Active' : 'Inactive'}
                        color={customer.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="View Ledger">
                        <IconButton
                          size="small"
                          onClick={() => handleViewLedger(customer.id)}
                        >
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleEdit(customer.id)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteClick(customer.id)}
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
        <DialogTitle>Delete Customer</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this customer? This action cannot be undone.
            <br />
            <br />
            <strong>Note:</strong> Customers with existing transactions cannot be deleted.
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


