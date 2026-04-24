import { useEffect, useState } from 'react';
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
import { saveCompanyDetailsToCloud } from '../services/companyDetailsCloudService';
import { getNormalizedCompanyProfile } from '../utils/companyProfile';

type FormState = {
  businessName: string;
  ownerName: string;
  address: string;
  city: string;
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

  const [form, setForm] = useState<FormState>({
    businessName: '',
    ownerName: '',
    address: '',
    city: '',
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
        const p: any = (() => {
          const normalized = getNormalizedCompanyProfile();
          try {
            const raw = localStorage.getItem('company-info');
            const parsed = raw ? JSON.parse(raw) : {};
            return { ...parsed, ...normalized };
          } catch {
            return normalized;
          }
        })();

        if (!cancelled) {
          setForm({
            businessName: String(p?.businessName ?? p?.name ?? '').trim(),
            ownerName: String(p?.name ?? '').trim(),
            address: String(p?.address ?? '').trim(),
            city: String(p?.city ?? '').trim(),
            state: String(p?.state ?? '').trim(),
            pinCode: String(p?.pinCode ?? '').trim(),
            phone: String(p?.phone ?? '').trim(),
            email: String(p?.email ?? '').trim(),
            gstNumber: String(p?.gstNumber ?? '').trim(),
            panNumber: String(p?.panNumber ?? '').trim(),
            bankName: String(p?.bankName ?? '').trim(),
            bankAccountNumber: String(p?.bankAccountNumber ?? '').trim(),
            bankIfsc: String(p?.bankIfsc ?? '').trim(),
            bankBranch: String(p?.bankBranch ?? '').trim(),
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
      const raw = localStorage.getItem('company-info');
      const prev = raw ? JSON.parse(raw) : {};
      const next = {
        ...prev,
        businessName,
        name: businessName,
        ownerName,
        address,
        city,
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
      localStorage.setItem('company-info', JSON.stringify(next));

      localStorage.setItem('companyName', businessName);
      localStorage.setItem('companyAddress', address);
      localStorage.setItem('companyCity', city);
      localStorage.setItem('companyStatePin', `${state}, ${pinCode}`);
      localStorage.setItem('companyPhone', phone);
      localStorage.setItem('companyEmail', email);
      localStorage.setItem('companyGSTIN', gstNumber);
      localStorage.setItem('companyPAN', panNumber);
      localStorage.setItem('companyBankName', bankName);
      localStorage.setItem('companyBankAccount', bankAccountNumber);
      localStorage.setItem('companyBankIFSC', bankIfsc);
      localStorage.setItem('companyBankBranch', bankBranch);
      localStorage.setItem('setupCompleted', 'true');
      window.dispatchEvent(new Event('companyProfileUpdated'));

      // Sync company profile to Firestore for cloud restore/device switch
      try {
        await saveCompanyDetailsToCloud({
          email,
          companyName: businessName,
          phone,
          address,
          extra: next,
        });
      } catch (cloudError) {
        console.error('Failed to sync company profile to cloud:', cloudError);
      }

      try {
        if (user && token) {
          await login(token, { ...(user as any), completedBusinessProfile: true } as any);
        }
      } catch {
        // ignore
      }

      navigate('/dashboard', { replace: true });
      window.setTimeout(() => window.location.reload(), 50);
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
            <Grid item xs={12} md={4}>
              <TextField
                label="City *"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="State *"
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="PIN Code *"
                value={form.pinCode}
                onChange={(e) => setForm((p) => ({ ...p, pinCode: e.target.value }))}
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
              <TextField
                label="IFSC Code *"
                value={form.bankIfsc}
                onChange={(e) => setForm((p) => ({ ...p, bankIfsc: e.target.value }))}
                fullWidth
                required
                placeholder="ABCD0123456"
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
