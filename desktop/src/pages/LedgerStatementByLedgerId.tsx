import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ledgerReportService, LedgerStatement } from '../services/reports/ledgerReportService';

const VOUCHERS_CHANGED_EVENT = 'pve:vouchers-changed';

const formatCurrency = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatBalance = (value: number) => {
  const abs = formatCurrency(Math.abs(value));
  return value >= 0 ? `${abs} Dr` : `${abs} Cr`;
};

/** Deep-linked ledger statement (e.g. from Party Ledger Report). */
export default function LedgerStatementByLedgerId() {
  const { ledgerId: ledgerIdParam } = useParams<{ ledgerId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const ledgerId = ledgerIdParam ? decodeURIComponent(ledgerIdParam) : '';

  const [filters, setFilters] = useState({
    fromDate: searchParams.get('fromDate') ?? '',
    toDate: searchParams.get('toDate') ?? '',
  });
  const [statement, setStatement] = useState<LedgerStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFilters({
      fromDate: searchParams.get('fromDate') ?? '',
      toDate: searchParams.get('toDate') ?? '',
    });
  }, [searchParams]);

  useEffect(() => {
    const run = async () => {
      if (!ledgerId) {
        setStatement(null);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const res = await ledgerReportService.getStatement(ledgerId, {
          fromDate: filters.fromDate || undefined,
          toDate: filters.toDate || undefined,
        });
        setStatement(res);
      } catch (err) {
        setStatement(null);
        setError((err as Error).message ?? 'Failed to load ledger statement');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [ledgerId, filters.fromDate, filters.toDate]);

  useEffect(() => {
    const refresh = () => {
      if (!ledgerId) return;
      void ledgerReportService
        .getStatement(ledgerId, {
          fromDate: filters.fromDate || undefined,
          toDate: filters.toDate || undefined,
        })
        .then(setStatement)
        .catch(() => undefined);
    };
    window.addEventListener(VOUCHERS_CHANGED_EVENT, refresh);
    window.addEventListener('pve:parties-changed', refresh);
    return () => {
      window.removeEventListener(VOUCHERS_CHANGED_EVENT, refresh);
      window.removeEventListener('pve:parties-changed', refresh);
    };
  }, [ledgerId, filters.fromDate, filters.toDate]);

  const transactions = useMemo(() => statement?.transactions ?? [], [statement]);

  if (!ledgerId) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning">Missing ledger in URL.</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={3} sx={{ p: 2 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={700}>
          Ledger statement
        </Typography>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          Back
        </Button>
      </Stack>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Period
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="From Date"
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters((p) => ({ ...p, fromDate: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="To Date"
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters((p) => ({ ...p, toDate: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : (
        statement && (
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {statement.ledger.name}
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Typography variant="caption" color="text.secondary">
                      Opening Balance
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {formatBalance(statement.openingBalance)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="caption" color="text.secondary">
                      Closing Balance
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {formatBalance(statement.closingBalance)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="caption" color="text.secondary">
                      Total Transactions
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {transactions.length}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <Typography variant="caption" color="text.secondary">
                      Period
                    </Typography>
                    <Typography variant="subtitle1" fontWeight={600}>
                      {filters.fromDate || 'Start'} → {filters.toDate || 'Latest'}
                    </Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Transactions
                </Typography>
                {transactions.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No transactions for selected criteria.
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Date</TableCell>
                        <TableCell>Voucher</TableCell>
                        <TableCell align="right">Debit</TableCell>
                        <TableCell align="right">Credit</TableCell>
                        <TableCell align="right">Running Balance</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell>{new Date(txn.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>
                              {txn.voucherType}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              #{txn.voucherId}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">{formatCurrency(txn.debit)}</TableCell>
                          <TableCell align="right">{formatCurrency(txn.credit)}</TableCell>
                          <TableCell align="right">{formatBalance(txn.runningBalance)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </Stack>
        )
      )}
    </Stack>
  );
}
