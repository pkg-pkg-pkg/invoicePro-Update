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
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
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
    accountType?: 'SAVINGS' | 'CURRENT' | null;
  } | null;
}

type LedgerBookKind = 'none' | 'cash' | 'bank';

const GROUP_CASH_IN_HAND = 'grp-cash-in-hand';
const GROUP_BANK_ACCOUNTS = 'grp-bank-accounts';

const emptyBankDetails = (): NonNullable<LedgerAccountInput['bankDetails']> => ({
  accountNumber: '',
  ifscCode: '',
  bankName: '',
  branchName: '',
  accountType: 'CURRENT',
});

function inferLedgerBookKind(entity: LedgerAccount): LedgerBookKind {
  if (!entity.isCashBank) return 'none';
  const b = entity.bankDetails;
  const hasBankCredentials =
    Boolean(b?.accountNumber?.trim()) ||
    Boolean(b?.ifscCode?.trim()) ||
    Boolean(b?.bankName?.trim());
  if (hasBankCredentials) return 'bank';
  if (entity.groupId === GROUP_BANK_ACCOUNTS) return 'bank';
  return 'cash';
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
  const appliedBankNavDefaults = useRef(false);
  const [ledgerBookKind, setLedgerBookKind] = useState<LedgerBookKind>('none');

  useEffect(() => {
    if (isEditMode || appliedBankNavDefaults.current) return;
    if (location.state && (location.state as { isCashBank?: boolean }).isCashBank) {
      appliedBankNavDefaults.current = true;
      setLedgerBookKind('bank');
      setFormState((prev) => ({
        ...prev,
        isCashBank: true,
        groupId: GROUP_BANK_ACCOUNTS,
        bankDetails: prev.bankDetails ?? emptyBankDetails(),
      }));
    }
  }, [isEditMode, location.state]);

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
    bankDetails: null,
  });

  useEffect(() => {
    if (entity && isEditMode && !formInitialized.current) {
      formInitialized.current = true;
      setLedgerBookKind(inferLedgerBookKind(entity));
      setFormState({
        name: entity.name,
        code: entity.code ?? '',
        groupId: entity.groupId,
        openingBalance: entity.openingBalance,
        openingBalanceType: entity.openingBalanceType,
        isCashBank: Boolean(entity.isCashBank),
        bankDetails: entity.bankDetails
          ? {
              ...emptyBankDetails(),
              ...entity.bankDetails,
              accountType:
                entity.bankDetails.accountType === 'SAVINGS' || entity.bankDetails.accountType === 'CURRENT'
                  ? entity.bankDetails.accountType
                  : 'CURRENT',
            }
          : emptyBankDetails(),
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

  const handleLedgerBookKindChange = (_: unknown, next: LedgerBookKind | null) => {
    if (!next) return;
    setLedgerBookKind(next);
    if (next === 'none') {
      setFormState((prev) => ({
        ...prev,
        isCashBank: false,
        bankDetails: null,
      }));
      return;
    }
    if (next === 'cash') {
      setFormState((prev) => ({
        ...prev,
        isCashBank: true,
        groupId: GROUP_CASH_IN_HAND,
        bankDetails: null,
      }));
      return;
    }
    setFormState((prev) => ({
      ...prev,
      isCashBank: true,
      groupId: prev.groupId === GROUP_CASH_IN_HAND ? GROUP_BANK_ACCOUNTS : prev.groupId || GROUP_BANK_ACCOUNTS,
      bankDetails: prev.bankDetails ?? emptyBankDetails(),
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    resetError();
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
    if (ledgerBookKind === 'cash' && formState.groupId !== GROUP_CASH_IN_HAND && formState.groupId !== 'grp-cash-bank') {
      setSubmitError('Cash book ledgers should be under Cash-in-Hand (or Cash & Bank). Change group, or switch to Normal / Bank.');
      return;
    }
    if (ledgerBookKind === 'bank') {
      const acctNo = String(formState.bankDetails?.accountNumber ?? '').trim();
      const ifsc = String(formState.bankDetails?.ifscCode ?? '').trim();
      if (!acctNo || !ifsc) {
        setSubmitError('Bank ledgers require account number and IFSC. Cash ledgers do not use these fields — pick “Cash book” instead.');
        return;
      }
      if (ifsc.length !== 11) {
        setSubmitError('IFSC must be 11 characters.');
        return;
      }
    }
    const isCashBank = ledgerBookKind !== 'none';
    const bankDetails =
      ledgerBookKind === 'bank'
        ? {
            accountNumber: String(formState.bankDetails?.accountNumber ?? '').trim() || null,
            ifscCode: String(formState.bankDetails?.ifscCode ?? '').trim().toUpperCase() || null,
            bankName: String(formState.bankDetails?.bankName ?? '').trim() || null,
            branchName: String(formState.bankDetails?.branchName ?? '').trim() || null,
            accountType: (formState.bankDetails?.accountType === 'SAVINGS' ? 'SAVINGS' : 'CURRENT') as 'SAVINGS' | 'CURRENT',
          }
        : null;

    const payload: LedgerAccountInput = {
      ...formState,
      isCashBank,
      bankDetails,
    };

    try {
      setSubmitError(null);
      if (isEditMode && id) {
        await update(id, {
          ...payload,
          openingBalance: entity?.openingBalance ?? formState.openingBalance,
        });
      } else {
        await create(payload);
      }
      navigate('/masters/ledger-accounts');
    } catch {
      // useMasterForm already sets `error` for create/update failures — avoid duplicate banners.
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
          {!isEditMode && ledgerBookKind === 'cash' && formState.name.trim().toLowerCase() === 'cash' && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              A default <strong>Cash</strong> ledger is often already in the list (under Cash-in-Hand). If Create fails, search for
              &quot;Cash&quot; in Ledger Accounts or use another name (e.g. Counter Cash).
            </Alert>
          )}

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
            <Box sx={{ flex: 1, minWidth: 220 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                Cash / Bank
              </Typography>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={ledgerBookKind}
                onChange={handleLedgerBookKindChange}
                disabled={formDisabled}
                color="primary"
              >
                <ToggleButton value="none">Normal</ToggleButton>
                <ToggleButton value="cash">Cash book</ToggleButton>
                <ToggleButton value="bank">Bank</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                Cash book: no IFSC / account number. Bank: enter branch details (multiple bank accounts supported).
              </Typography>
            </Box>
          </Stack>

          {ledgerBookKind === 'bank' && (
            <>
              <Divider>Bank account details</Divider>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3}>
                <TextField
                  label="Account Number"
                  value={formState.bankDetails?.accountNumber ?? ''}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      bankDetails: { ...(prev.bankDetails ?? emptyBankDetails()), accountNumber: e.target.value },
                    }))
                  }
                  fullWidth
                  required
                  disabled={formDisabled}
                />
                <TextField
                  label="IFSC Code"
                  value={formState.bankDetails?.ifscCode ?? ''}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      bankDetails: { ...(prev.bankDetails ?? emptyBankDetails()), ifscCode: e.target.value.toUpperCase() },
                    }))
                  }
                  fullWidth
                  required
                  inputProps={{ maxLength: 11 }}
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
                      bankDetails: { ...(prev.bankDetails ?? emptyBankDetails()), bankName: e.target.value },
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
                          ...(prev.bankDetails ?? emptyBankDetails()),
                          accountType: e.target.value as 'SAVINGS' | 'CURRENT',
                        },
                      }))
                    }
                    disabled={formDisabled}
                  >
                    <MenuItem value="SAVINGS">Savings</MenuItem>
                    <MenuItem value="CURRENT">Current</MenuItem>
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
