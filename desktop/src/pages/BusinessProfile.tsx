import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/auth';
import { finalizeBusinessProfileSave } from '../services/businessProfileService';
import { getActiveCompanyProfileRow } from '../services/companyProfileDbService';
import { usePincodeAutofill } from '../hooks/usePincodeAutofill';
import PincodeTextField from '../components/PincodeTextField';
import { IfscField } from '../components/forms/IfscField';

type FormState = {
  businessName: string;
  ownerName: string;
  address: string;
  city: string;
  district: string;
  state: string;
  pinCode: string;
  phone: string;
  email: string;
  gstNumber: string;
  panNumber: string;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  bankBranch: string;
};

export default function BusinessProfile(): JSX.Element {
  const navigate = useNavigate();
  const { user, token, login } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pinAutofill = usePincodeAutofill({
    onFilled: useCallback((addr) => {
      setForm((prev) => ({
        ...prev,
        city: addr.city,
        district: addr.district,
        state: addr.state,
      }));
    }, []),
  });

  const [form, setForm] = useState<FormState>({
    businessName: '',
    ownerName: '',
    address: '',
    city: '',
    district: '',
    state: '',
    pinCode: '',
    phone: '',
    email: '',
    gstNumber: '',
    panNumber: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankBranch: '',
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const row = await getActiveCompanyProfileRow();

        if (!cancelled) {
          setForm({
            businessName: String(row?.company_name ?? '').trim(),
            ownerName: String(row?.owner_name ?? '').trim(),
            address: String(row?.address ?? '').trim(),
            city: String(row?.city ?? '').trim(),
            district: '',
            state: String(row?.state ?? '').trim(),
            pinCode: String(row?.pincode ?? '').trim(),
            phone: String(row?.mobile ?? '').trim(),
            email: String(row?.email ?? '').trim(),
            gstNumber: String(row?.gstin ?? '').trim(),
            panNumber: String(row?.pan ?? '').trim(),
            bankName: String(row?.bank_name ?? '').trim(),
            bankAccountNumber: String(row?.bank_account_number ?? '').trim(),
            bankIfsc: String(row?.bank_ifsc ?? '').trim(),
            bankBranch: String(row?.bank_branch ?? '').trim(),
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const businessName = form.businessName.trim();
    const ownerName = form.ownerName.trim();
    const address = form.address.trim();
    const city = form.city.trim();
    const district = form.district.trim();
    const state = form.state.trim();
    const pinCode = form.pinCode.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    const gstNumber = form.gstNumber.trim();
    const panNumber = form.panNumber.trim();
    const bankName = form.bankName.trim();
    const bankAccountNumber = form.bankAccountNumber.trim();
    const bankIfsc = form.bankIfsc.trim();
    const bankBranch = form.bankBranch.trim();

    if (!businessName || !ownerName || !address || !city || !state || !pinCode || !phone || !email || !bankName || !bankAccountNumber || !bankIfsc || !bankBranch) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setSaving(true);
      const companyInfo = {
        businessName,
        name: businessName,
        ownerName,
        address,
        city,
        district,
        state,
        pinCode,
        phone,
        email,
        gstNumber,
        panNumber,
        bankName,
        bankAccountNumber,
        bankIfsc,
        bankBranch,
      };

      await finalizeBusinessProfileSave({
        email,
        companyName: businessName,
        phone,
        address,
        companyInfo,
      });

      if (user && token) {
        await login(token, { ...(user as any), completedBusinessProfile: true } as any);
      }

      navigate('/dashboard', { replace: true });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: 'auto' }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Complete Business Profile
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Dashboard is locked until your business profile is completed.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={onSubmit}>
          {/* Basic Business Information */}
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2, mt: 2 }}>
            Business Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Business Name *"
                value={form.businessName}
                onChange={(e) => setForm((p) => ({ ...p, businessName: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Owner Name *"
                value={form.ownerName}
                onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Address *"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                fullWidth
                required
                multiline
                minRows={2}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <PincodeTextField
                label="PIN Code *"
                value={form.pinCode}
                onPinChange={(pin) => setForm((p) => ({ ...p, pinCode: pin }))}
                autofill={pinAutofill}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="City *"
                value={form.city}
                onChange={(e) => {
                  pinAutofill.clearHighlight('city');
                  setForm((p) => ({ ...p, city: e.target.value }));
                }}
                sx={pinAutofill.fieldSx('city')}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="District"
                value={form.district}
                onChange={(e) => {
                  pinAutofill.clearHighlight('district');
                  setForm((p) => ({ ...p, district: e.target.value }));
                }}
                sx={pinAutofill.fieldSx('district')}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="State *"
                value={form.state}
                onChange={(e) => {
                  pinAutofill.clearHighlight('state');
                  setForm((p) => ({ ...p, state: e.target.value }));
                }}
                sx={pinAutofill.fieldSx('state')}
                fullWidth
                required
              />
            </Grid>
          </Grid>

          {/* Contact Information */}
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2, mt: 3 }}>
            Contact Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Phone Number *"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Email Address *"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
          </Grid>

          {/* Tax Information */}
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2, mt: 3 }}>
            Tax Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="GST Number"
                value={form.gstNumber}
                onChange={(e) => setForm((p) => ({ ...p, gstNumber: e.target.value }))}
                fullWidth
                placeholder="29ABCDE1234C1ZV"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="PAN Number"
                value={form.panNumber}
                onChange={(e) => setForm((p) => ({ ...p, panNumber: e.target.value }))}
                fullWidth
                placeholder="ABCDE1234F"
              />
            </Grid>
          </Grid>

          {/* Bank Information */}
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2, mt: 3 }}>
            Bank Information
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Bank Name *"
                value={form.bankName}
                onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Bank Branch *"
                value={form.bankBranch}
                onChange={(e) => setForm((p) => ({ ...p, bankBranch: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Account Number *"
                value={form.bankAccountNumber}
                onChange={(e) => setForm((p) => ({ ...p, bankAccountNumber: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <IfscField
                label="IFSC Code *"
                value={form.bankIfsc}
                onChange={(v) => setForm((p) => ({ ...p, bankIfsc: v }))}
                onResolved={(data) =>
                  setForm((p) => ({
                    ...p,
                    bankName: data.bankName || p.bankName,
                    bankBranch: data.branchName || p.bankBranch,
                  }))
                }
                size="medium"
                required
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
            <Button type="submit" variant="contained" disabled={saving} size="large">
              {saving ? 'Saving...' : 'Save & Continue'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}
