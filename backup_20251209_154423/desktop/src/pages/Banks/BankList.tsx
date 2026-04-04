// src/pages/Banks/BankList.tsx
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
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Tooltip,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Receipt as ReceiptIcon,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store';
import {
  fetchBankAccounts,
  fetchBankSummary,
  deleteBankAccount,
  setFilters,
  clearError,
} from '../../store/slices/bankSlice';
import { BankAccountType } from "@gst-billing/shared";
import { formatCurrency } from '../../utils/formatters';

export default function BankList() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  // ---------- Robust selector ----------
  // Your store registers the bank reducer under the key `bank` (see store.ts).
  // Some components (older code) may expect `state.banks`. Use whichever exists.
  const rootStateAny = useSelector((state: RootState) => state as any);
  const bankSlice = rootStateAny.bank ?? rootStateAny.banks ?? undefined;

  // ---------- Defensive defaults so destructuring never crashes ----------
  const {
    bankAccounts = [],
    summary = null,
    loading = false,
    error = null,
    filters = { search: '', accountType: undefined, isActive: undefined },
  } = bankSlice ?? {};

  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bankToDelete, setBankToDelete] = useState<string | null>(null);

  useEffect(() => {
    // On mount: fetch accounts + summary (only if slice exists)
    if (bankSlice) {
      dispatch(fetchBankAccounts(filters));
      dispatch(fetchBankSummary());
    } else {
      // Helpful diagnostic in dev console to find reducer-key mismatch
      // eslint-disable-next-line no-console
      console.warn('[BankList] bank slice not found on root state. Root keys:', Object.keys(rootStateAny));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm !== filters.search) {
        dispatch(setFilters({ search: searchTerm }));
        dispatch(fetchBankAccounts({ ...filters, search: searchTerm }));
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, dispatch, filters]);

  const handleSearch = () => {
    dispatch(setFilters({ search: searchTerm }));
    dispatch(fetchBankAccounts({ ...filters, search: searchTerm }));
  };

  const handleAccountTypeChange = (accountType: string) => {
    const newType = accountType === 'all' ? undefined : accountType;
    dispatch(setFilters({ accountType: newType as BankAccountType }));
    dispatch(fetchBankAccounts({ ...filters, accountType: newType as BankAccountType }));
  };

  const handleActiveFilter = (isActive: string) => {
    const active = isActive === 'all' ? undefined : isActive === 'true';
    dispatch(setFilters({ isActive: active }));
    dispatch(fetchBankAccounts({ ...filters, isActive: active }));
  };

  const handleRefresh = () => {
    dispatch(fetchBankAccounts(filters));
    dispatch(fetchBankSummary());
  };

  const handleDelete = (id: string) => {
    setBankToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (bankToDelete) {
      dispatch(deleteBankAccount(bankToDelete));
      setDeleteDialogOpen(false);
      setBankToDelete(null);
    }
  };

  const getAccountTypeColor = (type: BankAccountType) => {
    switch (type) {
      case BankAccountType.CASH:
        return 'success';
      case BankAccountType.CURRENT:
        return 'primary';
      case BankAccountType.SAVINGS:
        return 'info';
      default:
        return 'default';
    }
  };

  // If the slice is missing entirely, show a helpful message instead of crashing
  if (!bankSlice) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Internal error: bank state not found. Check your <code>store.ts</code> reducer keys.
        </Alert>
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2">
            Available root keys (dev): {Object.keys(rootStateAny).join(', ')}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <Button variant="outlined" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  // ---------- Normal render (unchanged) ----------
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
        <Typography variant="h4">Bank Accounts</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/banks/new')}
          >
            New Bank Account
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

      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Balance
                </Typography>
                <Typography variant="h5">{formatCurrency(summary.totalBalance)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Cash Balance
                </Typography>
                <Typography variant="h5" color="success.main">
                  {formatCurrency(summary.cashBalance)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Bank Balance
                </Typography>
                <Typography variant="h5" color="primary.main">
                  {formatCurrency(summary.bankBalance)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Accounts
                </Typography>
                <Typography variant="h5">{summary.accountCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            placeholder="Search by name, account number, bank name..."
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
            <InputLabel>Account Type</InputLabel>
            <Select
              value={filters.accountType || 'all'}
              label="Account Type"
              onChange={(e) => handleAccountTypeChange(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              {Object.values(BankAccountType).map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={2}>
          <FormControl fullWidth>
            <InputLabel>Status</InputLabel>
            <Select
              value={filters.isActive === undefined ? 'all' : filters.isActive ? 'true' : 'false'}
              label="Status"
              onChange={(e) => handleActiveFilter(e.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Account Number</TableCell>
                <TableCell>Bank Name</TableCell>
                <TableCell>IFSC Code</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Opening Balance</TableCell>
                <TableCell align="right">Current Balance</TableCell>
                <TableCell>Status</TableCell>
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
              ) : bankAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No bank accounts found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                bankAccounts.map((bank: any) => (
                  <TableRow key={bank.id} hover>
                    <TableCell>{bank.name}</TableCell>
                    <TableCell>{bank.accountNumber}</TableCell>
                    <TableCell>{bank.bankName}</TableCell>
                    <TableCell>{bank.ifscCode}</TableCell>
                    <TableCell>
                      <Chip
                        label={bank.accountType}
                        color={getAccountTypeColor(bank.accountType)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">{formatCurrency(bank.openingBalance)}</TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={bank.currentBalance >= 0 ? 'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {formatCurrency(bank.currentBalance)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={bank.isActive ? 'Active' : 'Inactive'}
                        color={bank.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Statement">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/banks/${bank.id}/statement`)}
                        >
                          <ReceiptIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/banks/edit/${bank.id}`)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(bank.id)}
                          disabled={!bank.isActive || (bank._count?.payments || 0) > 0}
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
      </Paper>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Bank Account</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this bank account? This action cannot be undone.
            Bank accounts with existing payments cannot be deleted.
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
