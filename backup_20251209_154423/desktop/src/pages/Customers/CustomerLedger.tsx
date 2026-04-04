import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Grid,
  IconButton,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store';
import { fetchCustomerLedger, fetchCustomer, clearError } from '../../store/slices/partySlice';

export default function CustomerLedger() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { currentParty, partyLedger, loading, error } = useSelector(
    (state: RootState) => state.parties
  );

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  useEffect(() => {
    if (id) {
      dispatch(fetchCustomer(id));
      dispatch(fetchCustomerLedger({ id, fromDate, toDate }));
    }
  }, [dispatch, id, fromDate, toDate]);

  const handleDateFilter = () => {
    if (id) {
      dispatch(fetchCustomerLedger({ id, fromDate, toDate }));
    }
  };

  const getTransactionColor = (type: string) => {
    if (type === 'PAYMENT') return 'success.main';
    if (type.includes('INVOICE')) return 'primary.main';
    if (type.includes('RETURN')) return 'warning.main';
    return 'text.primary';
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/customers')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">
          {currentParty ? `${(currentParty as any).name} - Ledger` : 'Customer Ledger'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {/* Date Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              label="From Date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              label="To Date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Button variant="contained" onClick={handleDateFilter} sx={{ mr: 2 }}>
              Apply Filter
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setFromDate('');
                setToDate('');
                if (id) {
                  dispatch(fetchCustomerLedger({ id }));
                }
              }}
            >
              Clear
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Summary Cards */}
      {partyLedger && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Opening Balance
                </Typography>
                <Typography variant="h6">
                  ₹{partyLedger.summary.totalDebit > 0 ? partyLedger.summary.totalDebit.toFixed(2) : '0.00'}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Debit
                </Typography>
                <Typography variant="h6" color="error">
                  ₹{partyLedger.summary.totalDebit.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Credit
                </Typography>
                <Typography variant="h6" color="success.main">
                  ₹{partyLedger.summary.totalCredit.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Closing Balance
                </Typography>
                <Typography
                  variant="h6"
                  color={partyLedger.summary.closingBalance > 0 ? 'error' : 'success.main'}
                >
                  ₹{partyLedger.summary.closingBalance.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Transactions Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : partyLedger && partyLedger.transactions.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No transactions found</Typography>
        </Paper>
      ) : (
        partyLedger && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Debit (₹)</TableCell>
                  <TableCell align="right">Credit (₹)</TableCell>
                  <TableCell align="right">Balance (₹)</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {partyLedger.transactions.map((transaction, index) => (
                  <TableRow key={index}>
                    <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{ color: getTransactionColor(transaction.type) }}
                      >
                        {transaction.type.replace('_', ' ')}
                      </Typography>
                    </TableCell>
                    <TableCell>{transaction.reference}</TableCell>
                    <TableCell>{transaction.description || '-'}</TableCell>
                    <TableCell align="right">
                      {transaction.debit > 0 ? `₹${transaction.debit.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell align="right">
                      {transaction.credit > 0 ? `₹${transaction.credit.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        color={transaction.balance > 0 ? 'error' : 'success.main'}
                        fontWeight="medium"
                      >
                        ₹{transaction.balance.toFixed(2)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      )}
    </Box>
  );
}

