import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RestoreIcon from '@mui/icons-material/Restore';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import ViewListIcon from '@mui/icons-material/ViewList';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';

import { ledgerAccountService } from '../../services/masters/ledgerAccountService';
import { ledgerGroupService } from '../../services/masters/ledgerGroupService';
import { ledgerClassificationService } from '../../services/masters/ledgerClassificationService';
import { SYSTEM_LEDGER_IDS } from '../../constants/chartOfAccounts';
import type { LedgerAccount, LedgerGroup, LedgerGroupType } from '../../types/masters';
import { useMasterList } from '../../hooks/useMasterList';
import { usePermission } from '../../hooks/usePermission';
import {
  buildGroupPath,
  descendantGroupIds,
  groupMatchesTypeFilter,
  rootTypeLabel,
} from '../../utils/ledgerGroupPath';

type ViewMode = 'table' | 'tree';

type TreeRow = {
  id: string;
  kind: 'group' | 'ledger';
  name: string;
  depth: number;
  groupId?: string;
  ledger?: LedgerAccount;
  group?: LedgerGroup;
};

export type AllLedgersPanelProps = {
  /** Hide outer title row when embedded in Ledgers module tabs */
  embedded?: boolean;
};

export function AllLedgersPanel({ embedded = false }: AllLedgersPanelProps) {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | LedgerGroupType>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [mismatchMap, setMismatchMap] = useState<Map<string, boolean>>(new Map());
  const [mergeSource, setMergeSource] = useState<LedgerAccount | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState('');

  const fetchAccounts = useCallback(() => ledgerAccountService.list({ includeInactive: true }), []);
  const { data: accounts, loading, error, refresh } = useMasterList(fetchAccounts);

  useEffect(() => {
    ledgerGroupService.list({ includeInactive: true }).then(setGroups).catch(() => setGroups([]));
    ledgerClassificationService
      .runAudit()
      .then((audit) => setMismatchMap(new Map(audit.rows.map((r) => [r.ledgerId, r.mismatch]))))
      .catch(() => setMismatchMap(new Map()));
  }, [accounts.length]);

  const groupNameMap = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);

  const subGroupsForType = useMemo(() => {
    return groups
      .filter((g) => typeFilter === 'ALL' || groupMatchesTypeFilter(g.id, typeFilter, groups))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groups, typeFilter]);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const groupSet = groupFilter === 'all' ? null : descendantGroupIds(groupFilter, groups);

    return accounts.filter((acct) => {
      if (statusFilter === 'ACTIVE' && acct.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && acct.isActive !== false) return false;
      if (typeFilter !== 'ALL' && !groupMatchesTypeFilter(acct.groupId, typeFilter, groups)) return false;
      if (groupSet && !groupSet.has(acct.groupId)) return false;
      if (!q) return true;
      const path = buildGroupPath(acct.groupId, groups).toLowerCase();
      return `${acct.name} ${acct.code ?? ''} ${path}`.toLowerCase().includes(q);
    });
  }, [accounts, search, statusFilter, typeFilter, groupFilter, groups]);

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }),
    []
  );

  const renderOpeningBalance = (amount: number, type: 'DEBIT' | 'CREDIT') =>
    `${currencyFormatter.format(amount)} ${type === 'DEBIT' ? 'Dr' : 'Cr'}`;

  const renderCurrentBalance = (amount: number) => {
    const abs = currencyFormatter.format(Math.abs(amount ?? 0));
    return amount >= 0 ? `${abs} Dr` : `${abs} Cr`;
  };

  const treeRows = useMemo((): TreeRow[] => {
    if (viewMode !== 'tree') return [];
    const byParent = new Map<string | null, LedgerGroup[]>();
    for (const g of groups) {
      const key = g.parentGroupId ?? null;
      const list = byParent.get(key) ?? [];
      list.push(g);
      byParent.set(key, list);
    }
    for (const list of byParent.values()) {
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name));
    }

    const acctsByGroup = new Map<string, LedgerAccount[]>();
    for (const acct of filteredAccounts) {
      const list = acctsByGroup.get(acct.groupId) ?? [];
      list.push(acct);
      acctsByGroup.set(acct.groupId, list);
    }
    for (const list of acctsByGroup.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const rows: TreeRow[] = [];
    const walkGroup = (group: LedgerGroup, depth: number) => {
      if (typeFilter !== 'ALL' && !groupMatchesTypeFilter(group.id, typeFilter, groups)) {
        const childGroups = byParent.get(group.id) ?? [];
        childGroups.forEach((c) => walkGroup(c, depth));
        return;
      }
      if (groupFilter !== 'all') {
        const allowed = descendantGroupIds(groupFilter, groups);
        if (allowed && !allowed.has(group.id)) {
          const childGroups = byParent.get(group.id) ?? [];
          childGroups.forEach((c) => walkGroup(c, depth));
          return;
        }
      }
      rows.push({ id: `g-${group.id}`, kind: 'group', name: group.name, depth, groupId: group.id, group });
      for (const acct of acctsByGroup.get(group.id) ?? []) {
        rows.push({ id: acct.id, kind: 'ledger', name: acct.name, depth: depth + 1, ledger: acct, groupId: group.id });
      }
      for (const child of byParent.get(group.id) ?? []) {
        walkGroup(child, depth + 1);
      }
    };

    const roots = byParent.get(null) ?? [];
    roots.forEach((g) => walkGroup(g, 0));
    return rows;
  }, [viewMode, groups, filteredAccounts, typeFilter, groupFilter]);

  const handleSoftDelete = async (id: string) => {
    try {
      await ledgerAccountService.softDelete(id);
      setActionMessage('Ledger deactivated');
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await ledgerAccountService.restore(id);
      setActionMessage('Ledger reactivated');
      await refresh();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTargetId) return;
    try {
      await ledgerClassificationService.mergeLedgers(mergeSource.id, mergeTargetId);
      setActionMessage(`Merged "${mergeSource.name}" into target ledger`);
      setMergeSource(null);
      setMergeTargetId('');
      await refresh();
    } catch (err) {
      setActionError((err as Error).message);
    }
  };

  const openStatement = (ledgerId: string) => {
    navigate(`/ledgers/report?ledgerId=${encodeURIComponent(ledgerId)}`);
  };

  const renderActions = (account: LedgerAccount) => (
    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
      <Tooltip title="Ledger Statement">
        <IconButton size="small" onClick={() => openStatement(account.id)}>
          <VisibilityIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Edit">
        <span>
          <IconButton
            size="small"
            onClick={() => navigate(`/masters/ledger-accounts/${account.id}/edit`)}
            disabled={!can('manage-ledgers')}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      {account.isActive === false ? (
        <Tooltip title="Enable">
          <span>
            <IconButton size="small" onClick={() => void handleRestore(account.id)} disabled={!can('manage-ledgers')}>
              <RestoreIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      ) : (
        <>
          <Tooltip title="Merge">
            <span>
              <IconButton size="small" onClick={() => setMergeSource(account)} disabled={!can('manage-ledgers')}>
                <MergeTypeIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Disable">
            <span>
              <IconButton size="small" onClick={() => void handleSoftDelete(account.id)} disabled={!can('manage-ledgers')}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
    </Stack>
  );

  const renderClassificationBadge = (groupId: string) => {
    const path = buildGroupPath(groupId, groups);
    const root = rootTypeLabel(groupId, groups);
    return (
      <Chip
        size="small"
        variant="outlined"
        label={path || root || groupNameMap.get(groupId) || '—'}
        sx={{ maxWidth: 280, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
      />
    );
  };

  const canView = can('view-ledgers');
  if (!canView) {
    return <Alert severity="warning">You do not have permission to view ledgers.</Alert>;
  }

  return (
    <Stack spacing={2}>
      {!embedded ? (
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h5" fontWeight={700}>
            All Ledgers
          </Typography>
          <Stack direction="row" spacing={1}>
            <IconButton onClick={() => void refresh()}><RefreshIcon /></IconButton>
            {can('manage-ledgers') ? (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/masters/ledger-accounts/new')}>
                New Ledger
              </Button>
            ) : null}
          </Stack>
        </Stack>
      ) : null}

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <TextField
                label="Search ledgers"
                placeholder="Name, code, or group…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
                size="small"
              />
              <ToggleButtonGroup
                size="small"
                exclusive
                value={viewMode}
                onChange={(_, v) => v && setViewMode(v)}
              >
                <ToggleButton value="table"><ViewListIcon fontSize="small" sx={{ mr: 0.5 }} /> Table</ToggleButton>
                <ToggleButton value="tree"><AccountTreeIcon fontSize="small" sx={{ mr: 0.5 }} /> Tree</ToggleButton>
              </ToggleButtonGroup>
              {embedded ? (
                <IconButton onClick={() => void refresh()}><RefreshIcon /></IconButton>
              ) : null}
            </Stack>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Primary Group</InputLabel>
                <Select
                  label="Primary Group"
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value as typeof typeFilter);
                    setGroupFilter('all');
                  }}
                >
                  <MenuItem value="ALL">All types</MenuItem>
                  <MenuItem value="ASSET">Assets</MenuItem>
                  <MenuItem value="LIABILITY">Liabilities</MenuItem>
                  <MenuItem value="INCOME">Income</MenuItem>
                  <MenuItem value="EXPENSE">Expenses</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Sub-group</InputLabel>
                <Select label="Sub-group" value={groupFilter} onChange={(e: SelectChangeEvent) => setGroupFilter(e.target.value)}>
                  <MenuItem value="all">All sub-groups</MenuItem>
                  {subGroupsForType.map((g) => (
                    <MenuItem key={g.id} value={g.id}>{g.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select label="Status" value={statusFilter} onChange={(e: SelectChangeEvent) => setStatusFilter(e.target.value as typeof statusFilter)}>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                  <MenuItem value="ALL">All</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              {filteredAccounts.length} ledger(s) — customers, suppliers, banks, cash, sales, purchase, GST, expenses, income, capital, loans, and more.
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {actionMessage ? <Alert severity="success">{actionMessage}</Alert> : null}
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}
      {error ? <Alert severity="error">{error.message}</Alert> : null}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={6}><CircularProgress /></Box>
          ) : viewMode === 'tree' ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Classification</TableCell>
                  <TableCell align="right">Current Balance</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {treeRows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} align="center">No ledgers match filters</TableCell></TableRow>
                ) : (
                  treeRows.map((row) =>
                    row.kind === 'group' ? (
                      <TableRow key={row.id} sx={{ bgcolor: 'action.hover' }}>
                        <TableCell sx={{ pl: 2 + row.depth * 2 }}>
                          <Typography fontWeight={700}>{row.name}</Typography>
                        </TableCell>
                        <TableCell>{row.group?.type ?? '—'}</TableCell>
                        <TableCell />
                        <TableCell />
                      </TableRow>
                    ) : (
                      <TableRow key={row.id} hover>
                        <TableCell sx={{ pl: 2 + row.depth * 2 }}>{row.name}</TableCell>
                        <TableCell>{row.ledger ? renderClassificationBadge(row.ledger.groupId) : null}</TableCell>
                        <TableCell align="right">{row.ledger ? renderCurrentBalance(row.ledger.currentBalance ?? 0) : '—'}</TableCell>
                        <TableCell align="right">{row.ledger ? renderActions(row.ledger) : null}</TableCell>
                      </TableRow>
                    )
                  )
                )}
              </TableBody>
            </Table>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ledger Name</TableCell>
                  <TableCell>Classification</TableCell>
                  <TableCell align="right">Opening Balance</TableCell>
                  <TableCell align="right">Current Balance</TableCell>
                  <TableCell>Auto Created</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredAccounts.length === 0 ? (
                  <TableRow><TableCell colSpan={7} align="center">No ledger accounts found</TableCell></TableRow>
                ) : (
                  filteredAccounts.map((account) => (
                    <TableRow key={account.id} hover>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <span>{account.name}</span>
                          {mismatchMap.get(account.id) ? <Chip size="small" color="warning" label="Misclassified" /> : null}
                        </Stack>
                      </TableCell>
                      <TableCell>{renderClassificationBadge(account.groupId)}</TableCell>
                      <TableCell align="right">{renderOpeningBalance(account.openingBalance ?? 0, account.openingBalanceType)}</TableCell>
                      <TableCell align="right">{renderCurrentBalance(account.currentBalance ?? 0)}</TableCell>
                      <TableCell>{SYSTEM_LEDGER_IDS.has(account.id) ? 'Yes' : 'No'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={account.isActive === false ? 'No' : 'Yes'} color={account.isActive === false ? 'default' : 'success'} />
                      </TableCell>
                      <TableCell align="right">{renderActions(account)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(mergeSource)} onClose={() => setMergeSource(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Merge Ledger</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Merge &quot;{mergeSource?.name}&quot; into another ledger, then disable the source.
          </Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Target ledger</InputLabel>
            <Select label="Target ledger" value={mergeTargetId} onChange={(e) => setMergeTargetId(e.target.value)}>
              {accounts.filter((a) => a.id !== mergeSource?.id && a.isActive !== false).map((a) => (
                <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMergeSource(null)}>Cancel</Button>
          <Button variant="contained" disabled={!mergeTargetId} onClick={() => void handleMerge()}>Merge</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
