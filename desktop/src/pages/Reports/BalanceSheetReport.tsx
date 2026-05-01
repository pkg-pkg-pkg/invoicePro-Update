import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
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
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

import { balanceSheetService, BalanceSheetResult } from '../../services/reports/balanceSheetService';

const formatAmount = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BalanceSheetReport = () => {
  const [filters, setFilters] = useState({
    asOfDate: new Date().toISOString().split('T')[0],
    includeInactive: false,
  });
  const [result, setResult] = useState<BalanceSheetResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalanceSheet = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await balanceSheetService.getBalanceSheet({
          asOfDate: filters.asOfDate || undefined,
          includeInactive: filters.includeInactive,
        });
        setResult(response);
      } catch (err) {
        setResult(null);
        setError((err as Error).message ?? 'Failed to load balance sheet');
      } finally {
        setLoading(false);
      }
    };
    void fetchBalanceSheet();
  }, [filters]);

  const totalsMatched = useMemo(() => {
    if (!result) return false;
    return Number(result.totalAssets.toFixed(2)) === Number(result.totalLiabilities.toFixed(2));
  }, [result]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!result) return;
    const rows: string[] = [];
    rows.push(`Balance Sheet As Of,${result.asOfDate}`);
    rows.push(`Previous FY As Of,${result.previousAsOfDate}`);
    rows.push('');
    rows.push('Section,Group,Ledger,Current Amount,Previous FY Amount');
    result.assets.forEach((row) => {
      rows.push(`Assets,${row.groupName},${row.ledgerName},${row.amount},${row.previousAmount}`);
    });
    result.liabilities.forEach((row) => {
      rows.push(`Liabilities,${row.groupName},${row.ledgerName},${row.amount},${row.previousAmount}`);
    });
    rows.push(`Totals,Assets,,${result.totalAssets},${result.previousTotalAssets}`);
    rows.push(`Totals,Liabilities,,${result.totalLiabilities},${result.previousTotalLiabilities}`);
    const csvContent = rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-sheet-${result.asOfDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Balance Sheet Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="As Of Date"
                type="date"
                value={filters.asOfDate}
                onChange={(event) => setFilters((prev) => ({ ...prev, asOfDate: event.target.value }))}
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
            <Grid item xs={12} md={4}>
              {result && (
                <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} alignItems="center" sx={{ height: '100%' }}>
                  <Chip color={totalsMatched ? 'success' : 'warning'} label={totalsMatched ? 'Balanced' : 'Review Required'} />
                  <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
                    Print / PDF
                  </Button>
                  <Button size="small" variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCsv}>
                    CSV
                  </Button>
                </Stack>
              )}
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
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Assets
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Group</TableCell>
                      <TableCell>Ledger</TableCell>
                      <TableCell align="right">Current</TableCell>
                      <TableCell align="right">Previous FY</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.assets.map((row) => (
                      <TableRow key={row.ledgerId}>
                        <TableCell>{row.groupName}</TableCell>
                        <TableCell>{row.ledgerName}</TableCell>
                        <TableCell align="right">{formatAmount(row.amount)}</TableCell>
                        <TableCell align="right">{formatAmount(row.previousAmount)}</TableCell>
                      </TableRow>
                    ))}
                    {result.assets.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" color="text.secondary">
                            No asset balances for selected date.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Typography variant="subtitle2">Total Assets</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2">{formatAmount(result.totalAssets)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2">{formatAmount(result.previousTotalAssets)}</Typography>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Liabilities & Equity
                </Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Group</TableCell>
                      <TableCell>Ledger</TableCell>
                      <TableCell align="right">Current</TableCell>
                      <TableCell align="right">Previous FY</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.liabilities.map((row) => (
                      <TableRow key={row.ledgerId}>
                        <TableCell>{row.groupName}</TableCell>
                        <TableCell>{row.ledgerName}</TableCell>
                        <TableCell align="right">{formatAmount(row.amount)}</TableCell>
                        <TableCell align="right">{formatAmount(row.previousAmount)}</TableCell>
                      </TableRow>
                    ))}
                    {result.liabilities.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4}>
                          <Typography variant="body2" color="text.secondary">
                            No liabilities for selected date.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={2}>
                        <Typography variant="subtitle2">Total Liabilities</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2">{formatAmount(result.totalLiabilities)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2">{formatAmount(result.previousTotalLiabilities)}</Typography>
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </CardContent>
            </Card>
          </Grid>
          {!totalsMatched && (
            <Grid item xs={12}>
              <Alert severity="warning">
                Assets and Liabilities totals are not matching for this date. Please verify ledger mappings and opening balances.
              </Alert>
            </Grid>
          )}
        </Grid>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No data available. Adjust filters and try again.
        </Typography>
      )}
    </Stack>
  );
};

export default BalanceSheetReport;

