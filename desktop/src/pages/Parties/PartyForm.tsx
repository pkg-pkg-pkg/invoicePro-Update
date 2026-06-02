import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Party, PartyInput, PartyType } from '../../types/party';
import { partyService } from '../../services/masters/partyService';
import { INDIAN_STATES } from '../../utils/constants';
import { usePincodeAutofill } from '../../hooks/usePincodeAutofill';
import PincodeTextField from '../../components/PincodeTextField';

export type PartyFormProps = {
  /** When true, used inside a dialog from Sales Voucher etc. — no route navigation. */
  embedded?: boolean;
  onSaved?: (party: Party) => void;
  onCancel?: () => void;
};

const PartyForm = ({ embedded = false, onSaved, onCancel }: PartyFormProps = {}) => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(!embedded && id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Shown under Mobile when number matches an existing party/ledger (checked on blur & before save). */
  const [mobileDuplicateHint, setMobileDuplicateHint] = useState<string | null>(null);
  const [editingLedgerId, setEditingLedgerId] = useState<string | undefined>();
  const [formData, setFormData] = useState<PartyInput>({
    name: '',
    mobile: '',
    gstin: '',
    address: '',
    city: '',
    district: '',
    state: '',
    pincode: '',
    partyType: 'BUYER',
    email: '',
    whatsapp: '',
    openingBalance: 0,
  });

  useEffect(() => {
    if (isEditMode && id) {
      loadParty(id);
    }
  }, [id, isEditMode]);

  useEffect(() => {
    if (!isEditMode) {
      setEditingLedgerId(undefined);
      setMobileDuplicateHint(null);
    }
  }, [isEditMode]);

  const loadParty = async (partyId: string) => {
    try {
      setLoading(true);
      const party = await partyService.getById(partyId);
      if (party) {
        setEditingLedgerId(party.ledgerId);
        setFormData({
          name: party.name,
          mobile: party.mobile,
          gstin: party.gstin || '',
          address: party.address || '',
          city: party.city || '',
          district: party.district || '',
          state: party.state || '',
          pincode: party.pincode || '',
          partyType: party.partyType,
          email: party.email || '',
          whatsapp: party.whatsapp || '',
          openingBalance: party.openingBalance || 0,
        });
      }
    } catch (err) {
      setError('Failed to load party');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const pinAutofill = usePincodeAutofill({
    onFilled: useCallback((addr) => {
      setFormData((prev) => ({
        ...prev,
        city: addr.city,
        district: addr.district,
        state: addr.state,
      }));
    }, []),
  });

  const handleChange = (field: keyof PartyInput, value: any) => {
    if (field === 'mobile') setMobileDuplicateHint(null);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const mobileDupCheckOpts = () => ({
    excludePartyId: isEditMode && id ? id : undefined,
    excludeLedgerId: isEditMode ? editingLedgerId : undefined,
  });

  const checkMobileDuplicateOnBlur = async () => {
    if (!formData.mobile.trim()) {
      setMobileDuplicateHint(null);
      return;
    }
    try {
      const hint = await partyService.getMobileDuplicateHint(formData.mobile, mobileDupCheckOpts());
      setMobileDuplicateHint(hint);
    } catch {
      setMobileDuplicateHint(null);
    }
  };

  const validate = (): boolean => {
    if (!formData.name.trim()) {
      setError('Party name is required');
      return false;
    }
    if (!formData.mobile.trim()) {
      setError('Mobile number is required');
      return false;
    }
    if (!formData.partyType) {
      setError('Party type is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    try {
      setLoading(true);
      setError(null);

      const dupHint = await partyService.getMobileDuplicateHint(formData.mobile, mobileDupCheckOpts());
      if (dupHint) {
        setError(dupHint);
        setMobileDuplicateHint(dupHint);
        return;
      }
      
      console.log('🎯 Submitting party form:', formData);

      if (isEditMode && id) {
        console.log('📝 Updating existing party:', id);
        const updated = await partyService.update(id, formData);
        console.log('✅ Party updated successfully');
        if (embedded && onSaved) {
          onSaved(updated);
        } else {
          navigate('/parties');
        }
      } else {
        console.log('➕ Creating new party...');
        const result = await partyService.create(formData);
        console.log('✅ Party created successfully:', result);
        if (embedded && onSaved) {
          onSaved(result);
        } else {
          navigate('/parties');
        }
      }
    } catch (err) {
      const errorMessage = (err as Error).message || 'Failed to save party';
      console.error('❌ Party creation failed:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      {!embedded && (
        <Typography variant="h6" sx={{ mb: 2 }}>
          {isEditMode ? 'Edit Party' : 'New Party'}
        </Typography>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card component="form" onSubmit={handleSubmit}>
        <CardContent>
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Basic Information
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Enter party details below
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Party Name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    fullWidth
                    required
                    disabled={loading}
                    placeholder="e.g., ABC Industries"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Mobile Number"
                    value={formData.mobile}
                    onChange={(e) => handleChange('mobile', e.target.value)}
                    onBlur={checkMobileDuplicateOnBlur}
                    fullWidth
                    required
                    disabled={loading}
                    placeholder="e.g., 9876543210"
                    error={Boolean(mobileDuplicateHint)}
                    helperText={mobileDuplicateHint || undefined}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    fullWidth
                    disabled={loading}
                    placeholder="e.g., contact@abc.com"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="WhatsApp"
                    value={formData.whatsapp}
                    onChange={(e) => handleChange('whatsapp', e.target.value)}
                    fullWidth
                    disabled={loading}
                    placeholder="e.g., 9876543210"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="GSTIN"
                    value={formData.gstin}
                    onChange={(e) => handleChange('gstin', e.target.value)}
                    fullWidth
                    disabled={loading}
                    placeholder="e.g., 27AABCT1234H1Z1"
                    helperText="15-character GST number (optional)"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <FormControl component="fieldset" required>
                    <FormLabel component="legend">Party Type</FormLabel>
                    <RadioGroup
                      row
                      value={formData.partyType}
                      onChange={(e) => handleChange('partyType', e.target.value as PartyType)}
                    >
                      <FormControlLabel
                        value="BUYER"
                        control={<Radio />}
                        label="Buyer"
                        disabled={loading}
                      />
                      <FormControlLabel
                        value="SUPPLIER"
                        control={<Radio />}
                        label="Supplier"
                        disabled={loading}
                      />
                      <FormControlLabel
                        value="BOTH"
                        control={<Radio />}
                        label="Both"
                        disabled={loading}
                      />
                    </RadioGroup>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

            <Box>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                Address Information
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Address"
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                    disabled={loading}
                    placeholder="Complete address"
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <PincodeTextField
                    label="Pincode"
                    value={formData.pincode || ''}
                    onPinChange={(pin) => handleChange('pincode', pin)}
                    autofill={pinAutofill}
                    fullWidth
                    disabled={loading}
                    placeholder="e.g., 834005"
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    label="City"
                    value={formData.city || ''}
                    onChange={(e) => {
                      pinAutofill.clearHighlight('city');
                      handleChange('city', e.target.value);
                    }}
                    sx={pinAutofill.fieldSx('city')}
                    fullWidth
                    disabled={loading}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    label="District"
                    value={formData.district || ''}
                    onChange={(e) => {
                      pinAutofill.clearHighlight('district');
                      handleChange('district', e.target.value);
                    }}
                    sx={pinAutofill.fieldSx('district')}
                    fullWidth
                    disabled={loading}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    select
                    label="State"
                    value={formData.state}
                    onChange={(e) => {
                      pinAutofill.clearHighlight('state');
                      handleChange('state', e.target.value);
                    }}
                    sx={pinAutofill.fieldSx('state')}
                    fullWidth
                    disabled={loading}
                  >
                    <MenuItem value="">
                      <em>Select State</em>
                    </MenuItem>
                    {INDIAN_STATES.map((state) => (
                      <MenuItem key={state} value={state}>
                        {state}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    label="Opening Balance"
                    type="number"
                    value={formData.openingBalance}
                    onChange={(e) => handleChange('openingBalance', parseFloat(e.target.value) || 0)}
                    fullWidth
                    disabled={loading}
                    helperText="₹ amount"
                  />
                </Grid>
              </Grid>
            </Box>

            <Alert severity="info">
              <strong>Note:</strong> Ledger account will be created automatically based on party type.
              {formData.partyType === 'BUYER' && ' (Sundry Debtors)'}
              {formData.partyType === 'SUPPLIER' && ' (Sundry Creditors)'}
              {formData.partyType === 'BOTH' && ' (Can be used in both Sales & Purchase)'}
            </Alert>

            <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={2} justifyContent="flex-end" flexWrap="wrap">
              <Button
                type="button"
                variant="outlined"
                onClick={() => (embedded && onCancel ? onCancel() : navigate('/parties'))}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={loading}
              >
                {loading ? 'Saving...' : isEditMode ? 'Update Party' : 'Create Party'}
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
};

export default PartyForm;
