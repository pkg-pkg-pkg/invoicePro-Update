import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
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

import { ledgerAccountService } from '../../services/masters/ledgerAccountService';
import { ledgerReportService, LedgerStatement } from '../../services/reports/ledgerReportService';
import { LedgerAccount } from '../../types/masters';

const formatCurrency = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatBalance = (value: number) => {
  const abs = formatCurrency(Math.abs(value));
  return value >= 0 ? `${abs} Dr` : `${abs} Cr`;
};

const LedgerStatementReport = () => {
  const [ledgerOptions, setLedgerOptions] = useState<LedgerAccount[]>([]);
  const [selectedLedgerId, setSelectedLedgerId] = useState('');
  const [filters, setFilters] = useState({ fromDate: '', toDate: '' });
  const [statement, setStatement] = useState<LedgerStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ledgerAccountService
      .list({ includeInactive: false })
      .then((accounts) => setLedgerOptions(accounts.filter((acct) => acct.isActive !== false)))
      .catch((err) => setError((err as Error).message ?? 'Failed to load ledgers'));
  }, []);

  useEffect(() => {
    const fetchStatement = async () => {
      if (!selectedLedgerId) {
        setStatement(null);
        return;
      }
      try {
        setLoading(true);
        setError(null);
        const payloadFilters = {
          fromDate: filters.fromDate || undefined,
          toDate: filters.toDate || undefined,
        };
        const response = await ledgerReportService.getStatement(selectedLedgerId, payloadFilters);
        setStatement(response);
      } catch (err) {
        setStatement(null);
        setError((err as Error).message ?? 'Failed to load ledger statement');
      } finally {
        setLoading(false);
      }
    };

    void fetchStatement();
  }, [selectedLedgerId, filters]);

  const transactions = useMemo(() => statement?.transactions ?? [], [statement]);

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Ledger Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Select
                displayEmpty
                value={selectedLedgerId}
                onChange={(event) => setSelectedLedgerId(event.target.value)}
                fullWidth
              >
                <MenuItem value="">
                  <em>Select Ledger</em>
                </MenuItem>
                {ledgerOptions.map((ledger) => (
                  <MenuItem key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </MenuItem>
                ))}
              </Select>
            </Grid>
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
          </Grid>
        </CardContent>
      </Card>

      {!selectedLedgerId && (
        <Alert severity="info">Select a ledger to view its statement.</Alert>
      )}

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
};

export default LedgerStatementReport;
