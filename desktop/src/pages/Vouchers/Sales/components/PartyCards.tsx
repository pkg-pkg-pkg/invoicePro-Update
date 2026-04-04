import { FC, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
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
import { lookupPincode } from '../../../../utils/pincodeUtils';

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
}

const PartyCards: FC<PartyCardsProps> = ({ mode, billing, shipping, ledgers, parties, onChange, onQuickCreateCustomer }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

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

  // Handle pincode change with auto-extraction of state and district
  const handlePincodeChange = useCallback((pincode: string, partyType: 'billing' | 'shipping') => {
    const patch: Partial<PartyInfo> = { pin: pincode };
    
    // If valid pincode, auto-fill state and district
    if (pincode && pincode.length === 6) {
      const pincodeInfo = lookupPincode(pincode);
      if (pincodeInfo) {
        patch.state = pincodeInfo.state;
        patch.district = pincodeInfo.district;
        patch.city = pincodeInfo.district; // Use district as city for consistency
      }
    }
    
    onChange({ [partyType]: patch });
  }, [onChange]);

  const renderSelect = (party: PartyInfo, key: 'billing' | 'shipping', label: string) => (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1}>
        <TextField
          select
          label={label}
          value={party.ledgerId}
          onChange={(e) => {
            const selectedLedgerId = e.target.value;
            
            // Find the selected party from parties array using ledgerId
            const selectedParty = parties?.find(p => p.ledgerId === selectedLedgerId);
            
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
                  state: selectedParty.state,
                  pin: selectedParty.pincode,
                }
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
          <Button
            variant="outlined"
            onClick={onQuickCreateCustomer}
            sx={{ minWidth: 100 }}
          >
            + New
          </Button>
        )}
      </Stack>
    </Stack>
  );

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
      {(party.city || party.state) && (
        <Typography variant="body2" color="text.secondary">
          {[party.city, party.state].filter(Boolean).join(', ')}
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

  const renderPartyForm = (party: PartyInfo, partyType: 'billing' | 'shipping') => (
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
      <Grid item xs={12} sm={6}>
        <TextField
          label="City"
          value={party.city || ''}
          onChange={(e) => onChange({ [partyType]: { city: e.target.value } })}
          fullWidth
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <TextField
          label="PIN"
          value={party.pin || ''}
          onChange={(e) => handlePincodeChange(e.target.value, partyType)}
          fullWidth
          inputProps={{ maxLength: 6 }}
          error={party.pin ? party.pin.length !== 6 : false}
          helperText={
            party.pin
              ? party.pin.length === 6
                ? party.district
                  ? `${party.district} auto-filled`
                  : 'Pincode not in master'
                : `Enter 6 digits`
              : 'Auto-fills state & district'
          }
        />
      </Grid>
      <Grid item xs={6} sm={3}>
        <TextField
          label="State"
          value={party.state || ''}
          onChange={(e) => onChange({ [partyType]: { state: e.target.value } })}
          fullWidth
          helperText="Auto-filled by GSTIN or Pincode"
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

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="overline" color="text.secondary">
                Bill To
              </Typography>
              {mode === 'edit' ? (
                <>
                  {renderSelect(billing, 'billing', 'Customer Ledger')}
                  {renderPartyForm(billing, 'billing')}
                </>
              ) : (
                renderDisplay('Customer', billing)
              )}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={6}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="overline" color="text.secondary">
                Ship To
              </Typography>
              {mode === 'edit' ? (
                <>
                  <Grid container spacing={1}>
                    <Grid item xs={12}>
                      <TextField
                        label="Name"
                        value={shipping.name || billing.name || ''}
                        onChange={(e) => onChange({ shipping: { name: e.target.value } })}
                        fullWidth
                      />
                    </Grid>
                  </Grid>
                  {renderPartyForm(shipping, 'shipping')}
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
