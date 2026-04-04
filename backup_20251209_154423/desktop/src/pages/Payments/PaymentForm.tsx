import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Autocomplete,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store';
import {
  fetchPayment,
  createPayment,
  updatePayment,
  clearCurrentPayment,
  clearError,
} from '../../store/slices/paymentSlice';
import { fetchCustomers, fetchSuppliers } from '../../store/slices/partySlice';
import { fetchBankAccounts } from '../../store/slices/bankSlice';
import { PaymentType, PartyType, PaymentMode } from "@gst-billing/shared";
import { CreatePaymentData } from '../../services/paymentService';
import { formatCurrency } from '../../utils/formatters';

export default function PaymentForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { currentPayment, loading, error } = useSelector((state: RootState) => state.payments);
  const { customers = [], suppliers = [] } = useSelector((state: RootState) => state.parties || { customers: [], suppliers: [] });
  const { bankAccounts = [] } = useSelector((state: RootState) => state.banks || { bankAccounts: [] });

  const isEditMode = !!id;
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<CreatePaymentData>({
    type: PaymentType.RECEIPT,
    partyId: '',
    partyType: PartyType.CUSTOMER,
    amount: 0,
    paymentMode: PaymentMode.CASH,
    referenceNumber: '',
    chequeNumber: '',
    chequeDate: '',
    bankId: '',
    invoiceId: '',
    notes: '',
    date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    if (isEditMode && id) {
      dispatch(fetchPayment(id));
    } else {
      dispatch(clearCurrentPayment());
    }

    dispatch(fetchCustomers({}));
    dispatch(fetchSuppliers({}));
    dispatch(fetchBankAccounts({}));

    return () => {
      dispatch(clearCurrentPayment());
    };
  }, [dispatch, id, isEditMode]);

  useEffect(() => {
    if (currentPayment && isEditMode) {
      setFormData({
        type: currentPayment.type,
        partyId: currentPayment.partyId,
        partyType: currentPayment.partyType,
        amount: currentPayment.amount,
        paymentMode: currentPayment.paymentMode,
        referenceNumber: currentPayment.referenceNumber || '',
        chequeNumber: currentPayment.chequeNumber || '',
        chequeDate: currentPayment.chequeDate ? currentPayment.chequeDate.split('T')[0] : '',
        bankId: currentPayment.bankId || '',
        invoiceId: currentPayment.invoiceId || '',
        notes: currentPayment.notes || '',
        date: currentPayment.date.split('T')[0],
      });
    }
  }, [currentPayment, isEditMode]);

  const handleChange = (field: keyof CreatePaymentData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.partyId) {
      newErrors.partyId = 'Party is required';
    }

    if (!formData.amount || formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    }

    if (formData.paymentMode === PaymentMode.CHEQUE && !formData.chequeNumber) {
      newErrors.chequeNumber = 'Cheque number is required for cheque payments';
    }

    if (formData.paymentMode === PaymentMode.CHEQUE && !formData.chequeDate) {
      newErrors.chequeDate = 'Cheque date is required for cheque payments';
    }

    if (
      (formData.paymentMode === PaymentMode.NEFT ||
        formData.paymentMode === PaymentMode.RTGS ||
        formData.paymentMode === PaymentMode.IMPS ||
        formData.paymentMode === PaymentMode.BANK_TRANSFER) &&
      !formData.bankId
    ) {
      newErrors.bankId = 'Bank account is required for bank transfers';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      if (isEditMode && id) {
        await dispatch(updatePayment({ id, data: formData })).unwrap();
      } else {
        await dispatch(createPayment(formData)).unwrap();
      }
      navigate('/payments');
    } catch (err) {
      // Error is handled by Redux
    }
  };

  const getPartyOptions = () => {
    if (formData.partyType === PartyType.CUSTOMER) {
      return customers.map((c) => ({ id: c.id, name: c.name }));
    } else {
      return suppliers.map((s) => ({ id: s.id, name: s.name }));
    }
  };

  const selectedParty = getPartyOptions().find((p) => p.id === formData.partyId);

  if (loading && isEditMode) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/payments')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">
          {isEditMode ? 'Edit Payment' : 'New Payment'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Payment Type</InputLabel>
                <Select
                  value={formData.type}
                  label="Payment Type"
                  onChange={(e) => {
                    const newType = e.target.value as PaymentType;
                    handleChange('type', newType);
                    // Auto-set party type based on payment type
                    if (newType === PaymentType.RECEIPT) {
                      handleChange('partyType', PartyType.CUSTOMER);
                    } else {
                      handleChange('partyType', PartyType.SUPPLIER);
                    }
                  }}
                >
                  <MenuItem value={PaymentType.RECEIPT}>Receipt (Customer Payment)</MenuItem>
                  <MenuItem value={PaymentType.PAYMENT}>Payment (Supplier Payment)</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Party Type</InputLabel>
                <Select
                  value={formData.partyType}
                  label="Party Type"
                  onChange={(e) => {
                    handleChange('partyType', e.target.value);
                    handleChange('partyId', ''); // Reset party selection
                  }}
                >
                  <MenuItem value={PartyType.CUSTOMER}>Customer</MenuItem>
                  <MenuItem value={PartyType.SUPPLIER}>Supplier</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                options={getPartyOptions()}
                getOptionLabel={(option) => option.name}
                value={selectedParty || null}
                onChange={(_, newValue) => handleChange('partyId', newValue?.id || '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Party *"
                    error={!!errors.partyId}
                    helperText={errors.partyId}
                    required
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Amount *"
                type="number"
                value={formData.amount}
                onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
                error={!!errors.amount}
                helperText={errors.amount}
                required
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>,
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel>Payment Mode</InputLabel>
                <Select
                  value={formData.paymentMode}
                  label="Payment Mode"
                  onChange={(e) => {
                    handleChange('paymentMode', e.target.value);
                    // Clear bank if not needed
                    if (
                      e.target.value !== PaymentMode.NEFT &&
                      e.target.value !== PaymentMode.RTGS &&
                      e.target.value !== PaymentMode.IMPS &&
                      e.target.value !== PaymentMode.BANK_TRANSFER
                    ) {
                      handleChange('bankId', '');
                    }
                  }}
                >
                  {Object.values(PaymentMode).map((mode) => (
                    <MenuItem key={mode} value={mode}>
                      {mode}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Date *"
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                error={!!errors.date}
                helperText={errors.date}
                required
                InputLabelProps={{
                  shrink: true,
                }}
              />
            </Grid>

            {(formData.paymentMode === PaymentMode.NEFT ||
              formData.paymentMode === PaymentMode.RTGS ||
              formData.paymentMode === PaymentMode.IMPS ||
              formData.paymentMode === PaymentMode.BANK_TRANSFER) && (
              <Grid item xs={12} md={6}>
                <Autocomplete
                  options={bankAccounts.filter((b) => b.isActive)}
                  getOptionLabel={(option) => `${option.name} - ${option.accountNumber}`}
                  value={bankAccounts.find((b) => b.id === formData.bankId) || null}
                  onChange={(_, newValue) => handleChange('bankId', newValue?.id || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Bank Account *"
                      error={!!errors.bankId}
                      helperText={errors.bankId}
                      required
                    />
                  )}
                />
              </Grid>
            )}

            {formData.paymentMode === PaymentMode.CHEQUE && (
              <>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Cheque Number *"
                    value={formData.chequeNumber}
                    onChange={(e) => handleChange('chequeNumber', e.target.value)}
                    error={!!errors.chequeNumber}
                    helperText={errors.chequeNumber}
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Cheque Date *"
                    type="date"
                    value={formData.chequeDate}
                    onChange={(e) => handleChange('chequeDate', e.target.value)}
                    error={!!errors.chequeDate}
                    helperText={errors.chequeDate}
                    required
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={bankAccounts.filter((b) => b.isActive)}
                    getOptionLabel={(option) => `${option.name} - ${option.accountNumber}`}
                    value={bankAccounts.find((b) => b.id === formData.bankId) || null}
                    onChange={(_, newValue) => handleChange('bankId', newValue?.id || '')}
                    renderInput={(params) => (
                      <TextField {...params} label="Bank Account" />
                    )}
                  />
                </Grid>
              </>
            )}

            {(formData.paymentMode === PaymentMode.UPI ||
              formData.paymentMode === PaymentMode.CARD ||
              formData.paymentMode === PaymentMode.NEFT ||
              formData.paymentMode === PaymentMode.RTGS ||
              formData.paymentMode === PaymentMode.IMPS) && (
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Reference Number"
                  value={formData.referenceNumber}
                  onChange={(e) => handleChange('referenceNumber', e.target.value)}
                  helperText="Transaction/UPI reference number"
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={3}
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={() => navigate('/payments')}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained" disabled={loading}>
                  {loading ? <CircularProgress size={24} /> : isEditMode ? 'Update' : 'Create'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
}


