import { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ledgerGroupService } from '../../../services/masters/ledgerGroupService';
import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { LedgerAccount, LedgerGroup } from '../../../types/masters';
import { useMasterForm } from '../../../hooks/useMasterForm';
import { usePermission } from '../../../hooks/usePermission';
import { useFocusField } from '../../../hooks/useFocusField';

interface LedgerAccountInput {
  name: string;
  code?: string | null;
  groupId: string;
  openingBalance: number;
  openingBalanceType: 'DEBIT' | 'CREDIT';
  isCashBank: boolean;
  bankDetails?: {
    accountNumber?: string | null;
    ifscCode?: string | null;
    bankName?: string | null;
    branchName?: string | null;
    accountType?: 'SAVINGS' | 'CURRENT' | 'CASH' | null;
  } | null;
}

const SCREEN_ID = 'ledger-account-form';

const LedgerAccountForm = () => {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const { can } = usePermission();
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formInitialized = useRef(false);

  // ... (inside component)
  useEffect(() => {
    if (!isEditMode && location.state?.isCashBank && !formInitialized.current) {
      setFormState(prev => ({
        ...prev,
        isCashBank: true,
        groupId: 'grp-bank-accounts', // Default to bank accounts group
      }));
    }
  }, [location.state, isEditMode]);

  const { entity, loading, saving, error, load, create, update, resetError } = useMasterForm<
    LedgerAccount,
    LedgerAccountInput
  >({
    load: async (entityId) => {
      const account = await ledgerAccountService.getById(entityId);
      if (!account) {
        throw new Error('Ledger account not found');
      }
      return account;
    },
    create: async (payload) =>
      ledgerAccountService.create({
        ...payload,
      }),
    update: async (entityId, payload) =>
      ledgerAccountService.update(entityId, {
        ...payload,
      }),
  });

  useEffect(() => {
    ledgerGroupService
      .list({ includeInactive: false })
      .then(setGroups)
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    formInitialized.current = false;
  }, [id]);

  useEffect(() => {
    if (isEditMode && id) {
      void load(id);
    }
  }, [id, isEditMode, load]);

  const [formState, setFormState] = useState<LedgerAccountInput>({
    name: '',
    code: '',
    groupId: '',
    openingBalance: 0,
    openingBalanceType: 'DEBIT',
    isCashBank: false,
    bankDetails: {
      accountNumber: '',
      ifscCode: '',
      bankName: '',
      branchName: '',
      accountType: 'CURRENT',
    },
  });

  useEffect(() => {
    if (entity && isEditMode && !formInitialized.current) {
      formInitialized.current = true;
      setFormState({
        name: entity.name,
        code: entity.code ?? '',
        groupId: entity.groupId,
        openingBalance: entity.openingBalance,
        openingBalanceType: entity.openingBalanceType,
        isCashBank: Boolean(entity.isCashBank),
        bankDetails: entity.bankDetails || {
          accountNumber: '',
          ifscCode: '',
          bankName: '',
          branchName: '',
          accountType: 'CURRENT',
        },
      });
    }
  }, [entity, isEditMode]);

  const canView = can('view-ledgers');
  const canManage = can('manage-ledgers');
  const formDisabled = saving || loading;

  const nameFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 1,
    disabled: formDisabled,
  });
  const codeFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 2,
    disabled: formDisabled,
  });
  const groupFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'header',
    order: 3,
    disabled: formDisabled,
  });
  const openingBalanceFieldRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'balance',
    order: 4,
    disabled: formDisabled || isEditMode,
  });
  const cashBankSwitchRef = useFocusField<HTMLInputElement>({
    screenId: SCREEN_ID,
    section: 'balance',
    order: 5,
    disabled: formDisabled,
  });

  interface GroupOption {
    id: string;
    label: string;
    type: LedgerGroup['type'];
  }

  const groupOptions: GroupOption[] = useMemo(() => {
    if (!groups.length) {
      return [];
    }

    const sortFn = (a: LedgerGroup, b: LedgerGroup) => {
      const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (order !== 0) return order;
      return a.name.localeCompare(b.name);
    };

    const childrenMap = groups.reduce<Record<string, LedgerGroup[]>>((acc, group) => {
      const parentId = group.parentGroupId ?? '__root__';
      acc[parentId] = acc[parentId] ?? [];
      acc[parentId].push(group);
      return acc;
    }, {});

    Object.values(childrenMap).forEach((list) => list.sort(sortFn));

    const buildOptions = (group: LedgerGroup, depth: number): GroupOption[] => {
      const children = childrenMap[group.id] ?? [];
      const prefix = depth === 0 ? '' : `${' '.repeat(depth * 2)}• `;
      const option: GroupOption = {
        id: group.id,
        label: `${prefix}${group.name}`,
        type: group.type,
      };
      return [option, ...children.flatMap((child) => buildOptions(child, depth + 1))];
    };

    const rootGroups = childrenMap['__root__'] ?? [];
    return rootGroups.flatMap((root) => buildOptions(root, 0));
  }, [groups]);

  const handleChange = <K extends keyof LedgerAccountInput>(field: K, value: LedgerAccountInput[K]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const deriveOpeningType = (groupId: string): 'DEBIT' | 'CREDIT' => {
    const selectedGroup = groups.find((group) => group.id === groupId);
    if (!selectedGroup) {
      return 'DEBIT';
    }
    return selectedGroup.type === 'LIABILITY' || selectedGroup.type === 'INCOME' ? 'CREDIT' : 'DEBIT';
  };

  const handleGroupChange = (groupId: string) => {
    const derivedType = deriveOpeningType(groupId);
    setFormState((prev) => ({
      ...prev,
      groupId,
      openingBalanceType: derivedType,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) {
      setSubmitError('You do not have permission to manage ledger accounts.');
      return;
    }
    if (!formState.name.trim()) {
      setSubmitError('Ledger name is required.');
      return;
    }
    if (!formState.groupId) {
      setSubmitError('Ledger group is required.');
      return;
    }
    try {
      setSubmitError(null);
      if (isEditMode && id) {
        await update(id, {
          ...formState,
          openingBalance: entity?.openingBalance ?? formState.openingBalance,
        });
      } else {
        await create(formState);
      }
      navigate('/masters/ledger-accounts');
    } catch (err) {
      setSubmitError((err as Error).message ?? 'Failed to save ledger account');
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">You do not have permission to view ledger accounts.</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card component="form" onSubmit={handleSubmit}>
      <CardContent>
        <Stack spacing={3}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h5" fontWeight={600}>
                {isEditMode ? 'Edit Ledger Account' : 'New Ledger Account'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isEditMode ? 'Update ledger details' : 'Enter details to create a ledger account'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained" disabled={saving || !canManage}>
                {saving ? <CircularProgress size={18} color="inherit" /> : isEditMode ? 'Save Changes' : 'Create'}
              </Button>
            </Stack>
          </Stack>

          {error && (
            <Alert severity="error" onClose={resetError}>
              {error.message}
            </Alert>
          )}
          {submitError && (
            <Alert severity="error" onClose={() => setSubmitError(null)}>
              {submitError}
            </Alert>
          )}

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <TextField
              label="Ledger Name"
              value={formState.name}
              onChange={(e) => handleChange('name', e.target.value)}
              required
              fullWidth
              disabled={formDisabled}
              inputRef={nameFieldRef}
            />
            <TextField
              label="Ledger Code"
              value={formState.code ?? ''}
              onChange={(e) => handleChange('code', e.target.value || '')}
              fullWidth
              disabled={formDisabled}
              inputRef={codeFieldRef}
            />
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <FormControl fullWidth>
              <InputLabel id="ledger-group-label">Group</InputLabel>
              <Select
                labelId="ledger-group-label"
                label="Group"
                value={formState.groupId}
                onChange={(e) => handleGroupChange(String(e.target.value))}
                required
                disabled={formDisabled}
                inputRef={groupFieldRef}
              >
                {groupOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>
                    {option.label} ({option.type})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
            <TextField
              label="Opening Balance"
              type="number"
              value={formState.openingBalance}
              onChange={(e) => handleChange('openingBalance', Number(e.target.value))}
              fullWidth
              disabled={isEditMode || formDisabled}
              inputProps={{ min: 0, step: '0.01' }}
              inputRef={openingBalanceFieldRef}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formState.isCashBank}
                  onChange={(_, checked) => handleChange('isCashBank', checked)}
                  disabled={formDisabled}
                  inputRef={cashBankSwitchRef}
                />
              }
              label="Cash / Bank Account"
            />
          </Stack>

          {formState.isCashBank && (
            <>
              <Divider>Bank Details</Divider>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                <TextField
                  label="Account Number"
                  value={formState.bankDetails?.accountNumber ?? ''}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      bankDetails: { ...prev.bankDetails, accountNumber: e.target.value },
                    }))
                  }
                  fullWidth
                  disabled={formDisabled}
                />
                <TextField
                  label="IFSC Code"
                  value={formState.bankDetails?.ifscCode ?? ''}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      bankDetails: { ...prev.bankDetails, ifscCode: e.target.value.toUpperCase() },
                    }))
                  }
                  fullWidth
                  disabled={formDisabled}
                />
              </Stack>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                <TextField
                  label="Bank Name"
                  value={formState.bankDetails?.bankName ?? ''}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      bankDetails: { ...prev.bankDetails, bankName: e.target.value },
                    }))
                  }
                  fullWidth
                  disabled={formDisabled}
                />
                <FormControl fullWidth>
                  <InputLabel id="account-type-label">Account Type</InputLabel>
                  <Select
                    labelId="account-type-label"
                    label="Account Type"
                    value={formState.bankDetails?.accountType ?? 'CURRENT'}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        bankDetails: {
                          ...prev.bankDetails,
                          accountType: e.target.value as any,
                        },
                      }))
                    }
                    disabled={formDisabled}
                  >
                    <MenuItem value="SAVINGS">Savings</MenuItem>
                    <MenuItem value="CURRENT">Current</MenuItem>
                    <MenuItem value="CASH">Cash</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default LedgerAccountForm;
