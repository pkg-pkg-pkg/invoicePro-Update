import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AccountTreeIcon from '@mui/icons-material/AccountTree';

import { ledgerGroupService } from '../../../services/masters/ledgerGroupService';
import type { LedgerGroup } from '../../../types/masters';
import { CHART_ROOT_GROUP_IDS } from '../../../constants/chartOfAccounts';

function buildTree(groups: LedgerGroup[]) {
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
  return byParent;
}

function TreeNode({
  group,
  byParent,
  depth,
}: {
  group: LedgerGroup;
  byParent: Map<string | null, LedgerGroup[]>;
  depth: number;
}) {
  const children = byParent.get(group.id) ?? [];
  return (
    <>
      <TableRow>
        <TableCell sx={{ pl: 2 + depth * 2 }}>
          <Typography fontWeight={depth === 0 ? 700 : 500}>{group.name}</Typography>
        </TableCell>
        <TableCell>{group.type}</TableCell>
        <TableCell>
          {group.isSystem ? <Chip size="small" label="System" /> : <Chip size="small" variant="outlined" label="Custom" />}
        </TableCell>
        <TableCell>{group.isActive === false ? 'Inactive' : 'Active'}</TableCell>
      </TableRow>
      {children.map((c) => (
        <TreeNode key={c.id} group={c} byParent={byParent} depth={depth + 1} />
      ))}
    </>
  );
}

export default function ChartOfAccountsPage() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<LedgerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGroups(await ledgerGroupService.list({ includeInactive: true }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const byParent = useMemo(() => buildTree(groups), [groups]);
  const roots = useMemo(() => {
    const r = byParent.get(null) ?? [];
    return r.filter((g) => CHART_ROOT_GROUP_IDS.includes(g.id as (typeof CHART_ROOT_GROUP_IDS)[number]));
  }, [byParent]);

  const filteredRoots = useMemo(() => {
    if (typeFilter === 'ALL') return roots;
    return roots.filter((g) => g.type === typeFilter);
  }, [roots, typeFilter]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <AccountTreeIcon color="primary" />
          <Typography variant="h5" fontWeight={800}>
            Chart of Accounts
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<AssessmentIcon />} onClick={() => navigate('/masters/ledger-audit')}>
            Structure Audit
          </Button>
          <Button variant="outlined" onClick={() => navigate('/masters/accounting-integrity')}>
            Integrity Audit
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void load()}>
            Refresh
          </Button>
          <Button variant="contained" onClick={() => navigate('/masters/ledger-accounts')}>
            Ledger Master
          </Button>
        </Stack>
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Primary groups: Assets, Liabilities, Income, Expenses — with standard sub-groups for debtors, creditors,
            cash, bank, sales, purchase, and expenses.
          </Typography>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Filter by type</InputLabel>
            <Select label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              <MenuItem value="ALL">All types</MenuItem>
              <MenuItem value="ASSET">Assets</MenuItem>
              <MenuItem value="LIABILITY">Liabilities</MenuItem>
              <MenuItem value="INCOME">Income</MenuItem>
              <MenuItem value="EXPENSE">Expenses</MenuItem>
            </Select>
          </FormControl>
        </CardContent>
      </Card>

      {loading ? (
        <Stack alignItems="center" py={4}>
          <CircularProgress />
        </Stack>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Group</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Origin</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredRoots.map((root) => (
              <TreeNode key={root.id} group={root} byParent={byParent} depth={0} />
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
