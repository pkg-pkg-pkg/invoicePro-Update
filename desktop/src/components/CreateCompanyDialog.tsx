import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { createCompany } from '../services/companyRegistryService';
import { BUSINESS_TYPES } from '../constants/businessTypes';
import { INDIAN_STATES } from '../utils/constants';
import {
  buildProfilePayload,
  validateAddressLine1,
  validateCity,
  validateCompanyForm,
  validateCompanyName,
  validateEmail,
  validateGstin,
  validateMobile,
  validatePinCode,
  validateState,
  type CompanyFormErrors,
  type CompanyFormValues,
} from '../utils/companyFormValidation';
import { erpContainedButtonSx } from '../theme/erpButtonStyles';
import { usePincodeAutofill } from '../hooks/usePincodeAutofill';
import PincodeTextField from './PincodeTextField';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

const sectionTitleSx = {
  fontWeight: 800,
  fontSize: '0.8rem',
  letterSpacing: 0.6,
  textTransform: 'uppercase' as const,
  color: 'text.secondary',
  mb: 1,
  mt: 0.5,
};

function fieldProps(errors: CompanyFormErrors, field: keyof CompanyFormValues) {
  const msg = errors[field];
  return {
    error: Boolean(msg),
    helperText: msg,
  };
}

export default function CreateCompanyDialog({ open, onClose, onCreated }: Props) {
  const now = new Date();
  const defaultFy = now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;

  const initialValues = useMemo(
    (): CompanyFormValues => ({
      name: '',
      gstin: '',
      ownerName: '',
      businessType: 'Proprietorship',
      addressLine1: '',
      addressLine2: '',
      city: '',
      district: '',
      state: '',
      pinCode: '',
      mobile: '',
      email: '',
      website: '',
      fyStartYear: defaultFy,
    }),
    [defaultFy, open]
  );

  const [values, setValues] = useState<CompanyFormValues>(initialValues);
  const [errors, setErrors] = useState<CompanyFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pinAutofill = usePincodeAutofill({
    onFilled: useCallback((addr) => {
      setValues((prev) => ({
        ...prev,
        city: addr.city,
        district: addr.district,
        state: addr.state,
      }));
    }, []),
  });

  useEffect(() => {
    if (!open) return;
    setValues(initialValues);
    setErrors({});
    setFormError(null);
  }, [open, initialValues]);

  const fyOptions = useMemo(() => {
    const cur = defaultFy;
    return [cur - 1, cur, cur + 1];
  }, [defaultFy]);

  const setField = <K extends keyof CompanyFormValues>(key: K, value: CompanyFormValues[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const blurValidate = (field: keyof CompanyFormValues) => {
    let msg: string | undefined;
    switch (field) {
      case 'name':
        msg = validateCompanyName(values.name);
        break;
      case 'gstin':
        msg = validateGstin(values.gstin);
        break;
      case 'addressLine1':
        msg = validateAddressLine1(values.addressLine1);
        break;
      case 'city':
        msg = validateCity(values.city);
        break;
      case 'state':
        msg = validateState(values.state);
        break;
      case 'pinCode':
        msg = validatePinCode(values.pinCode);
        break;
      case 'mobile':
        msg = validateMobile(values.mobile);
        break;
      case 'email':
        msg = validateEmail(values.email);
        break;
      default:
        break;
    }
    setErrors((prev) => {
      const next = { ...prev };
      if (msg) next[field] = msg;
      else delete next[field];
      return next;
    });
  };

  const handleCreate = async () => {
    setFormError(null);
    const allErrors = validateCompanyForm(values);
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setBusy(true);
    try {
      const profile = buildProfilePayload(values);
      await createCompany({
        name: profile.name,
        gstin: profile.gstin,
        ownerName: profile.ownerName,
        businessType: profile.businessType,
        fyStartYear: profile.fyStartYear,
        addressLine1: profile.addressLine1,
        addressLine2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        pinCode: profile.pinCode,
        address: profile.address,
        statePin: profile.statePin,
        mobiles: profile.mobiles,
        mobile: profile.mobiles,
        email: profile.email,
        website: profile.website,
      });
      onClose();
      if (onCreated) onCreated();
      else window.location.reload();
    } catch (e: unknown) {
      setFormError(String((e as Error)?.message ?? 'Failed to create company'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="md" fullWidth scroll="paper">
      <DialogTitle>Create New Company</DialogTitle>
      <DialogContent dividers sx={{ maxHeight: 'min(72vh, 640px)' }}>
        {formError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError}
          </Alert>
        )}

        <Typography sx={sectionTitleSx}>Company Info</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Company Name"
              required
              fullWidth
              value={values.name}
              onChange={(e) => setField('name', e.target.value)}
              onBlur={() => blurValidate('name')}
              {...fieldProps(errors, 'name')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="GSTIN (optional)"
              fullWidth
              value={values.gstin}
              onChange={(e) => setField('gstin', e.target.value.toUpperCase())}
              onBlur={() => blurValidate('gstin')}
              inputProps={{ maxLength: 15 }}
              {...fieldProps(errors, 'gstin')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Owner / Contact Name"
              fullWidth
              value={values.ownerName}
              onChange={(e) => setField('ownerName', e.target.value)}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              select
              label="Business Type"
              fullWidth
              value={values.businessType}
              onChange={(e) => setField('businessType', e.target.value)}
            >
              {BUSINESS_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography sx={sectionTitleSx}>Address</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Address Line 1"
              required
              fullWidth
              value={values.addressLine1}
              onChange={(e) => setField('addressLine1', e.target.value)}
              onBlur={() => blurValidate('addressLine1')}
              {...fieldProps(errors, 'addressLine1')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Address Line 2"
              fullWidth
              value={values.addressLine2}
              onChange={(e) => setField('addressLine2', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <PincodeTextField
              label="PIN Code"
              required
              fullWidth
              value={values.pinCode}
              onPinChange={(pin) => setField('pinCode', pin)}
              autofill={pinAutofill}
              validationError={Boolean(errors.pinCode)}
              helperText={errors.pinCode}
              onBlur={() => blurValidate('pinCode')}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="City"
              required
              fullWidth
              value={values.city}
              onChange={(e) => {
                pinAutofill.clearHighlight('city');
                setField('city', e.target.value);
              }}
              onBlur={() => blurValidate('city')}
              sx={pinAutofill.fieldSx('city')}
              {...fieldProps(errors, 'city')}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              label="District"
              fullWidth
              value={values.district}
              onChange={(e) => {
                pinAutofill.clearHighlight('district');
                setField('district', e.target.value);
              }}
              placeholder="Optional"
              sx={pinAutofill.fieldSx('district')}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              select
              label="State"
              required
              fullWidth
              value={values.state}
              onChange={(e) => {
                pinAutofill.clearHighlight('state');
                setField('state', e.target.value);
              }}
              onBlur={() => blurValidate('state')}
              sx={pinAutofill.fieldSx('state')}
              {...fieldProps(errors, 'state')}
            >
              <MenuItem value="">
                <em>Select state</em>
              </MenuItem>
              {INDIAN_STATES.map((st) => (
                <MenuItem key={st} value={st}>
                  {st}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography sx={sectionTitleSx}>Contact Details</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Mobile Number"
              required
              fullWidth
              value={values.mobile}
              onChange={(e) => setField('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
              onBlur={() => blurValidate('mobile')}
              inputProps={{ inputMode: 'numeric', maxLength: 10 }}
              {...fieldProps(errors, 'mobile')}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Email"
              fullWidth
              type="email"
              value={values.email}
              onChange={(e) => setField('email', e.target.value)}
              onBlur={() => blurValidate('email')}
              {...fieldProps(errors, 'email')}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Website"
              fullWidth
              value={values.website}
              onChange={(e) => setField('website', e.target.value)}
              placeholder="https://example.com"
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        <Typography sx={sectionTitleSx}>Financial Year</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              select
              label="Financial Year Start"
              fullWidth
              value={values.fyStartYear}
              onChange={(e) => setField('fyStartYear', Number(e.target.value))}
              helperText="Indian FY: April to March"
            >
              {fyOptions.map((y) => (
                <MenuItem key={y} value={y}>
                  FY {y}–{String((y + 1) % 100).padStart(2, '0')} (Apr {y})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleCreate()}
          disabled={busy}
          sx={erpContainedButtonSx}
        >
          {busy ? 'Creating…' : 'Create & Switch'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
