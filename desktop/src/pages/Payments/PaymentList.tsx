// src/pages/Payments/PaymentList.tsx
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from '../../store';
import { deletePayment, fetchPayments } from '../../store/slices/paymentSlice';
import { validateTransactionDate } from '../../services/appSettingsService';
import { Box, Paper, Typography, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, Alert, Button, IconButton } from '@mui/material';
import { Add as AddIcon, Assessment as AssessmentIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { usePermissions } from '../../hooks/usePermissions';

export default function PaymentList() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { items: payments = [], loading, error } = useSelector((state: RootState) => state.payments);

  const { canAccessFeature } = usePermissions();
  const canView = true; // canAccessFeature('view-payments');
  const canCreate = true; // canAccessFeature('create-payment');
  const canEdit = true; // canAccessFeature('edit-payment');
  const canDelete = true; // canAccessFeature('delete-payment');

  const handleNewPayment = () => {
    console.log('🔍 New Payment button clicked');
    console.log('🔍 Current path:', window.location.pathname);
    console.log('🔍 Navigating to: /payments/new');
    navigate('/payments/new');
  };

  const handleDelete = async (p: any) => {

    const dv = validateTransactionDate(String((p as any)?.date ?? ''));
    if (!dv.ok) {
      alert(dv.message);
      return;
    }

    const ok = window.confirm(`Delete payment ${String(p?.referenceNumber ?? p?.id ?? '')}?`);
    if (!ok) return;

    try {
      await dispatch(deletePayment(String(p.id))).unwrap();
    } catch (err: any) {
      alert(err?.message ?? 'Failed to delete payment');
    }
  };

  useEffect(() => {
    dispatch(fetchPayments());
  }, [dispatch]);

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{String(error)}</Alert>
      </Box>
    );
  }

  if (!canView) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have permission to view payments</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Payments</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<AssessmentIcon />}
            onClick={() => navigate('reports')}
          >
            Reports
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleNewPayment}
            disabled={!canCreate}
          >
            New Payment
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (!payments || payments.length === 0) ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No payments found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your first payment to get started
            </Typography>
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Reference</TableCell>
                <TableCell>Cheque bank</TableCell>
                <TableCell>Party</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map((p: any) => (
                <TableRow
                  key={p.id}
                  hover
                  sx={{ cursor: canEdit ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (!canEdit) return;
                    navigate(`edit/${p.id}`);
                  }}
                >
                  <TableCell>{p.referenceNumber || p.id}</TableCell>
                  <TableCell>
                    {String(p.paymentMode ?? '').toUpperCase() === 'CHEQUE' && p.chequeDrawnOnBank
                      ? String(p.chequeDrawnOnBank)
                      : '—'}
                  </TableCell>
                  <TableCell>{p.party?.name || 'N/A'}</TableCell>
                  <TableCell>
                    {p.type === 'RECEIPT' ? 'Receivable' : p.type === 'PAYMENT' ? 'Payable' : p.type}
                  </TableCell>
                  <TableCell>₹{p.amount?.toLocaleString('en-IN') || '0'}</TableCell>
                  <TableCell>{new Date(p.date).toLocaleDateString()}</TableCell>
                  <TableCell>{String(p.createdBy ?? p.createdByName ?? '-')}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      color="error"
                      disabled={!canDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  );
}
