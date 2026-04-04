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
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store';
import {
  fetchPayments,
  deletePayment,
  setFilters,
  clearError,
} from '../../store/slices/paymentSlice';
import { PaymentType, PaymentMode } from "@gst-billing/shared";
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function PaymentList() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  
  // ✅ FIXED: state.payment (not state.payments)
  const paymentState = useSelector((state: RootState) => state.payment);
  
  // ✅ Defensive destructuring with defaults
  const {
    items: payments = [],
    loading = false,
    error = null,
    filters = {}
  } = paymentState || {};

  // ✅ Default pagination if not in state
  const pagination = {
    total: payments.length,
    page: filters.page || 1,
    limit: filters.limit || 10
  };

  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);

  useEffect(() => {
    dispatch(fetchPayments(filters));
  }, [dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        dispatch(setFilters({ search: searchTerm }));
        dispatch(fetchPayments({ ...filters, search: searchTerm }));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, dispatch, filters]);

  const handleSearch = () => {
    dispatch(setFilters({ search: searchTerm }));
    dispatch(fetchPayments({ ...filters, search: searchTerm }));
  };

  const handleTypeChange = (type: string) => {
    const newType = type === 'all' ? undefined : type;
    dispatch(setFilters({ type: newType as PaymentType }));
    dispatch(fetchPayments({ ...filters, type: newType as PaymentType }));
  };

  const handlePartyTypeChange = (partyType: string) => {
    const newPartyType = partyType === 'all' ? undefined : partyType;
    dispatch(setFilters({ partyType: newPartyType as any }));
    dispatch(fetchPayments({ ...filters, partyType: newPartyType as any }));
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    dispatch(setFilters({ page: newPage + 1 }));
    dispatch(fetchPayments({ ...filters, page: newPage + 1 }));
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newLimit = parseInt(event.target.value, 10);
    dispatch(setFilters({ limit: newLimit, page: 1 }));
    dispatch(fetchPayments({ ...filters, limit: newLimit, page: 1 }));
  };

  const handleRefresh = () => {
    dispatch(fetchPayments(filters));
  };

  const handleDelete = (id: string) => {
    setPaymentToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (paymentToDelete) {
      dispatch(deletePayment(paymentToDelete));
      setDeleteDialogOpen(false);
      setPaymentToDelete(null);
    }
  };

  const getPaymentTypeColor = (type: PaymentType) => {
    return type === 'RECEIPT' ? 'success' : 'error';
  };

  const getPaymentTypeIcon = (type: PaymentType) => {
    return type === 'RECEIPT' ? <ReceiptIcon /> : <PaymentIcon />;
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Payments</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/payments/new')}
          >
            New Payment
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            placeholder="Search by reference, cheque number, notes..."
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
          />
        </Grid>
        <Grid item xs={12} md={2}>
          <FormControl fullWidth>
            <InputLabel>Type</InputLabel>
            <Select
              value={filters.type || 'all'}
              label="Type"
              onChange={(e) => handleTypeChange(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value={PaymentType.RECEIPT}>Receipt</MenuItem>
              <MenuItem value={PaymentType.PAYMENT}>Payment</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={2}>
          <FormControl fullWidth>
            <InputLabel>Party Type</InputLabel>
            <Select
              value={filters.partyType || 'all'}
              label="Party Type"
              onChange={(e) => handlePartyTypeChange(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="CUSTOMER">Customer</MenuItem>
              <MenuItem value="SUPPLIER">Supplier</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={2}>
          <FormControl fullWidth>
            <InputLabel>Payment Mode</InputLabel>
            <Select
              value={filters.paymentMode || 'all'}
              label="Payment Mode"
              onChange={(e) => {
                const mode = e.target.value === 'all' ? undefined : e.target.value;
                dispatch(setFilters({ paymentMode: mode as PaymentMode }));
                dispatch(fetchPayments({ ...filters, paymentMode: mode as PaymentMode }));
              }}
            >
              <MenuItem value="all">All</MenuItem>
              {Object.values(PaymentMode).map((mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Party</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Bank</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No payments found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((payment: any) => (
                  <TableRow key={payment.id} hover>
                    <TableCell>{formatDate(payment.date)}</TableCell>
                    <TableCell>
                      <Chip
                        icon={getPaymentTypeIcon(payment.type)}
                        label={payment.type}
                        color={getPaymentTypeColor(payment.type)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {payment.party?.name || payment.partyId}
                    </TableCell>
                    <TableCell>{formatCurrency(payment.amount)}</TableCell>
                    <TableCell>{payment.paymentMode}</TableCell>
                    <TableCell>
                      {payment.referenceNumber || payment.chequeNumber || '-'}
                    </TableCell>
                    <TableCell>
                      {payment.bank?.name || '-'}
                    </TableCell>
                    <TableCell>
                      {payment.invoice ? (
                        <Tooltip title={`${payment.invoice.type} - ${formatCurrency(payment.invoice.grandTotal)}`}>
                          <Chip
                            label={payment.invoice.invoiceNumber}
                            size="small"
                            color={payment.invoice.paymentStatus === 'PAID' ? 'success' : 'default'}
                          />
                        </Tooltip>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/payments/edit/${payment.id}`)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(payment.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={pagination.total}
          page={pagination.page - 1}
          onPageChange={handlePageChange}
          rowsPerPage={pagination.limit}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Payment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this payment? This action cannot be undone and will
            affect party balances.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
