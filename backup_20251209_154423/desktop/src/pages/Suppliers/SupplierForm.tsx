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
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
  IconButton,
  Tabs,
  Tab,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store';
import {
  fetchSupplier,
  createSupplier,
  updateSupplier,
  clearCurrentParty,
  clearError,
} from '../../store/slices/partySlice';
import { Supplier } from '../../services/partyService';
import { INDIAN_STATES } from '@gst-billing/shared';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SupplierForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { currentParty, loading, error } = useSelector((state: RootState) => state.parties);

  const isEditMode = !!id;
  const [tabValue, setTabValue] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<Partial<Supplier>>({
    name: '',
    code: '',
    phone: '',
    email: '',
    whatsapp: '',
    gstin: '',
    pan: '',
    creditDays: 0,
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    pincode: '',
    country: 'India',
    openingBalance: 0,
    isActive: true,
  });

  useEffect(() => {
    if (isEditMode && id) {
      dispatch(fetchSupplier(id));
    } else {
      dispatch(clearCurrentParty());
    }

    return () => {
      dispatch(clearCurrentParty());
    };
  }, [dispatch, id, isEditMode]);

  useEffect(() => {
    if (currentParty && isEditMode) {
      const supplier = currentParty as Supplier;
      setFormData({
        name: supplier.name,
        code: supplier.code || '',
        phone: supplier.phone,
        email: supplier.email || '',
        whatsapp: supplier.whatsapp || '',
        gstin: supplier.gstin || '',
        pan: supplier.pan || '',
        creditDays: supplier.creditDays,
        addressLine1: supplier.addressLine1,
        addressLine2: supplier.addressLine2 || '',
        city: supplier.city,
        state: supplier.state,
        pincode: supplier.pincode,
        country: supplier.country,
        openingBalance: Number(supplier.openingBalance),
        isActive: supplier.isActive,
      });
    }
  }, [currentParty, isEditMode]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Supplier name is required (min 2 characters)';
    }

    if (!formData.phone || formData.phone.trim().length < 10) {
      newErrors.phone = 'Valid phone number is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    if (formData.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstin)) {
      newErrors.gstin = 'Invalid GSTIN format';
    }

    if (formData.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.pan)) {
      newErrors.pan = 'Invalid PAN format';
    }

    if (!formData.addressLine1 || formData.addressLine1.trim().length < 10) {
      newErrors.addressLine1 = 'Address is required (min 10 characters)';
    }

    if (!formData.city) {
      newErrors.city = 'City is required';
    }

    if (!formData.state) {
      newErrors.state = 'State is required';
    }

    if (!formData.pincode || !/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Valid 6-digit pincode is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof Supplier, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      if (isEditMode && id) {
        await dispatch(updateSupplier({ id, data: formData })).unwrap();
      } else {
        await dispatch(createSupplier(formData)).unwrap();
      }
      navigate('/suppliers');
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <IconButton onClick={() => navigate('/suppliers')} sx={{ mr: 1 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">
          {isEditMode ? 'Edit Supplier' : 'Add Supplier'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
          <Tab label="Basic Information" />
          <Tab label="Address" />
        </Tabs>

        <form onSubmit={handleSubmit}>
          <TabPanel value={tabValue} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Supplier Name *"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  error={!!errors.name}
                  helperText={errors.name}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Code"
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value)}
                  helperText="Leave empty to auto-generate"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Phone Number *"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  error={!!errors.phone}
                  helperText={errors.phone}
                  required
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  error={!!errors.email}
                  helperText={errors.email}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="WhatsApp"
                  value={formData.whatsapp}
                  onChange={(e) => handleChange('whatsapp', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="GSTIN"
                  value={formData.gstin}
                  onChange={(e) => handleChange('gstin', e.target.value.toUpperCase())}
                  error={!!errors.gstin}
                  helperText={errors.gstin || '15 characters (e.g., 29ABCDE1234F1Z5)'}
                  inputProps={{ maxLength: 15 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="PAN"
                  value={formData.pan}
                  onChange={(e) => handleChange('pan', e.target.value.toUpperCase())}
                  error={!!errors.pan}
                  helperText={errors.pan || '10 characters (e.g., ABCDE1234F)'}
                  inputProps={{ maxLength: 10 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Credit Days"
                  type="number"
                  value={formData.creditDays}
                  onChange={(e) => handleChange('creditDays', parseInt(e.target.value) || 0)}
                  inputProps={{ min: 0 }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Opening Balance (₹)"
                  type="number"
                  value={formData.openingBalance}
                  onChange={(e) => handleChange('openingBalance', parseFloat(e.target.value) || 0)}
                  helperText="Positive = We owe, Negative = Advance paid"
                />
              </Grid>

              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => handleChange('isActive', e.target.checked)}
                    />
                  }
                  label="Active"
                />
              </Grid>
            </Grid>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address Line 1 *"
                  value={formData.addressLine1}
                  onChange={(e) => handleChange('addressLine1', e.target.value)}
                  error={!!errors.addressLine1}
                  helperText={errors.addressLine1}
                  required
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address Line 2"
                  value={formData.addressLine2}
                  onChange={(e) => handleChange('addressLine2', e.target.value)}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="City *"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  error={!!errors.city}
                  helperText={errors.city}
                  required
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  select
                  label="State *"
                  value={formData.state}
                  onChange={(e) => handleChange('state', e.target.value)}
                  error={!!errors.state}
                  helperText={errors.state}
                  required
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </TextField>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Pincode *"
                  value={formData.pincode}
                  onChange={(e) => handleChange('pincode', e.target.value)}
                  error={!!errors.pincode}
                  helperText={errors.pincode}
                  inputProps={{ maxLength: 6 }}
                  required
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Country"
                  value={formData.country}
                  onChange={(e) => handleChange('country', e.target.value)}
                />
              </Grid>
            </Grid>
          </TabPanel>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
              <Button variant="outlined" onClick={() => navigate('/suppliers')} disabled={loading}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : null}
              >
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </Box>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
}

