// src/pages/Banks/BankForm.tsx
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
  Switch,
  FormControlLabel,
} from '@mui/material';
import { AppDispatch, RootState } from '../../store';
import {
  fetchBankAccount,
  createBankAccount,
  updateBankAccount,
  clearCurrentBankAccount,
  clearError,
} from '../../store/slices/bankSlice';
import { BankAccountType } from '@gst-billing/shared';
import { CreateBankAccountData } from '../../services/bankService';
import { usePermissions } from '../../hooks/usePermissions';
import { IfscField } from '../../components/forms/IfscField';

type FormState = CreateBankAccountData & { isActive?: boolean };

/**
 * Helper: runtime check whether value is a valid BankAccountType
 */
function isValidAccountType(value: unknown): value is BankAccountType {
  if (typeof value !== 'string') return false;
  return Object.values(BankAccountType).includes(value as BankAccountType);
}

export default function BankForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const bankState: any = useSelector((state: RootState) => (state as any).bank ?? (state as any).banks ?? {});
  const { currentAccount, loading, error } = bankState ?? {};

  const { canAccessFeature } = usePermissions();
  const canView = canAccessFeature('view-bank');
  const canCreate = canAccessFeature('create-bank');
  const canEdit = canAccessFeature('edit-bank');

  const isEditMode = !!id;
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Permission gating
  if (!canView) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have permission to view bank accounts</Alert>
      </Box>
    );
  }

  if (isEditMode && !canEdit) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have permission to edit bank accounts</Alert>
      </Box>
    );
  }

  if (!isEditMode && !canCreate) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">You do not have permission to create bank accounts</Alert>
      </Box>
    );
  }

  const [formData, setFormData] = useState<FormState>({
    name: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    branchName: '',
    accountType: BankAccountType.CURRENT,
    openingBalance: 0,
    isActive: true,
  });

  useEffect(() => {
    if (isEditMode && id) {
      dispatch(fetchBankAccount(id));
    } else {
      dispatch(clearCurrentBankAccount());
    }

    return () => {
      dispatch(clearCurrentBankAccount());
    };
  }, [dispatch, id, isEditMode]);

  useEffect(() => {
    if (currentAccount && isEditMode) {
      // Safely map accountType using runtime check to avoid string->enum assignment errors
      const accountTypeValue = isValidAccountType(currentAccount.accountType)
        ? (currentAccount.accountType as BankAccountType)
        : BankAccountType.CURRENT;

      setFormData({
        name: currentAccount.name ?? '',
        accountNumber: currentAccount.accountNumber ?? '',
        ifscCode: currentAccount.ifscCode ?? '',
        bankName: currentAccount.bankName ?? '',
        branchName: currentAccount.branchName ?? '',
        accountType: accountTypeValue,
        openingBalance:
          typeof currentAccount.openingBalance === 'number' ? currentAccount.openingBalance : 0,
        isActive: typeof currentAccount.isActive === 'boolean' ? currentAccount.isActive : true,
      });
    }
  }, [currentAccount, isEditMode]);

  const handleChange = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field as string]) {
      setErrors((prev) => ({ ...prev, [field as string]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.accountNumber?.trim()) {
      newErrors.accountNumber = 'Account number is required';
    }

    if (!formData.ifscCode?.trim()) {
      newErrors.ifscCode = 'IFSC code is required';
    } else if (formData.ifscCode.length !== 11) {
      newErrors.ifscCode = 'IFSC code must be 11 characters';
    }

    if (!formData.bankName?.trim()) {
      newErrors.bankName = 'Bank name is required';
    }

    const openingBalance = Number((formData as any).openingBalance ?? 0);
    if (Number.isNaN(openingBalance) || openingBalance < 0) {
      newErrors.openingBalance = 'Opening balance must be 0 or greater';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isEditMode && !canEdit) {
      alert('You do not have permission to edit bank accounts');
      return;
    }

    if (!isEditMode && !canCreate) {
      alert('You do not have permission to create bank accounts');
      return;
    }

    if (!validate()) {
      return;
    }

    try {
      const payload: FormState = {
        ...(formData as any),
        openingBalance: Number((formData as any).openingBalance ?? 0) || 0,
      };
      if (isEditMode && id) {
        // RTK entity update style: { id, changes }
        await dispatch(updateBankAccount({ id, changes: payload })).unwrap();
      } else {
        await dispatch(createBankAccount(payload)).unwrap();
      }
      navigate('/banks');
    } catch (err) {
      // error handled in slice — keep console for debugging if needed
      // console.error(err);
    }
  };

  if (loading && isEditMode) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {isEditMode ? 'Edit Bank Account' : 'New Bank Account'}
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
              <TextField
                fullWidth
                label="Account Name *"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                error={!!errors.name}
                helperText={errors.name || 'Name to identify this account'}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Account Number *"
                value={formData.accountNumber}
                onChange={(e) => handleChange('accountNumber', e.target.value)}
                error={!!errors.accountNumber}
                helperText={errors.accountNumber}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <IfscField
                label="IFSC Code *"
                value={formData.ifscCode}
                onChange={(v) => handleChange('ifscCode', v)}
                onResolved={(data) => {
                  handleChange('bankName', data.bankName);
                  handleChange('branchName', data.branchName);
                }}
                size="medium"
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Bank Name *"
                value={formData.bankName}
                onChange={(e) => handleChange('bankName', e.target.value)}
                error={!!errors.bankName}
                helperText={errors.bankName}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Branch Name"
                value={formData.branchName}
                onChange={(e) => handleChange('branchName', e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth required>
                <InputLabel id="account-type-label">Account Type</InputLabel>
                <Select
                  labelId="account-type-label"
                  value={formData.accountType}
                  label="Account Type"
                  onChange={(e) =>
                    // cast value into FormState['accountType'] (runtime mapping already handled on load)
                    handleChange('accountType', e.target.value as FormState['accountType'])
                  }
                >
                  {Object.values(BankAccountType).map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Opening Balance"
                type="number"
                value={(formData as any).openingBalance ?? ''}
                onChange={(e) =>
                  handleChange('openingBalance', e.target.value === '' ? undefined : parseFloat(e.target.value))
                }
                error={!!errors.openingBalance}
                helperText={errors.openingBalance || 'Balance at the time of account creation'}
                InputProps={{
                  startAdornment: <Typography sx={{ mr: 1 }}>₹</Typography>,
                }}
              />
            </Grid>

            {isEditMode && (
              <Grid item xs={12} md={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!formData.isActive}
                      onChange={(e) => handleChange('isActive', e.target.checked)}
                    />
                  }
                  label="Active"
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
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
