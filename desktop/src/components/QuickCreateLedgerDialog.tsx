import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Stack,
  Alert,
  MenuItem,
  CircularProgress,
  Grid,
} from '@mui/material';
import { ledgerAccountService } from '../services/masters/ledgerAccountService';
import { autoLedgerService } from '../services/masters/autoLedgerService';

interface PartyDetails {
  name: string;
  gstin?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  pin?: string;
}

interface QuickCreateLedgerDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (ledgerId: string, ledgerName: string, details?: PartyDetails) => void;
  ledgerType?: 'CUSTOMER' | 'SUPPLIER' | 'SALES' | 'PURCHASE' | 'EXPENSE';
  title?: string;
}

interface GroupOption {
  groupId: string;
  groupName: string;
}

// All available groups for selection.
// IMPORTANT: groupId values must match seeded group IDs used by autoLedgerService/ledgerGroupService.
const ALL_GROUPS: GroupOption[] = [
  { groupId: 'grp-sundry-debtors', groupName: 'Sundry Debtors (Customers)' },
  { groupId: 'grp-sundry-creditors', groupName: 'Sundry Creditors (Suppliers)' },
  { groupId: 'grp-sales-accounts', groupName: 'Sales Account' },
  { groupId: 'grp-purchase-accounts', groupName: 'Purchase Account' },
  // Map Expenses to Purchase Accounts group for now
  { groupId: 'grp-purchase-accounts', groupName: 'Expenses' },
];

const INDIAN_STATES = [
  'Jammu & Kashmir', 'Himachal Pradesh', 'Punjab', 'Chandigarh', 'Uttarakhand', 'Haryana',
  'Delhi', 'Rajasthan', 'Uttar Pradesh', 'Bihar', 'Sikkim', 'Arunachal Pradesh',
  'Nagaland', 'Manipur', 'Mizoram', 'Tripura', 'Meghalaya', 'Assam',
  'West Bengal', 'Jharkhand', 'Odisha', 'Chhattisgarh', 'Madhya Pradesh', 'Gujarat',
  'Daman & Diu', 'Dadra & Nagar Haveli', 'Maharashtra', 'Karnataka', 'Goa', 'Lakshadweep',
  'Kerala', 'Tamil Nadu', 'Puducherry', 'Andaman & Nicobar Islands', 'Telangana', 'Ladakh',
];

export const QuickCreateLedgerDialog: React.FC<QuickCreateLedgerDialogProps> = ({
  open,
  onClose,
  onSave,
  ledgerType = 'CUSTOMER',
  title,
}) => {
  const [details, setDetails] = useState<PartyDetails>({
    name: '',
    gstin: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pin: '',
  });

  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPartyType = ['CUSTOMER', 'SUPPLIER'].includes(ledgerType);

  const defaultTitle = {
    CUSTOMER: 'Create New Customer',
    SUPPLIER: 'Create New Supplier',
    SALES: 'Create New Sales Account',
    PURCHASE: 'Create New Purchase Account',
    EXPENSE: 'Create New Expense',
  }[ledgerType];

  const handleCreate = async () => {
    if (!details.name.trim()) {
      setError(`${ledgerType} name is required`);
      return;
    }

    if (!selectedGroupId) {
      setError('Group selection is mandatory');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Ensure core ledger groups exist so that selected groupId is valid
      await autoLedgerService.ensureCore();

      const selectedGroup = ALL_GROUPS.find(g => g.groupId === selectedGroupId);
      if (!selectedGroup) {
        setError('Invalid group selection');
        return;
      }

      // Create the ledger
      const newLedger = await ledgerAccountService.create({
        name: details.name.trim(),
        code: details.name.trim().substring(0, 5).toUpperCase(),
        groupId: selectedGroupId,
        openingBalanceType: ledgerType === 'SUPPLIER' ? 'CREDIT' : 'DEBIT',
        openingBalance: 0,
        description: `Auto-created ${selectedGroup.groupName} - ${details.name}`,
        status: 'ACTIVE',
        // Add extended details for party types
        ...(isPartyType && {
          gstin: details.gstin,
          phone: details.phone,
          email: details.email,
          address: details.address,
          city: details.city,
          state: details.state,
          pin: details.pin,
        }),
      } as any);

      // Reset form and callback
      onSave(newLedger.id, newLedger.name, details);
      setDetails({ name: '', gstin: '', phone: '', email: '', address: '', city: '', state: '', pin: '' });
      setSelectedGroupId('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to create ${ledgerType.toLowerCase()}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDetails({ name: '', gstin: '', phone: '', email: '', address: '', city: '', state: '', pin: '' });
    setSelectedGroupId('');
    setError(null);
    onClose();
  };

  const selectedGroupName = ALL_GROUPS.find(g => g.groupId === selectedGroupId)?.groupName;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title || defaultTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 2 }}>
          {error && <Alert severity="error">{error}</Alert>}
          
          {/* Name - Required for all types */}
          <TextField
            autoFocus
            label={`${ledgerType} Name`}
            value={details.name}
            onChange={(e) => {
              setDetails({ ...details, name: e.target.value });
              setError(null);
            }}
            fullWidth
            placeholder={`e.g., ${
              ledgerType === 'CUSTOMER'
                ? 'ABC Industries'
                : ledgerType === 'SUPPLIER'
                ? 'XYZ Suppliers'
                : ledgerType === 'SALES'
                ? 'Local Sales'
                : ledgerType === 'PURCHASE'
                ? 'Local Purchase'
                : 'Office Expenses'
            }`}
            disabled={loading}
          />

          {/* Group Selection - MANDATORY */}
          <TextField
            select
            label="Group (Required)"
            value={selectedGroupId}
            onChange={(e) => {
              setSelectedGroupId(e.target.value);
              setError(null);
            }}
            fullWidth
            disabled={loading}
            error={!selectedGroupId && error?.includes('Group')}
            helperText={!selectedGroupId ? 'Select a group for this ledger' : ''}
          >
            <MenuItem value="">
              <em>-- Select Group --</em>
            </MenuItem>
            {ALL_GROUPS.map((group) => (
              <MenuItem key={group.groupId} value={group.groupId}>
                {group.groupName}
              </MenuItem>
            ))}
          </TextField>

          {isPartyType && (
            <>
              {/* GSTIN */}
              <TextField
                label="GSTIN"
                value={details.gstin}
                onChange={(e) => setDetails({ ...details, gstin: e.target.value })}
                fullWidth
                placeholder="27AABCT1234H1Z1"
                disabled={loading}
                helperText="15-character GST number (optional)"
              />

              {/* Phone & Email Row */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Phone"
                    value={details.phone}
                    onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                    fullWidth
                    placeholder="+91-9876543210"
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Email"
                    value={details.email}
                    onChange={(e) => setDetails({ ...details, email: e.target.value })}
                    fullWidth
                    type="email"
                    placeholder="contact@company.com"
                    disabled={loading}
                  />
                </Grid>
              </Grid>

              {/* Address */}
              <TextField
                label="Address"
                value={details.address}
                onChange={(e) => setDetails({ ...details, address: e.target.value })}
                fullWidth
                multiline
                rows={2}
                placeholder="Street address"
                disabled={loading}
              />

              {/* City, State, PIN Row */}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="City"
                    value={details.city}
                    onChange={(e) => setDetails({ ...details, city: e.target.value })}
                    fullWidth
                    placeholder="Bengaluru"
                    disabled={loading}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    select
                    label="State"
                    value={details.state}
                    onChange={(e) => setDetails({ ...details, state: e.target.value })}
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
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="PIN"
                    value={details.pin}
                    onChange={(e) => setDetails({ ...details, pin: e.target.value })}
                    fullWidth
                    placeholder="560001"
                    disabled={loading}
                    inputProps={{ maxLength: 6 }}
                  />
                </Grid>
              </Grid>

              <Alert severity="info">
                This {ledgerType.toLowerCase()} will be created with:
                <br />
                • Group: {selectedGroupName || 'Select a group above'}
                <br />• Status: Active
                <br />• Opening Balance: 0
              </Alert>
            </>
          )}

          {!isPartyType && (
            <Alert severity="info">
              This {ledgerType.toLowerCase()} will be created with:
              <br />
              • Group: {selectedGroupName || 'Select a group above'}
              <br />• Status: Active
              <br />• Opening Balance: 0
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={!details.name.trim() || !selectedGroupId || loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default QuickCreateLedgerDialog;
