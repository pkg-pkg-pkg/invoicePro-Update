import { FC, useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

import { LedgerAccount } from '../../../../types/masters';
import { Party } from '../../../../types/party';
import { VoucherMode } from './InvoiceHeader';
import { extractStateFromGSTIN, validateGSTIN } from '../../../../utils/gstinUtils';
import { usePincodeAutofill } from '../../../../hooks/usePincodeAutofill';
import PincodeTextField from '../../../../components/PincodeTextField';

export interface PartyInfo {
  ledgerId: string;
  name?: string;
  gstin?: string;
  address?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  pin?: string;
  district?: string;
}

interface PartyCardsProps {
  mode: VoucherMode;
  billing: PartyInfo;
  shipping: PartyInfo;
  ledgers?: LedgerAccount[];
  parties?: Party[];
  onChange: (patch: { billing?: Partial<PartyInfo>; shipping?: Partial<PartyInfo> }) => void;
  onQuickCreateCustomer?: () => void;
  /** `picker` opens a Tally-style search modal from the parent instead of a long dropdown. */
  billingCustomerSelector?: 'menu' | 'picker';
  onOpenBillingCustomerPicker?: () => void;
}

const PartyCards: FC<PartyCardsProps> = ({
  mode,
  billing,
  shipping,
  ledgers,
  parties,
  onChange,
  onQuickCreateCustomer,
  billingCustomerSelector = 'menu',
  onOpenBillingCustomerPicker,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [showBillingDetails, setShowBillingDetails] = useState(false);
  const [showShippingDetails, setShowShippingDetails] = useState(false);

  // Use parties if available, otherwise fall back to ledgers
  const availableOptions = parties ? parties.map(p => ({ id: p.ledgerId, name: p.name })) : (ledgers?.map(l => ({ id: l.id, name: l.name })) ?? []);

  // Handle GSTIN change with auto-extraction of state
  const handleGSTINChange = useCallback((gstin: string, partyType: 'billing' | 'shipping') => {
    const patch: Partial<PartyInfo> = { gstin };
    
    // If valid GSTIN, auto-fill state
    if (gstin && validateGSTIN(gstin)) {
      const extractedState = extractStateFromGSTIN(gstin);
      if (extractedState) {
        patch.state = extractedState;
      }
    }
    
    onChange({ [partyType]: patch });
  }, [onChange]);

  const billingPinAutofill = usePincodeAutofill({
    onFilled: useCallback(
      (addr) =>
        onChange({
          billing: { city: addr.city, district: addr.district, state: addr.state },
        }),
      [onChange]
    ),
  });

  const shippingPinAutofill = usePincodeAutofill({
    onFilled: useCallback(
      (addr) =>
        onChange({
          shipping: { city: addr.city, district: addr.district, state: addr.state },
        }),
      [onChange]
    ),
  });

  const renderSelect = (party: PartyInfo, key: 'billing' | 'shipping', label: string) => {
    const usePicker = key === 'billing' && billingCustomerSelector === 'picker';

    if (usePicker) {
      const display =
        party.name ||
        (party.ledgerId ? availableOptions.find((o) => o.id === party.ledgerId)?.name : '') ||
        '';
      return (
        <Stack spacing={1}>
          <Stack direction="row" spacing={1}>
            <TextField
              label={label}
              value={display}
              placeholder="Click to search customers (Tab does not reopen picker)"
              fullWidth
              InputProps={{ readOnly: true }}
              onClick={() => onOpenBillingCustomerPicker?.()}
              inputProps={{ 'aria-haspopup': 'dialog' as const }}
            />
            {key === 'billing' && (
              <Button variant="outlined" onClick={onQuickCreateCustomer} sx={{ minWidth: 100 }}>
                + New
              </Button>
            )}
          </Stack>
        </Stack>
      );
    }

    return (
      <Stack spacing={1}>
        <Stack direction="row" spacing={1}>
          <TextField
            select
            label={label}
            value={party.ledgerId}
            onChange={(e) => {
              const selectedLedgerId = e.target.value;

              // Find the selected party from parties array using ledgerId
              const selectedParty = parties?.find((p) => p.ledgerId === selectedLedgerId);

              if (selectedParty) {
                // Auto-populate all party details
                onChange({
                  [key]: {
                    ledgerId: selectedLedgerId,
                    name: selectedParty.name,
                    gstin: selectedParty.gstin,
                    address: selectedParty.address,
                    phone: selectedParty.mobile,
                    email: selectedParty.email,
                    city: selectedParty.city,
                    district: selectedParty.district,
                    state: selectedParty.state,
                    pin: selectedParty.pincode,
                  },
                });
              } else {
                // Fallback to just ledgerId if party not found
                onChange({ [key]: { ledgerId: selectedLedgerId } });
              }
            }}
            fullWidth
          >
            <MenuItem value="">
              <em>Select</em>
            </MenuItem>
            {availableOptions.map((option) => (
              <MenuItem key={option.id} value={option.id}>
                {option.name}
              </MenuItem>
            ))}
          </TextField>
          {key === 'billing' && (
            <Button variant="outlined" onClick={onQuickCreateCustomer} sx={{ minWidth: 100 }}>
              + New
            </Button>
          )}
        </Stack>
      </Stack>
    );
  };

  const renderDisplay = (title: string, party: PartyInfo) => (
    <Box>
      <Typography variant="subtitle1" fontWeight={600}>
        {title}
      </Typography>
      <Typography variant="body2" fontWeight={600} color="primary" sx={{ mb: 1 }}>
        {party.name || 'Not selected'}
      </Typography>
      {party.address && (
        <Typography variant="body2" color="text.secondary">
          {party.address}
        </Typography>
      )}
      {(party.city || party.district || party.state) && (
        <Typography variant="body2" color="text.secondary">
          {[party.city, party.district, party.state].filter(Boolean).join(', ')}
          {party.pin && ` - ${party.pin}`}
        </Typography>
      )}
      {party.gstin && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          <strong>GSTIN:</strong> {party.gstin}
        </Typography>
      )}
      {(party.phone || party.email) && (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {party.phone && (
            <Typography variant="body2" color="text.secondary">
              <strong>Phone:</strong> {party.phone}
            </Typography>
          )}
          {party.email && (
            <Typography variant="body2" color="text.secondary">
              <strong>Email:</strong> {party.email}
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  );

  const renderPartyForm = (party: PartyInfo, partyType: 'billing' | 'shipping') => {
    const pinAutofill = partyType === 'billing' ? billingPinAutofill : shippingPinAutofill;
    return (
    <Grid container spacing={1}>
      <Grid item xs={12}>
        <TextField
          label="GSTIN"
          value={party.gstin || ''}
          onChange={(e) => handleGSTINChange(e.target.value, partyType)}
          fullWidth
          error={party.gstin ? !validateGSTIN(party.gstin) : false}
          helperText={
            party.gstin && !validateGSTIN(party.gstin)
              ? 'Invalid GSTIN format (must be 15 characters)'
              : party.gstin && validateGSTIN(party.gstin)
                ? `State auto-filled: ${party.state || 'detecting...'}`
                : 'Auto-fills state when valid GSTIN entered'
          }
        />
      </Grid>
      <Grid item xs={12}>
        <TextField
          label="Address"
          value={party.address || ''}
          onChange={(e) => onChange({ [partyType]: { address: e.target.value } })}
          fullWidth
          multiline
          minRows={2}
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <PincodeTextField
          label="PIN"
          size="small"
          value={party.pin || ''}
          onPinChange={(pin) => onChange({ [partyType]: { pin } })}
          autofill={pinAutofill}
          fullWidth
          helperText="Auto-fills city, district & state"
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <TextField
          label="City"
          size="small"
          value={party.city || ''}
          onChange={(e) => {
            pinAutofill.clearHighlight('city');
            onChange({ [partyType]: { city: e.target.value } });
          }}
          sx={pinAutofill.fieldSx('city')}
          fullWidth
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <TextField
          label="District"
          size="small"
          value={party.district || ''}
          onChange={(e) => {
            pinAutofill.clearHighlight('district');
            onChange({ [partyType]: { district: e.target.value } });
          }}
          sx={pinAutofill.fieldSx('district')}
          fullWidth
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <TextField
          label="State"
          size="small"
          value={party.state || ''}
          onChange={(e) => {
            pinAutofill.clearHighlight('state');
            onChange({ [partyType]: { state: e.target.value } });
          }}
          sx={pinAutofill.fieldSx('state')}
          fullWidth
          helperText="Auto-filled by GSTIN or PIN"
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          label="Phone"
          value={party.phone || ''}
          onChange={(e) => onChange({ [partyType]: { phone: e.target.value } })}
          fullWidth
        />
      </Grid>
      <Grid item xs={12} sm={6}>
        <TextField
          label="Email"
          value={party.email || ''}
          onChange={(e) => onChange({ [partyType]: { email: e.target.value } })}
          fullWidth
          type="email"
        />
      </Grid>
    </Grid>
    );
  };

  const hasShippingOverride = useMemo(
    () =>
      Boolean(
        shipping.name ||
          shipping.address ||
          shipping.gstin ||
          shipping.phone ||
          shipping.email ||
          shipping.city ||
          shipping.state ||
          shipping.pin
      ),
    [shipping]
  );

  return (
    <Grid container spacing={1.5}>
      <Grid item xs={12} md={7}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack spacing={1.25}>
              <Typography variant="overline" color="text.secondary">
                Bill To
              </Typography>
              {mode === 'edit' ? (
                <>
                  {renderSelect(billing, 'billing', 'Customer Ledger')}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {billing.name || 'No customer selected'}
                    </Typography>
                    <Button size="small" onClick={() => setShowBillingDetails((prev) => !prev)}>
                      {showBillingDetails ? 'Hide details' : 'Edit details'}
                    </Button>
                  </Stack>
                  <Collapse in={showBillingDetails}>
                    {renderPartyForm(billing, 'billing')}
                  </Collapse>
                </>
              ) : (
                renderDisplay('Customer', billing)
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
            <Stack spacing={1.25}>
              <Typography variant="overline" color="text.secondary">
                Ship To
              </Typography>
              {mode === 'edit' ? (
                <>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      {hasShippingOverride ? 'Custom shipping details' : 'Same as billing (default)'}
                    </Typography>
                    <Button size="small" onClick={() => setShowShippingDetails((prev) => !prev)}>
                      {showShippingDetails ? 'Hide' : 'Override'}
                    </Button>
                  </Stack>
                  <Collapse in={showShippingDetails}>
                    <Grid container spacing={1} sx={{ mb: 1 }}>
                      <Grid item xs={12}>
                        <TextField
                          label="Name"
                          value={shipping.name || billing.name || ''}
                          onChange={(e) => onChange({ shipping: { name: e.target.value } })}
                          fullWidth
                          size="small"
                        />
                      </Grid>
                    </Grid>
                    {renderPartyForm(shipping, 'shipping')}
                  </Collapse>
                </>
              ) : (
                renderDisplay('Shipping', shipping)
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      {isMobile && (
        <Grid item xs={12}>
          <Typography variant="caption" color="text.secondary">
            Shipping card stacks below billing on smaller screens.
          </Typography>
        </Grid>
      )}
    </Grid>
  );
};

export default PartyCards;
