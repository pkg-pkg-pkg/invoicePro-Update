import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RestoreIcon from '@mui/icons-material/Restore';
import RefreshIcon from '@mui/icons-material/Refresh';

import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { ledgerGroupService } from '../../../services/masters/ledgerGroupService';
import { LedgerAccount, LedgerGroup } from '../../../types/masters';
import { useMasterList } from '../../../hooks/useMasterList';
import { usePermission } from '../../../hooks/usePermission';
import { useEffect } from 'react';

type LedgerRole = 'Customer' | 'Supplier' | 'Sales' | 'Purchase' | 'GST' | 'Cash' | 'Bank' | 'Overdraft';

const LEDGER_ROLE_ROOTS: Record<LedgerRole, string[]> = {
  Customer: ['grp-sundry-debtors'],
  Supplier: ['grp-sundry-creditors'],
  Sales: ['grp-sales-accounts', 'grp-service-income'],
  Purchase: ['grp-purchase-accounts'],
  GST: ['grp-duties-taxes'],
  Cash: ['grp-cash-in-hand'],
  Bank: ['grp-bank-accounts'],
  Overdraft: ['grp-bank-overdraft'],
};

const ROLE_COLOR_MAP: Record<LedgerRole, 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'default'> = {
  Customer: 'primary',
  Supplier: 'secondary',
  Sales: 'success',
  Purchase: 'warning',
  GST: 'info',
  Cash: 'success',
  Bank: 'info',
  Overdraft: 'warning',
};

/** Auto / Tally-style “Cash & Bank” subgroup: show Bank vs Cash from stored bank fields. */
const GROUP_CASH_BANK = 'grp-cash-bank';

function displayRoleForLedger(account: LedgerAccount, groupRole: LedgerRole | null): LedgerRole | null {
  if (account.groupId === GROUP_CASH_BANK) {
    const b = account.bankDetails;
    const hasBank =
      Boolean(b?.accountNumber?.trim()) ||
      Boolean(b?.ifscCode?.trim()) ||
      Boolean(b?.bankName?.trim());
    return hasBank ? 'Bank' : 'Cash';
  }
  return groupRole;
}

const LedgerAccountList = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [balanceTypeFilter, setBalanceTypeFilter] = useState<'ALL' | 'DEBIT' | 'CREDIT'>('ALL');
  const [zeroBalanceOnly, setZeroBalanceOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const fetchAccounts = useCallback(() => ledgerAccountService.list({ includeInactive: true }), []);
  const { data: accounts, loading, error, refresh } = useMasterList(fetchAccounts);

  useEffect(() => {
    ledgerGroupService.list({ includeInactive: true }).then(setGroups).catch(() => {
      setGroups([]);
    });
  }, []);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((acct) => {
      if (statusFilter === 'ACTIVE' && acct.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && acct.isActive !== false) return false;
      if (groupFilter !== 'all' && acct.groupId !== groupFilter) return false;
      if (balanceTypeFilter !== 'ALL' && acct.openingBalanceType !== balanceTypeFilter) return false;
      if (zeroBalanceOnly && (acct.openingBalance ?? 0) !== 0) return false;
      if (!q) return true;
      const haystack = `${acct.name} ${acct.code ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [accounts, search, statusFilter, groupFilter, balanceTypeFilter, zeroBalanceOnly]);

  const groupNameMap = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((group) => map.set(group.id, group.name));
    return map;
  }, [groups]);

  const groupRoleMap = useMemo(() => {
    const groupById = new Map<string, LedgerGroup>();
    groups.forEach((group) => groupById.set(group.id, group));

    const baseRoleByGroupId = new Map<string, LedgerRole>();
    (Object.entries(LEDGER_ROLE_ROOTS) as [LedgerRole, string[]][]).forEach(([role, ids]) => {
      ids.forEach((id) => baseRoleByGroupId.set(id, role));
    });

    const cache = new Map<string, LedgerRole | null>();
    const resolveRole = (groupId: string | null | undefined): LedgerRole | null => {
      if (!groupId) return null;
      if (cache.has(groupId)) return cache.get(groupId)!;
      if (baseRoleByGroupId.has(groupId)) {
        const role = baseRoleByGroupId.get(groupId)!;
        cache.set(groupId, role);
        return role;
      }
      const parentId = groupById.get(groupId)?.parentGroupId ?? null;
      const role = resolveRole(parentId);
      cache.set(groupId, role);
      return role;
    };

    const roleMap = new Map<string, LedgerRole | null>();
    groups.forEach((group) => {
      roleMap.set(group.id, resolveRole(group.id));
    });
    return roleMap;
  }, [groups]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
      }),
    []
  );

  const renderOpeningBalance = (amount: number, type: 'DEBIT' | 'CREDIT') => {
    const suffix = type === 'DEBIT' ? 'Dr' : 'Cr';
    return `${currencyFormatter.format(amount)} ${suffix}`;
  };

  const handleSoftDelete = async (id: string) => {
    try {
      await ledgerAccountService.softDelete(id);
      setActionMessage('Ledger account deactivated');
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError((err as Error).message || 'Failed to deactivate ledger account');
      setActionMessage(null);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await ledgerAccountService.restore(id);
      setActionMessage('Ledger account reactivated');
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError((err as Error).message || 'Failed to restore ledger account');
      setActionMessage(null);
    }
  };

  const handleRefresh = async () => {
    setActionMessage(null);
    setActionError(null);
    await refresh();
  };

  const canManage = can('manage-ledgers');
  const canView = can('view-ledgers');

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
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h5" fontWeight={600}>
          Ledger Accounts
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Button variant="contained" onClick={() => navigate('/masters/ledger-accounts/new')}>
              New Ledger Account
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Search"
              placeholder="Search by name or code"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              fullWidth
            />
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel id="ledger-filter-group-label">Group</InputLabel>
                <Select
                  labelId="ledger-filter-group-label"
                  label="Group"
                  value={groupFilter}
                  onChange={(event: SelectChangeEvent) => setGroupFilter(event.target.value)}
                >
                  <MenuItem value="all">
                    <em>All groups</em>
                  </MenuItem>
                  {groups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="ledger-filter-balance-type-label">Balance Type</InputLabel>
                <Select
                  labelId="ledger-filter-balance-type-label"
                  label="Balance Type"
                  value={balanceTypeFilter}
                  onChange={(event: SelectChangeEvent<'ALL' | 'DEBIT' | 'CREDIT'>) =>
                    setBalanceTypeFilter(event.target.value as 'ALL' | 'DEBIT' | 'CREDIT')
                  }
                >
                  <MenuItem value="ALL">
                    <em>All</em>
                  </MenuItem>
                  <MenuItem value="DEBIT">Debit (Dr)</MenuItem>
                  <MenuItem value="CREDIT">Credit (Cr)</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel id="ledger-filter-status-label">Status</InputLabel>
                <Select
                  labelId="ledger-filter-status-label"
                  label="Status"
                  value={statusFilter}
                  onChange={(event: SelectChangeEvent<'ALL' | 'ACTIVE' | 'INACTIVE'>) =>
                    setStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')
                  }
                >
                  <MenuItem value="ACTIVE">Active only</MenuItem>
                  <MenuItem value="INACTIVE">Inactive only</MenuItem>
                  <MenuItem value="ALL">
                    <em>All</em>
                  </MenuItem>
                </Select>
              </FormControl>
              <FormControlLabel
                control={<Checkbox checked={zeroBalanceOnly} onChange={(_, checked) => setZeroBalanceOnly(checked)} />}
                label="Zero balance only"
                sx={{ flexShrink: 0 }}
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {actionMessage && <Alert severity="success">{actionMessage}</Alert>}
      {actionError && <Alert severity="error">{actionError}</Alert>}
      {error && <Alert severity="error">{error.message}</Alert>}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={6}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Group</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell align="right">Opening Balance</TableCell>
                  <TableCell align="right">Current Balance</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No ledger accounts found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAccounts.map((account) => {
                    const role = displayRoleForLedger(account, groupRoleMap.get(account.groupId ?? '') ?? null);
                    return (
                      <TableRow key={account.id} hover>
                        <TableCell>{account.name}</TableCell>
                        <TableCell>{account.code ?? '—'}</TableCell>
                        <TableCell>{groupNameMap.get(account.groupId) ?? '—'}</TableCell>
                        <TableCell>
                          {role ? (
                            <Chip size="small" label={role} color={ROLE_COLOR_MAP[role]} variant="outlined" />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell align="right">{renderOpeningBalance(account.openingBalance ?? 0, account.openingBalanceType)}</TableCell>
                        <TableCell align="right">
                          {currencyFormatter.format(account.currentBalance ?? 0)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={account.isActive === false ? 'Inactive' : 'Active'}
                            color={account.isActive === false ? 'default' : 'success'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={1} justifyContent="flex-end">
                            <Tooltip title="Edit">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => navigate(`/masters/ledger-accounts/${account.id}/edit`)}
                                  disabled={!canManage}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            {account.isActive === false ? (
                              <Tooltip title="Restore">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleRestore(account.id)}
                                    disabled={!canManage}
                                  >
                                    <RestoreIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : (
                              <Tooltip title="Deactivate">
                                <span>
                                  <IconButton
                                    size="small"
                                    onClick={() => handleSoftDelete(account.id)}
                                    disabled={!canManage}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
};

export default LedgerAccountList;
