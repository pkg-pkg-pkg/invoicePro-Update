import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
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
import { profitAndLossService, type ProfitAndLossResult } from '../../services/reports/profitAndLossService';

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function LedgerProfitAndLossReport() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [result, setResult] = useState<ProfitAndLossResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        setResult(
          await profitAndLossService.getProfitAndLoss({
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
          })
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [fromDate, toDate]);

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Profit & Loss (Ledger Groups)
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={3}>
          <TextField label="From" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </Grid>
        <Grid item xs={12} md={3}>
          <TextField label="To" type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </Grid>
      </Grid>
      {error ? <Alert severity="error">{error}</Alert> : null}
      {loading ? (
        <Stack alignItems="center" py={4}><CircularProgress /></Stack>
      ) : result ? (
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Income (by group)</Typography>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Group</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                  <TableBody>
                    {result.incomeRows.map((r) => (
                      <TableRow key={r.groupId}><TableCell>{r.groupName}</TableCell><TableCell align="right">{fmt(r.amount)}</TableCell></TableRow>
                    ))}
                    <TableRow><TableCell><strong>Total Income</strong></TableCell><TableCell align="right"><strong>{fmt(result.totalIncome)}</strong></TableCell></TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Expenses (by group)</Typography>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Group</TableCell><TableCell align="right">Amount</TableCell></TableRow></TableHead>
                  <TableBody>
                    {result.expenseRows.map((r) => (
                      <TableRow key={r.groupId}><TableCell>{r.groupName}</TableCell><TableCell align="right">{fmt(r.amount)}</TableCell></TableRow>
                    ))}
                    <TableRow><TableCell><strong>Total Expense</strong></TableCell><TableCell align="right"><strong>{fmt(result.totalExpense)}</strong></TableCell></TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12}>
            <Alert severity={result.netProfit >= 0 ? 'success' : 'warning'}>
              Net {result.netProfit >= 0 ? 'Profit' : 'Loss'}: ₹{fmt(Math.abs(result.netProfit))}
            </Alert>
          </Grid>
        </Grid>
      ) : null}
    </Box>
  );
}
