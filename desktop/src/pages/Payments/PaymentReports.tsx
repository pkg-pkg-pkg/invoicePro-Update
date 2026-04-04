import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RootState, AppDispatch } from '../../store';
import { fetchPayments } from '../../store/slices/paymentSlice';
import { fetchCustomers, fetchSuppliers } from '../../store/slices/partySlice';
import {
  Box,
  Paper,
  Typography,
  Card,
  CardContent,
  Grid,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Button,
  Chip,
  Divider
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { PaymentType, PartyType } from "@gst-billing/shared";

type ReportView = 'summary' | 'receivable' | 'payable';

export default function PaymentReports() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { items: payments = [], loading } = useSelector((state: RootState) => state.payments);
  const { customers = [] } = useSelector((state: RootState) => state.parties);
  const { suppliers = [] } = useSelector((state: RootState) => state.parties);

  const [view, setView] = useState<ReportView>('summary');

  useEffect(() => {
    dispatch(fetchPayments());
    dispatch(fetchCustomers());
    dispatch(fetchSuppliers());
  }, [dispatch]);

  // Calculate totals
  const receivableTotal = payments
    .filter(p => p.type === PaymentType.RECEIPT)
    .reduce((sum, p) => sum + p.amount, 0);

  const payableTotal = payments
    .filter(p => p.type === PaymentType.PAYMENT)
    .reduce((sum, p) => sum + p.amount, 0);

  // Group payments by party
  const receivableByParty = payments
    .filter(p => p.type === PaymentType.RECEIPT)
    .reduce((acc, payment) => {
      const partyId = payment.partyId;
      if (!acc[partyId]) {
        acc[partyId] = { total: 0, count: 0, partyName: getPartyName(partyId, payment.partyType) };
      }
      acc[partyId].total += payment.amount;
      acc[partyId].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number; partyName: string }>);

  const payableByParty = payments
    .filter(p => p.type === PaymentType.PAYMENT)
    .reduce((acc, payment) => {
      const partyId = payment.partyId;
      if (!acc[partyId]) {
        acc[partyId] = { total: 0, count: 0, partyName: getPartyName(partyId, payment.partyType) };
      }
      acc[partyId].total += payment.amount;
      acc[partyId].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number; partyName: string }>);

  function getPartyName(partyId: string, partyType: PartyType): string {
    if (partyType === PartyType.CUSTOMER) {
      const customer = customers.find(c => c.id === partyId);
      return customer?.name || 'Unknown Customer';
    } else {
      const supplier = suppliers.find(s => s.id === partyId);
      return supplier?.name || 'Unknown Supplier';
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>Payment Reports</Typography>

      {view === 'summary' && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                cursor: 'pointer',
                '&:hover': { boxShadow: 3 },
                border: '2px solid',
                borderColor: 'success.main'
              }}
              onClick={() => setView('receivable')}
            >
              <CardContent>
                <Typography variant="h6" color="success.main" gutterBottom>
                  Receivable (Customer Payments)
                </Typography>
                <Typography variant="h4" color="success.main" sx={{ fontWeight: 'bold' }}>
                  ₹{receivableTotal.toLocaleString('en-IN')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total amount received from customers
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Chip
                    label={`${Object.keys(receivableByParty).length} Customers`}
                    color="success"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card
              sx={{
                cursor: 'pointer',
                '&:hover': { boxShadow: 3 },
                border: '2px solid',
                borderColor: 'warning.main'
              }}
              onClick={() => setView('payable')}
            >
              <CardContent>
                <Typography variant="h6" color="warning.main" gutterBottom>
                  Payable (Supplier Payments)
                </Typography>
                <Typography variant="h4" color="warning.main" sx={{ fontWeight: 'bold' }}>
                  ₹{payableTotal.toLocaleString('en-IN')}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total amount paid to suppliers
                </Typography>
                <Box sx={{ mt: 2 }}>
                  <Chip
                    label={`${Object.keys(payableByParty).length} Suppliers`}
                    color="warning"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {view === 'receivable' && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Button onClick={() => setView('summary')} startIcon={<ArrowBackIcon />} sx={{ mr: 2 }}>
              Back to Summary
            </Button>
            <Typography variant="h5">Receivable Details - Customer Wise</Typography>
          </Box>

          <Typography variant="h6" color="success.main" sx={{ mb: 2 }}>
            Total Receivable: ₹{receivableTotal.toLocaleString('en-IN')}
          </Typography>

          <Divider sx={{ mb: 3 }} />

          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Customer Name</strong></TableCell>
                <TableCell align="right"><strong>Number of Payments</strong></TableCell>
                <TableCell align="right"><strong>Total Amount</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(receivableByParty).map(([partyId, data]) => (
                <TableRow key={partyId} hover>
                  <TableCell>{data.partyName}</TableCell>
                  <TableCell align="right">{data.count}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    ₹{data.total.toLocaleString('en-IN')}
                  </TableCell>
                </TableRow>
              ))}
              {Object.keys(receivableByParty).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No receivable payments found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}

      {view === 'payable' && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Button onClick={() => setView('summary')} startIcon={<ArrowBackIcon />} sx={{ mr: 2 }}>
              Back to Summary
            </Button>
            <Typography variant="h5">Payable Details - Supplier Wise</Typography>
          </Box>

          <Typography variant="h6" color="warning.main" sx={{ mb: 2 }}>
            Total Payable: ₹{payableTotal.toLocaleString('en-IN')}
          </Typography>

          <Divider sx={{ mb: 3 }} />

          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Supplier Name</strong></TableCell>
                <TableCell align="right"><strong>Number of Payments</strong></TableCell>
                <TableCell align="right"><strong>Total Amount</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(payableByParty).map(([partyId, data]) => (
                <TableRow key={partyId} hover>
                  <TableCell>{data.partyName}</TableCell>
                  <TableCell align="right">{data.count}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    ₹{data.total.toLocaleString('en-IN')}
                  </TableCell>
                </TableRow>
              ))}
              {Object.keys(payableByParty).length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                    <Typography variant="body1" color="text.secondary">
                      No payable payments found
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Box>
  );
}
