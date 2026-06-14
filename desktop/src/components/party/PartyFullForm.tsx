import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
  Grid,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import type { Party, PartyInput, PartyType } from '../../types/party';
import type { PartyFullFormValues } from '../../types/partyProfile';
import {
  buildDefaultPartyProfile,
  emptyAddress,
  emptyBankAccount,
  emptyContactPerson,
} from '../../types/partyProfile';
import { CollapsibleFormSection } from '../forms/CollapsibleFormSection';
import { IfscField } from '../forms/IfscField';
import PincodeTextField from '../PincodeTextField';
import { usePincodeAutofill } from '../../hooks/usePincodeAutofill';
import { useFormDraftAutosave, clearFormDraft } from '../../hooks/useFormDraftAutosave';
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning';
import { INDIAN_STATES } from '../../utils/constants';
import {
  CURRENCY_OPTIONS,
  GST_TREATMENTS,
  PAYMENT_TERMS_OPTIONS,
  SALUTATIONS,
  TAX_PREFERENCES,
  BANK_ACCOUNT_TYPES,
  gstinStateName,
  isValidGstin,
  isValidIndianMobile,
  isValidPan,
  isValidPinCode,
  normalizeGstin,
  normalizeIndianMobile,
  normalizePan,
  validateGstinField,
  validateIndianMobileField,
  validatePanField,
} from '../../utils/indianTaxValidation';
import { generateId } from '../../utils/id';
import { priceListService } from '../../services/masters/priceListService';

export type PartyFullFormMode = 'customer' | 'vendor';

type Props = {
  mode: PartyFullFormMode;
  party?: Party | null;
  embedded?: boolean;
  saving?: boolean;
  onCancel?: () => void;
  onSave: (values: PartyInput, profile: PartyFullFormValues['profile'], saveAndNew?: boolean) => void | Promise<void>;
};

function partyTypeForMode(mode: PartyFullFormMode): PartyType {
  return mode === 'vendor' ? 'SUPPLIER' : 'BUYER';
}

function buildInitialValues(mode: PartyFullFormMode, party?: Party | null): PartyFullFormValues {
  const profile = buildDefaultPartyProfile(mode);
  if (party) {
    profile.displayName = party.name;
    profile.billingAddress = {
      ...emptyAddress(),
      street1: party.address ?? '',
      city: party.city ?? '',
      state: party.state ?? '',
      pinCode: party.pincode ?? '',
    };
    if (profile.shippingSameAsBilling) {
      profile.shippingAddress = { ...profile.billingAddress };
    }
  }
  return {
    partyType: party?.partyType ?? partyTypeForMode(mode),
    name: party?.name ?? '',
    mobile: party?.mobile ?? '',
    gstin: party?.gstin ?? '',
    address: party?.address ?? '',
    city: party?.city ?? '',
    district: party?.district ?? '',
    state: party?.state ?? '',
    pincode: party?.pincode ?? '',
    email: party?.email ?? '',
    whatsapp: party?.whatsapp ?? '',
    openingBalance: party?.openingBalance ?? 0,
    status: party?.status ?? 'ACTIVE',
    profile,
  };
}

export function PartyFullForm({ mode, party, embedded, saving, onCancel, onSave }: Props) {
  const draftKey = `pve_draft_party_${mode}_${party?.id ?? 'new'}`;
  const [values, setValues] = useState<PartyFullFormValues>(() => buildInitialValues(mode, party));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceLists, setPriceLists] = useState<{ id: string; name: string }[]>([]);
  const [gstinHint, setGstinHint] = useState<string | null>(null);
  const [panHint, setPanHint] = useState<string | null>(null);

  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    priceListService.list().then((rows) => setPriceLists(rows.map((r) => ({ id: r.id, name: r.name })))).catch(() => setPriceLists([]));
  }, []);

  useEffect(() => {
    setValues(buildInitialValues(mode, party));
    setDirty(false);
  }, [mode, party?.id]);

  useFormDraftAutosave(draftKey, values, dirty && !party, (saved) => {
    setValues(saved);
  });

  const pinAutofill = usePincodeAutofill({
    onFilled: useCallback((addr) => {
      setValues((prev) => ({
        ...prev,
        profile: {
          ...prev.profile,
          billingAddress: {
            ...(prev.profile.billingAddress ?? emptyAddress()),
            city: addr.city,
            state: addr.state,
          },
        },
        city: addr.city,
        district: addr.district,
        state: addr.state,
      }));
      setDirty(true);
    }, []),
  });

  const suggestedDisplayName = useMemo(() => {
    const p = values.profile;
    if (mode === 'customer' && p.customerType === 'Business' && p.companyName?.trim()) {
      return p.companyName.trim();
    }
    const full = [p.firstName, p.lastName].filter(Boolean).join(' ').trim();
    return full || values.name;
  }, [mode, values.profile, values.name]);

  useEffect(() => {
    if (!values.profile.displayName && suggestedDisplayName) {
      setValues((prev) => ({
        ...prev,
        profile: { ...prev.profile, displayName: suggestedDisplayName },
        name: suggestedDisplayName,
      }));
    }
  }, [suggestedDisplayName, values.profile.displayName]);

  const patchProfile = (patch: Partial<PartyFullFormValues['profile']>) => {
    setDirty(true);
    setValues((prev) => ({ ...prev, profile: { ...prev.profile, ...patch } }));
  };

  const patchRoot = (patch: Partial<PartyFullFormValues>) => {
    setDirty(true);
    setValues((prev) => ({ ...prev, ...patch }));
  };

  const validate = (): boolean => {
    const display = values.profile.displayName?.trim() || values.name.trim();
    if (!display) {
      setError(`${mode === 'customer' ? 'Customer' : 'Vendor'} display name is required.`);
      return false;
    }
    const mobileErr = validateIndianMobileField(values.mobile, true);
    if (mobileErr) {
      setError(mobileErr);
      return false;
    }
    if (values.gstin?.trim()) {
      const gstErr = validateGstinField(values.gstin);
      if (gstErr) {
        setError(gstErr);
        return false;
      }
    }
    if (values.profile.pan?.trim()) {
      const panErr = validatePanField(values.profile.pan);
      if (panErr) {
        setError(panErr);
        return false;
      }
    }
    const pin = values.profile.billingAddress?.pinCode ?? values.pincode ?? '';
    if (pin && !isValidPinCode(pin)) {
      setError('Billing PIN must be 6 digits.');
      return false;
    }
    for (const bank of values.profile.bankAccounts ?? []) {
      if (!bank.accountNumber && !bank.ifscCode) continue;
      if (bank.accountNumber !== bank.confirmAccountNumber) {
        setError('Bank account numbers do not match.');
        return false;
      }
    }
    setError(null);
    return true;
  };

  const buildPartyInput = (): PartyInput => {
    const billing = values.profile.billingAddress ?? emptyAddress();
    const display = values.profile.displayName?.trim() || values.name.trim();
    return {
      name: display,
      mobile: normalizeIndianMobile(values.mobile),
      gstin: normalizeGstin(values.gstin ?? ''),
      address: billing.street1 || values.address,
      city: billing.city || values.city,
      district: values.district,
      state: billing.state || values.state,
      pincode: billing.pinCode || values.pincode,
      partyType: mode === 'vendor' ? 'SUPPLIER' : 'BUYER',
      email: values.email,
      whatsapp: values.whatsapp || normalizeIndianMobile(values.mobile),
      openingBalance: Number(values.openingBalance ?? 0),
      status: values.status,
    };
  };

  const handleSubmit = async (saveAndNew = false) => {
    if (!validate()) return;
    const input = buildPartyInput();
    await onSave(input, values.profile, saveAndNew);
    clearFormDraft(draftKey);
    setDirty(false);
    if (saveAndNew) {
      setValues(buildInitialValues(mode, null));
    }
  };

  const gstinValid = values.gstin?.trim() ? isValidGstin(values.gstin) : null;
  const panValid = values.profile.pan?.trim() ? isValidPan(values.profile.pan) : null;
  const mobileValid = values.mobile.trim() ? isValidIndianMobile(values.mobile) : null;

  return (
    <Box>
      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <CollapsibleFormSection title={mode === 'customer' ? '1. Customer Type & Primary Contact' : '1. Primary Contact'}>
        <Grid container spacing={2}>
          {mode === 'customer' && party?.id ? (
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Status"
                fullWidth
                size="small"
                value={values.status ?? 'ACTIVE'}
                onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as 'ACTIVE' | 'INACTIVE' }))}
              >
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
              </TextField>
            </Grid>
          ) : null}
          {mode === 'customer' ? (
            <Grid item xs={12}>
              <FormControl>
                <FormLabel>Customer Type *</FormLabel>
                <RadioGroup
                  row
                  value={values.profile.customerType ?? 'Business'}
                  onChange={(e) => patchProfile({ customerType: e.target.value as 'Business' | 'Individual' })}
                >
                  <FormControlLabel value="Business" control={<Radio size="small" />} label="Business" />
                  <FormControlLabel value="Individual" control={<Radio size="small" />} label="Individual" />
                </RadioGroup>
              </FormControl>
            </Grid>
          ) : null}
          <Grid item xs={6} md={2}>
            <TextField select label="Salutation" fullWidth size="small" value={values.profile.salutation ?? 'Mr'} onChange={(e) => patchProfile({ salutation: e.target.value })}>
              {SALUTATIONS.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={5}>
            <TextField label="First Name" fullWidth size="small" value={values.profile.firstName ?? ''} onChange={(e) => patchProfile({ firstName: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={5}>
            <TextField label="Last Name" fullWidth size="small" value={values.profile.lastName ?? ''} onChange={(e) => patchProfile({ lastName: e.target.value })} />
          </Grid>
          {(mode === 'customer' && values.profile.customerType === 'Business') || mode === 'vendor' ? (
            <Grid item xs={12} md={6}>
              <TextField
                label={mode === 'vendor' ? 'Company Name *' : 'Company Name *'}
                fullWidth
                size="small"
                required
                value={values.profile.companyName ?? ''}
                onChange={(e) => patchProfile({ companyName: e.target.value })}
              />
            </Grid>
          ) : null}
          <Grid item xs={12} md={6}>
            <TextField
              label={mode === 'customer' ? 'Customer Display Name *' : 'Vendor Display Name *'}
              fullWidth
              size="small"
              required
              value={values.profile.displayName ?? ''}
              onChange={(e) => patchRoot({ name: e.target.value, profile: { ...values.profile, displayName: e.target.value } })}
              helperText={suggestedDisplayName ? `Suggested: ${suggestedDisplayName}` : undefined}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField label="Email" type="email" fullWidth size="small" value={values.email ?? ''} onChange={(e) => patchRoot({ email: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              label="Phone / Mobile *"
              fullWidth
              size="small"
              required
              value={values.mobile}
              onChange={(e) => patchRoot({ mobile: e.target.value })}
              error={mobileValid === false}
              helperText={mobileValid === false ? 'Invalid mobile' : undefined}
              InputProps={{
                endAdornment: mobileValid === true ? <CheckCircleIcon color="success" fontSize="small" /> : mobileValid === false ? <ErrorIcon color="error" fontSize="small" /> : undefined,
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField label="Website" fullWidth size="small" value={values.profile.website ?? ''} onChange={(e) => patchProfile({ website: e.target.value })} />
          </Grid>
        </Grid>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="2. GST & Tax Details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField select label="GST Treatment" fullWidth size="small" value={values.profile.gstTreatment ?? ''} onChange={(e) => patchProfile({ gstTreatment: e.target.value })}>
              {GST_TREATMENTS.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="GSTIN"
              fullWidth
              size="small"
              value={values.gstin ?? ''}
              onChange={(e) => {
                const v = normalizeGstin(e.target.value);
                patchRoot({ gstin: v });
                setGstinHint(gstinStateName(v));
              }}
              inputProps={{ maxLength: 15 }}
              error={gstinValid === false}
              helperText={
                gstinValid === false
                  ? 'Invalid GSTIN format'
                  : gstinHint
                    ? `State: ${gstinHint}`
                    : undefined
              }
              InputProps={{
                endAdornment: gstinValid === true ? <CheckCircleIcon color="success" fontSize="small" /> : gstinValid === false ? <ErrorIcon color="error" fontSize="small" /> : undefined,
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              options={INDIAN_STATES}
              value={values.profile.placeOfSupply || null}
              onChange={(_e, v) => patchProfile({ placeOfSupply: v ?? '' })}
              renderInput={(params) => <TextField {...params} label={mode === 'customer' ? 'Place of Supply' : 'Source of Supply'} size="small" />}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              label="PAN Number"
              fullWidth
              size="small"
              value={values.profile.pan ?? ''}
              onChange={(e) => {
                patchProfile({ pan: normalizePan(e.target.value).slice(0, 10) });
                setPanHint(null);
              }}
              error={panValid === false}
              helperText={panValid === false ? 'Invalid PAN' : undefined}
              InputProps={{
                endAdornment: panValid === true ? <CheckCircleIcon color="success" fontSize="small" /> : panValid === false ? <ErrorIcon color="error" fontSize="small" /> : undefined,
              }}
            />
          </Grid>
          {mode === 'vendor' ? (
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox checked={Boolean(values.profile.tdsApplicable)} onChange={(e) => patchProfile({ tdsApplicable: e.target.checked })} />}
                label="TDS Applicable"
              />
            </Grid>
          ) : null}
          <Grid item xs={12} md={6}>
            <TextField select label="Tax Preference" fullWidth size="small" value={values.profile.taxPreference ?? 'Taxable'} onChange={(e) => patchProfile({ taxPreference: e.target.value })}>
              {TAX_PREFERENCES.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="3. Other Details">
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <TextField select label="Currency" fullWidth size="small" value={values.profile.currency ?? 'INR'} onChange={(e) => patchProfile({ currency: e.target.value })}>
              {CURRENCY_OPTIONS.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField select label="Payment Terms" fullWidth size="small" value={values.profile.paymentTerms ?? ''} onChange={(e) => patchProfile({ paymentTerms: e.target.value })}>
              {PAYMENT_TERMS_OPTIONS.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField select label="Default price list" fullWidth size="small" value={values.profile.priceListId ?? ''} onChange={(e) => patchProfile({ priceListId: e.target.value })}>
              <MenuItem value="">None</MenuItem>
              {priceLists.map((pl) => (
                <MenuItem key={pl.id} value={pl.id}>{pl.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField label="Credit Limit (₹)" type="number" fullWidth size="small" value={values.profile.creditLimit ?? 0} onChange={(e) => patchProfile({ creditLimit: Number(e.target.value) })} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField label="Opening Balance (₹)" type="number" fullWidth size="small" value={values.openingBalance ?? 0} onChange={(e) => patchRoot({ openingBalance: Number(e.target.value) })} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField label="Opening Balance As-of" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={values.profile.openingBalanceAsOf ?? ''} onChange={(e) => patchProfile({ openingBalanceAsOf: e.target.value })} />
          </Grid>
        </Grid>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="4. Address">
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="subtitle2" fontWeight={700}>Billing Address</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField label="Attention" fullWidth size="small" value={values.profile.billingAddress?.attention ?? ''} onChange={(e) => patchProfile({ billingAddress: { ...(values.profile.billingAddress ?? emptyAddress()), attention: e.target.value } })} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Street Address (Line 1)" fullWidth size="small" value={values.profile.billingAddress?.street1 ?? ''} onChange={(e) => { patchRoot({ address: e.target.value }); patchProfile({ billingAddress: { ...(values.profile.billingAddress ?? emptyAddress()), street1: e.target.value } }); }} />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Street Address (Line 2)" fullWidth size="small" value={values.profile.billingAddress?.street2 ?? ''} onChange={(e) => patchProfile({ billingAddress: { ...(values.profile.billingAddress ?? emptyAddress()), street2: e.target.value } })} />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField label="City" fullWidth size="small" value={values.profile.billingAddress?.city ?? ''} onChange={(e) => { patchRoot({ city: e.target.value }); patchProfile({ billingAddress: { ...(values.profile.billingAddress ?? emptyAddress()), city: e.target.value } }); }} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Autocomplete
              options={INDIAN_STATES}
              value={values.profile.billingAddress?.state || null}
              onChange={(_e, v) => { patchRoot({ state: v ?? '' }); patchProfile({ billingAddress: { ...(values.profile.billingAddress ?? emptyAddress()), state: v ?? '' } }); }}
              renderInput={(params) => <TextField {...params} label="State" size="small" />}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <PincodeTextField
              label="PIN Code"
              fullWidth
              value={values.profile.billingAddress?.pinCode ?? ''}
              onPinChange={(v) => { patchRoot({ pincode: v }); patchProfile({ billingAddress: { ...(values.profile.billingAddress ?? emptyAddress()), pinCode: v } }); }}
              autofill={pinAutofill}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField label="Country" fullWidth size="small" value={values.profile.billingAddress?.country ?? 'India'} onChange={(e) => patchProfile({ billingAddress: { ...(values.profile.billingAddress ?? emptyAddress()), country: e.target.value } })} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={Boolean(values.profile.shippingSameAsBilling)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    patchProfile({
                      shippingSameAsBilling: checked,
                      shippingAddress: checked ? { ...(values.profile.billingAddress ?? emptyAddress()) } : values.profile.shippingAddress,
                    });
                  }}
                />
              }
              label={mode === 'customer' ? 'Shipping same as billing' : 'Same as billing'}
            />
          </Grid>
          {!values.profile.shippingSameAsBilling ? (
            <>
              <Grid item xs={12}>
                <Typography variant="subtitle2" fontWeight={700}>Shipping Address</Typography>
              </Grid>
              <Grid item xs={12}>
                <TextField label="Street 1" fullWidth size="small" value={values.profile.shippingAddress?.street1 ?? ''} onChange={(e) => patchProfile({ shippingAddress: { ...(values.profile.shippingAddress ?? emptyAddress()), street1: e.target.value } })} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="City" fullWidth size="small" value={values.profile.shippingAddress?.city ?? ''} onChange={(e) => patchProfile({ shippingAddress: { ...(values.profile.shippingAddress ?? emptyAddress()), city: e.target.value } })} />
              </Grid>
              <Grid item xs={12} md={4}>
                <Autocomplete options={INDIAN_STATES} value={values.profile.shippingAddress?.state || null} onChange={(_e, v) => patchProfile({ shippingAddress: { ...(values.profile.shippingAddress ?? emptyAddress()), state: v ?? '' } })} renderInput={(params) => <TextField {...params} label="State" size="small" />} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="PIN" fullWidth size="small" value={values.profile.shippingAddress?.pinCode ?? ''} onChange={(e) => patchProfile({ shippingAddress: { ...(values.profile.shippingAddress ?? emptyAddress()), pinCode: e.target.value.replace(/\D/g, '').slice(0, 6) } })} />
              </Grid>
            </>
          ) : null}
        </Grid>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="5. Contact Persons" defaultOpen={false}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Salutation</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell>Designation</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {(values.profile.contactPersons ?? []).map((cp, idx) => (
              <TableRow key={cp.id}>
                <TableCell>
                  <TextField select size="small" value={cp.salutation} onChange={(e) => {
                    const next = [...(values.profile.contactPersons ?? [])];
                    next[idx] = { ...cp, salutation: e.target.value };
                    patchProfile({ contactPersons: next });
                  }}>
                    {SALUTATIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                </TableCell>
                <TableCell><TextField size="small" value={cp.name} onChange={(e) => { const next = [...(values.profile.contactPersons ?? [])]; next[idx] = { ...cp, name: e.target.value }; patchProfile({ contactPersons: next }); }} /></TableCell>
                <TableCell><TextField size="small" value={cp.email} onChange={(e) => { const next = [...(values.profile.contactPersons ?? [])]; next[idx] = { ...cp, email: e.target.value }; patchProfile({ contactPersons: next }); }} /></TableCell>
                <TableCell><TextField size="small" value={cp.phone} onChange={(e) => { const next = [...(values.profile.contactPersons ?? [])]; next[idx] = { ...cp, phone: e.target.value }; patchProfile({ contactPersons: next }); }} /></TableCell>
                <TableCell><TextField size="small" value={cp.designation} onChange={(e) => { const next = [...(values.profile.contactPersons ?? [])]; next[idx] = { ...cp, designation: e.target.value }; patchProfile({ contactPersons: next }); }} /></TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => patchProfile({ contactPersons: (values.profile.contactPersons ?? []).filter((_, i) => i !== idx) })}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => patchProfile({ contactPersons: [...(values.profile.contactPersons ?? []), emptyContactPerson(generateId('cp'))] })}>
          Add Contact Person
        </Button>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="6. Bank Details" defaultOpen={false}>
        {(values.profile.bankAccounts ?? [emptyBankAccount()]).map((bank, idx) => (
          <Box key={bank.id || idx} sx={{ mb: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField label="Account Holder Name" fullWidth size="small" value={bank.accountHolderName} onChange={(e) => { const next = [...(values.profile.bankAccounts ?? [])]; next[idx] = { ...bank, accountHolderName: e.target.value }; patchProfile({ bankAccounts: next }); }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField label="Account Number" fullWidth size="small" value={bank.accountNumber} onChange={(e) => { const next = [...(values.profile.bankAccounts ?? [])]; next[idx] = { ...bank, accountNumber: e.target.value }; patchProfile({ bankAccounts: next }); }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField label="Re-enter Account Number" fullWidth size="small" value={bank.confirmAccountNumber} onChange={(e) => { const next = [...(values.profile.bankAccounts ?? [])]; next[idx] = { ...bank, confirmAccountNumber: e.target.value }; patchProfile({ bankAccounts: next }); }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <IfscField
                  value={bank.ifscCode}
                  onChange={(v) => { const next = [...(values.profile.bankAccounts ?? [])]; next[idx] = { ...bank, ifscCode: v }; patchProfile({ bankAccounts: next }); }}
                  onResolved={(data) => {
                    const next = [...(values.profile.bankAccounts ?? [])];
                    next[idx] = { ...bank, bankName: data.bankName, branchName: data.branchName, city: data.city, micr: data.micr };
                    patchProfile({ bankAccounts: next });
                  }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="Bank Name" fullWidth size="small" value={bank.bankName} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField label="Branch Name" fullWidth size="small" value={bank.branchName} InputProps={{ readOnly: true }} />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField select label="Account Type" fullWidth size="small" value={bank.accountType} onChange={(e) => { const next = [...(values.profile.bankAccounts ?? [])]; next[idx] = { ...bank, accountType: e.target.value }; patchProfile({ bankAccounts: next }); }}>
                  {BANK_ACCOUNT_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>
          </Box>
        ))}
        <Button startIcon={<AddIcon />} onClick={() => patchProfile({ bankAccounts: [...(values.profile.bankAccounts ?? []), { ...emptyBankAccount(), id: generateId('bank') }] })}>
          Add Another Bank Account
        </Button>
      </CollapsibleFormSection>

      <CollapsibleFormSection title="7. Portal Access" defaultOpen={false}>
        <FormControlLabel control={<Checkbox checked={Boolean(values.profile.portalEnabled)} onChange={(e) => patchProfile({ portalEnabled: e.target.checked })} />} label="Enable Portal" />
        <TextField select label="Portal Language" size="small" sx={{ mt: 1, minWidth: 200 }} value={values.profile.portalLanguage ?? 'English'} onChange={(e) => patchProfile({ portalLanguage: e.target.value })} disabled={!values.profile.portalEnabled}>
          <MenuItem value="English">English</MenuItem>
          <MenuItem value="Hindi">Hindi</MenuItem>
        </TextField>
        {values.profile.portalEnabled ? (
          <Button sx={{ ml: 2 }} variant="outlined" size="small" disabled title="Portal invites coming in a future update">
            Send Invite Email
          </Button>
        ) : null}
      </CollapsibleFormSection>

      <CollapsibleFormSection title="8. Documents Upload" defaultOpen={false}>
        <Button variant="outlined" component="label" size="small">
          Upload files (PDF, JPG, PNG, XLSX — max 10 × 10MB)
          <input
            hidden
            multiple
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.xlsx"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).slice(0, 10);
              void Promise.all(
                files.map(
                  (file) =>
                    new Promise<{ id: string; name: string; size: number; type: string; dataUrl: string }>((resolve, reject) => {
                      if (file.size > 10 * 1024 * 1024) return reject(new Error(`${file.name} exceeds 10MB`));
                      const reader = new FileReader();
                      reader.onload = () =>
                        resolve({ id: generateId('doc'), name: file.name, size: file.size, type: file.type, dataUrl: String(reader.result) });
                      reader.onerror = () => reject(new Error('Read failed'));
                      reader.readAsDataURL(file);
                    })
                )
              ).then((docs) => patchProfile({ documents: [...(values.profile.documents ?? []), ...docs].slice(0, 10) }));
            }}
          />
        </Button>
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {(values.profile.documents ?? []).map((doc) => (
            <Stack key={doc.id} direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2">{doc.name}</Typography>
              <IconButton size="small" onClick={() => patchProfile({ documents: (values.profile.documents ?? []).filter((d) => d.id !== doc.id) })}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </CollapsibleFormSection>

      {mode === 'customer' ? (
        <CollapsibleFormSection title="9. Reporting Tags & Custom Fields" defaultOpen={false}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={5}>
              <TextField label="Tag Name" fullWidth size="small" id="tag-name-input" />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField label="Tag Value" fullWidth size="small" id="tag-value-input" />
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  const nameEl = document.getElementById('tag-name-input') as HTMLInputElement | null;
                  const valEl = document.getElementById('tag-value-input') as HTMLInputElement | null;
                  const k = nameEl?.value.trim();
                  const v = valEl?.value.trim();
                  if (!k) return;
                  patchProfile({ reportingTags: { ...(values.profile.reportingTags ?? {}), [k]: v ?? '' } });
                  if (nameEl) nameEl.value = '';
                  if (valEl) valEl.value = '';
                }}
              >
                Add Tag
              </Button>
            </Grid>
          </Grid>
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {Object.entries(values.profile.reportingTags ?? {}).map(([k, v]) => (
              <Typography key={k} variant="body2">{k}: {v}</Typography>
            ))}
          </Stack>
        </CollapsibleFormSection>
      ) : null}

      <CollapsibleFormSection title={mode === 'customer' ? '10. Remarks / Notes' : '9. Remarks / Notes'} defaultOpen={false}>
        <TextField label="Internal notes" multiline minRows={3} fullWidth value={values.profile.remarks ?? ''} onChange={(e) => patchProfile({ remarks: e.target.value })} />
      </CollapsibleFormSection>

      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 2, pb: embedded ? 0 : 4 }}>
        {onCancel ? (
          <Button onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
        <Button variant="outlined" disabled={saving} onClick={() => void handleSubmit(true)}>
          Save & New
        </Button>
        <Button variant="contained" disabled={saving} onClick={() => void handleSubmit(false)}>
          {saving ? 'Saving…' : mode === 'customer' ? 'Save Customer' : 'Save Vendor'}
        </Button>
      </Stack>
    </Box>
  );
}
