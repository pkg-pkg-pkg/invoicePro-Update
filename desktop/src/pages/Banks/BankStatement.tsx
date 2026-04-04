import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  CircularProgress,
  Alert,
  IconButton,
  Grid,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Receipt as ReceiptIcon,
  Payment as PaymentIcon,
  Balance as ReconcileIcon,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store';
import {
  fetchBankStatement,
  reconcileBankAccount,
  clearBankStatement,
  clearError,
} from '../../store/slices/bankSlice';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { usePermissions } from '../../hooks/usePermissions';

export default function BankStatement() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { bankStatement, loading, error } = useSelector((state: RootState) => state.banks);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [reconcileDialogOpen, setReconcileDialogOpen] = useState(false);
  const [reconcileBalance, setReconcileBalance] = useState('');
  const [reconcileNotes, setReconcileNotes] = useState('');

  const { canAccessFeature } = usePermissions();
  const canViewStatements = canAccessFeature('view-bank-statements');
  const canEditBank = canAccessFeature('edit-bank');

  if (!canViewStatements) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have permission to view bank statements</Alert>
      </Box>
    );
  }

  useEffect(() => {
    if (id) {
      dispatch(fetchBankStatement({ id, fromDate, toDate, page, limit }));
    }

    return () => {
      dispatch(clearBankStatement());
    };
  }, [dispatch, id, fromDate, toDate, page, limit]);

  const handleRefresh = () => {
    if (id) {
      dispatch(fetchBankStatement({ id, fromDate, toDate, page, limit }));
    }
  };

  const handlePageChange = (_event: unknown, newPage: number) => {
    setPage(newPage + 1);
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setLimit(parseInt(event.target.value, 10));
    setPage(1);
  };

  const handleReconcile = () => {
    if (id && reconcileBalance) {
      dispatch(
        reconcileBankAccount({
          id,
          data: {
            balance: parseFloat(reconcileBalance),
            notes: reconcileNotes,
          },
        })
      ).then(() => {
        setReconcileDialogOpen(false);
        setReconcileBalance('');
        setReconcileNotes('');
        handleRefresh();
      });
    }
  };

  const getPaymentTypeColor = (type: string) => {
    return type === 'RECEIPT' ? 'success' : 'error';
  };

  const getPaymentTypeIcon = (type: string) => {
    return type === 'RECEIPT' ? <ReceiptIcon /> : <PaymentIcon />;
  };

  if (!id) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Bank account ID is missing</Alert>
      </Box>
    );
  }

  if (loading && !bankStatement) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      </Box>
    );
  }

  if (!bankStatement) {
    return null;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Bank Statement</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<ReconcileIcon />}
            disabled={!canEditBank}
            onClick={() => setReconcileDialogOpen(true)}
          >
            Reconcile
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRefresh}>
            Refresh
          </Button>
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Account Name
              </Typography>
              <Typography variant="h6">{bankStatement.bankAccount.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {bankStatement.bankAccount.accountNumber}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Opening Balance
              </Typography>
              <Typography variant="h6">{formatCurrency(bankStatement.bankAccount.openingBalance)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Current Balance
              </Typography>
              <Typography
                variant="h6"
                color={bankStatement.bankAccount.currentBalance >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(bankStatement.bankAccount.currentBalance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Transactions
              </Typography>
              <Typography variant="h6">{bankStatement.pagination.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="From Date"
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <TextField
            fullWidth
            label="To Date"
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
      </Grid>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell>Invoice</TableCell>
                <TableCell align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : bankStatement.statement.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No transactions found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                bankStatement.statement.map((entry: any) => (
                  <TableRow key={entry.id} hover>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>
                      <Chip
                        icon={getPaymentTypeIcon(entry.type)}
                        label={entry.type}
                        color={getPaymentTypeColor(entry.type)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatCurrency(entry.amount)}</TableCell>
                    <TableCell>{entry.paymentMode}</TableCell>
                    <TableCell>{entry.referenceNumber || '-'}</TableCell>
                    <TableCell>
                      {entry.invoice ? (
                        <Chip label={entry.invoice.invoiceNumber} size="small" />
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={entry.balance >= 0 ? 'success.main' : 'error.main'}
                        fontWeight="bold"
                      >
                        {formatCurrency(entry.balance)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={bankStatement.pagination.total}
          page={bankStatement.pagination.page - 1}
          onPageChange={handlePageChange}
          rowsPerPage={bankStatement.pagination.limit}
          onRowsPerPageChange={handleRowsPerPageChange}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      <Dialog open={reconcileDialogOpen} onClose={() => setReconcileDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reconcile Bank Account</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Enter the actual balance from your bank statement to reconcile the account.
          </DialogContentText>
          <TextField
            fullWidth
            label="Actual Balance"
            type="number"
            value={reconcileBalance}
            onChange={(e) => setReconcileBalance(e.target.value)}
            sx={{ mb: 2 }}
            InputProps={{
              startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>,
            }}
          />
          <TextField
            fullWidth
            label="Notes"
            multiline
            rows={3}
            value={reconcileNotes}
            onChange={(e) => setReconcileNotes(e.target.value)}
            placeholder="Optional notes about the reconciliation"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReconcileDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleReconcile} variant="contained" disabled={!reconcileBalance || loading}>
            {loading ? <CircularProgress size={24} /> : 'Reconcile'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
