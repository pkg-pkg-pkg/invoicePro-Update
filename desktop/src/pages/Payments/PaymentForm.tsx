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
  Autocomplete,
} from '@mui/material';
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
import { getDefaultTodayForEntry, validateTransactionDate } from '../../services/appSettingsService';
import { usePermissions } from '../../hooks/usePermissions';
import { PartyPickerModal } from '../../components/parties/PartyPickerModal';
import { PartyPickerField } from '../../components/parties/PartyPickerField';
import type { PartyPickerScope } from '../../components/parties/PartyPickerModal';

export default function PaymentForm() {
  console.log('🔍 PaymentForm component loaded');
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { currentPayment, loading, error } = useSelector((state: RootState) => state.payments);
  const { customers = [], suppliers = [] } = useSelector((state: RootState) => state.parties || { customers: [], suppliers: [] });
  const { bankAccounts = [] } = useSelector((state: RootState) => state.banks || { bankAccounts: [] });

  const isEditMode = !!id;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [partyPickerOpen, setPartyPickerOpen] = useState(false);

  const { canAccessFeature } = usePermissions();
  const canView = true; // canAccessFeature('view-payments');
  const canCreate = true; // canAccessFeature('create-payment');
  const canEdit = true; // canAccessFeature('edit-payment');

  const [formData, setFormData] = useState<CreatePaymentData>({
    type: PaymentType.RECEIPT,
    partyId: '',
    partyType: PartyType.CUSTOMER,
    amount: undefined as any,
    paymentMode: PaymentMode.CASH,
    referenceNumber: '',
    chequeNumber: '',
    chequeDate: '',
    chequeDrawnOnBank: '',
    bankId: '',
    invoiceId: '',
    notes: '',
    date: getDefaultTodayForEntry(),
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
        chequeDate: currentPayment.chequeDate ? currentPayment.chequeDate.toISOString().split('T')[0] : '',
        chequeDrawnOnBank: (currentPayment as any).chequeDrawnOnBank || '',
        bankId: currentPayment.bankId || '',
        invoiceId: (currentPayment as any).invoiceId || '',
        notes: currentPayment.notes || '',
        date: currentPayment.date.toISOString().split('T')[0],
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
      formData.paymentMode === PaymentMode.CHEQUE &&
      !(String(formData.chequeDrawnOnBank ?? '').trim())
    ) {
      newErrors.chequeDrawnOnBank = 'Enter the bank name as printed on the cheque';
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

    if (isEditMode) {
      if (!canEdit) {
        alert('You do not have permission to edit payments');
        return;
      }
    } else {
      if (!canCreate) {
        alert('You do not have permission to create payments');
        return;
      }
    }

    if (!validate()) {
      return;
    }

    const dv = validateTransactionDate(String((formData as any)?.date ?? ''));
    if (!dv.ok) {
      alert(dv.message);
      return;
    }

    try {
      const payload: CreatePaymentData = {
        ...formData,
        amount: Number((formData as any).amount ?? 0) || 0,
        chequeDrawnOnBank:
          formData.paymentMode === PaymentMode.CHEQUE
            ? String(formData.chequeDrawnOnBank ?? '').trim()
            : undefined,
      };
      if (isEditMode && id) {
        await dispatch(updatePayment({ id, data: payload })).unwrap();
      } else {
        await dispatch(createPayment(payload)).unwrap();
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
  const partyPickerScope: PartyPickerScope =
    formData.partyType === PartyType.CUSTOMER ? 'debtor' : 'creditor';
  const partyPool = formData.partyType === PartyType.CUSTOMER ? customers : suppliers;

  if (loading && isEditMode) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
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

  if (isEditMode && !canEdit) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have permission to edit payments</Alert>
      </Box>
    );
  }

  if (!isEditMode && !canCreate) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have permission to create payments</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {isEditMode ? 'Edit Payment' : 'New Payment'}
      </Typography>

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
                    // Reset party selection when switching type (prevents mismatch)
                    handleChange('partyId', '');
                  }}
                >
                  <MenuItem value={PaymentType.RECEIPT}>Receivable (Debtor Payment)</MenuItem>
                  <MenuItem value={PaymentType.PAYMENT}>Payable (Creditor Payment)</MenuItem>
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
                    const newPartyType = e.target.value as PartyType;
                    handleChange('partyType', newPartyType);
                    // Keep payment type consistent with party type
                    if (newPartyType === PartyType.CUSTOMER) {
                      handleChange('type', PaymentType.RECEIPT);
                    } else {
                      handleChange('type', PaymentType.PAYMENT);
                    }
                    handleChange('partyId', ''); // Reset party selection
                  }}
                >
                  <MenuItem value={PartyType.CUSTOMER}>Debtor</MenuItem>
                  <MenuItem value={PartyType.SUPPLIER}>Creditor</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <PartyPickerField
                label="Party *"
                displayValue={selectedParty?.name ?? ''}
                placeholder={formData.partyType === PartyType.CUSTOMER ? 'Select debtor' : 'Select creditor'}
                onOpen={() => setPartyPickerOpen(true)}
                error={!!errors.partyId}
                helperText={errors.partyId}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Amount *"
                type="number"
                value={(formData as any).amount ?? ''}
                onChange={(e) =>
                  handleChange('amount', e.target.value === '' ? undefined : parseFloat(e.target.value))
                }
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
                    const mode = e.target.value as PaymentMode;
                    handleChange('paymentMode', mode);
                    if (
                      mode !== PaymentMode.NEFT &&
                      mode !== PaymentMode.RTGS &&
                      mode !== PaymentMode.IMPS &&
                      mode !== PaymentMode.BANK_TRANSFER &&
                      mode !== PaymentMode.CHEQUE
                    ) {
                      handleChange('bankId', '');
                    }
                    if (mode !== PaymentMode.CHEQUE) {
                      handleChange('chequeNumber', '');
                      handleChange('chequeDate', '');
                      handleChange('chequeDrawnOnBank', '');
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
                  options={bankAccounts.filter((b: any) => b.isActive)}
                  getOptionLabel={(option) => `${option.name} - ${option.accountNumber}`}
                  value={bankAccounts.find((b: any) => b.id === formData.bankId) || null}
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
                  <TextField
                    fullWidth
                    label="Bank on cheque *"
                    value={formData.chequeDrawnOnBank ?? ''}
                    onChange={(e) => handleChange('chequeDrawnOnBank', e.target.value)}
                    error={!!errors.chequeDrawnOnBank}
                    helperText={
                      errors.chequeDrawnOnBank ||
                      'Name of bank printed on the cheque (e.g. HDFC, SBI) — not your deposit account'
                    }
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={bankAccounts.filter((b: any) => b.isActive)}
                    getOptionLabel={(option) => `${option.name} - ${option.accountNumber}`}
                    value={bankAccounts.find((b: any) => b.id === formData.bankId) || null}
                    onChange={(_, newValue) => handleChange('bankId', newValue?.id || '')}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Deposit to (our bank account)"
                        helperText="Where you will present or deposit this cheque"
                      />
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
                <Button type="submit" variant="contained" disabled={loading || (isEditMode ? !canEdit : !canCreate)}>
                  {loading ? <CircularProgress size={24} /> : isEditMode ? 'Update' : 'Create'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>

      <PartyPickerModal
        open={partyPickerOpen}
        onClose={() => setPartyPickerOpen(false)}
        scope={partyPickerScope}
        title={formData.partyType === PartyType.CUSTOMER ? 'Select Debtor' : 'Select Creditor'}
        onSelect={(ledger) => {
          setPartyPickerOpen(false);
          const match =
            partyPool.find((p: { id: string; name: string; ledgerId?: string }) => p.ledgerId === ledger.id) ??
            partyPool.find(
              (p: { id: string; name: string }) =>
                String(p.name).trim().toLowerCase() === String(ledger.name).trim().toLowerCase()
            );
          handleChange('partyId', match?.id || '');
        }}
      />
    </Box>
  );
}


