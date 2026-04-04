import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';

import { trialBalanceService, TrialBalanceResult } from '../../services/reports/trialBalanceService';

const formatAmount = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TrialBalanceReport = () => {
  const [filters, setFilters] = useState({ fromDate: '', toDate: '', includeInactive: false });
  const [result, setResult] = useState<TrialBalanceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrialBalance = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await trialBalanceService.getTrialBalance({
          fromDate: filters.fromDate || undefined,
          toDate: filters.toDate || undefined,
          includeInactive: filters.includeInactive,
        });
        setResult(response);
      } catch (err) {
        setResult(null);
        setError((err as Error).message ?? 'Failed to load trial balance');
      } finally {
        setLoading(false);
      }
    };

    void fetchTrialBalance();
  }, [filters]);

  const balanced = useMemo(() => {
    if (!result) return false;
    const debit = Number(result.totalDebit.toFixed(2));
    const credit = Number(result.totalCredit.toFixed(2));
    return debit === credit;
  }, [result]);

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="From Date"
                type="date"
                value={filters.fromDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="To Date"
                type="date"
                value={filters.toDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ height: '100%' }}>
                <Typography variant="body2">Include inactive ledgers</Typography>
                <Switch
                  checked={filters.includeInactive}
                  onChange={(event) => setFilters((prev) => ({ ...prev, includeInactive: event.target.checked }))}
                />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : result ? (
        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={2} mb={2}>
              <Box>
                <Typography variant="h6">Trial Balance</Typography>
                <Typography variant="body2" color="text.secondary">
                  Period: {filters.fromDate || 'Start'} → {filters.toDate || 'Latest'}
                </Typography>
              </Box>
              <Chip color={balanced ? 'success' : 'warning'} label={balanced ? 'Balanced' : 'Out of Balance'} />
            </Stack>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ledger</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.entries.map((entry) => (
                  <TableRow key={entry.ledger.id}>
                    <TableCell>{entry.ledger.name}</TableCell>
                    <TableCell align="right">{formatAmount(entry.debit)}</TableCell>
                    <TableCell align="right">{formatAmount(entry.credit)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>
                    <Typography variant="subtitle2">Totals</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2">{formatAmount(result.totalDebit)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="subtitle2">{formatAmount(result.totalCredit)}</Typography>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No data available. Adjust filters and try again.
        </Typography>
      )}
    </Stack>
  );
};

export default TrialBalanceReport;
