import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { ledgerAccountService } from '../../services/masters/ledgerAccountService';
import { ledgerGroupService } from '../../services/masters/ledgerGroupService';
import type { LedgerAccount } from '../../types/masters';
import { ledgerTouchesExpenseTree } from '../../utils/expenseLedgerGrouping';

type Row = { ledger: LedgerAccount; groupLabel: string };

export default function ExpenseHeadsSection() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [ledgers, groups] = await Promise.all([
          ledgerAccountService.list({ includeInactive: false }),
          ledgerGroupService.list({ includeInactive: false }),
        ]);
        if (cancelled) return;
        const gMap = new Map(groups.map((g) => [g.id, { type: g.type, parentGroupId: g.parentGroupId }]));
        const nameById = new Map(groups.map((g) => [g.id, g.name]));

        const expenseLedgers = ledgers.filter(
          (l) => !l.isCashBank && ledgerTouchesExpenseTree(l.groupId, gMap)
        );
        const sorted = [...expenseLedgers].sort((a, b) =>
          (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' })
        );

        setRows(
          sorted.map((ledger) => ({
            ledger,
            groupLabel: nameById.get(ledger.groupId) ?? ledger.groupId,
          }))
        );
      } catch (e) {
        console.error('ExpenseHeadsSection load', e);
        setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
          spacing={2}
          mb={2}
        >
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Expense categories (heads)
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
              Heads are <strong>ledger accounts</strong> for kinds of spending — transport, salary, stationery, rent,
              utilities, etc. Add them here first; then use <strong>Payment Vouchers</strong> to record actual payments from cash or bank.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexShrink={0}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() =>
                navigate('/masters/ledger-accounts/new', { state: { preferredGroup: 'grp-direct-expenses' } })
              }
            >
              Add expense head
            </Button>
            <Button variant="outlined" onClick={() => navigate('/masters/ledger-accounts')}>
              All ledgers
            </Button>
          </Stack>
        </Stack>

        {loading ? (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress size={28} />
          </Box>
        ) : rows.length === 0 ? (
          <Alert severity="info">
            No expense heads yet. Click <strong>Add expense head</strong> to create ledgers such as &quot;Transport&quot;,
            &quot;Stationery&quot;, or &quot;Salary&quot; under Direct / Indirect expenses.
          </Alert>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Expense head (ledger)</TableCell>
                <TableCell>Group</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(({ ledger, groupLabel }) => (
                <TableRow key={ledger.id} hover>
                  <TableCell>
                    <Typography fontWeight={600}>{ledger.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {groupLabel}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => navigate(`/masters/ledger-accounts/${ledger.id}/edit`)}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
