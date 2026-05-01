import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import { createExpense, createExpenseHead, fetchExpenseHeads, fetchExpenses } from '../../store/slices/expenseSlice';
import { formatCurrency } from '../../utils/formatters';
import { usePermissions } from '../../hooks/usePermissions';

const DEFAULT_EXPENSE_HEADS = [
  { name: 'Transport', kind: 'direct' as const, description: 'Travel, loading, delivery and freight related expenses' },
  { name: 'Salary', kind: 'direct' as const, description: 'Staff salary and wages' },
  { name: 'Fuel', kind: 'direct' as const, description: 'Fuel and vehicle running costs' },
  { name: 'Packing Charges', kind: 'direct' as const, description: 'Packing and handling costs' },
  { name: 'Loading/Unloading', kind: 'direct' as const, description: 'Loading and unloading labour expenses' },
  { name: 'Rent', kind: 'indirect' as const, description: 'Office, shop or warehouse rent' },
  { name: 'Electricity', kind: 'indirect' as const, description: 'Electricity and utilities bills' },
  { name: 'Stationery', kind: 'indirect' as const, description: 'Office stationery and printing expenses' },
  { name: 'Repairs & Maintenance', kind: 'indirect' as const, description: 'Routine repairs and maintenance' },
  { name: 'Internet & Phone', kind: 'indirect' as const, description: 'Mobile, broadband and communication bills' },
  { name: 'Office Admin', kind: 'indirect' as const, description: 'General office/admin expenses' },
];

export default function ManualExpenseEntry() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { expenseHeads, expenses, loading, error } = useSelector((s: RootState) => s.expenses);
  const { user } = useSelector((s: RootState) => s.auth);
  const { isAdmin } = usePermissions();

  const [form, setForm] = useState({
    expenseClass: 'direct' as 'direct' | 'indirect',
    manualClassOverride: false,
    expenseHeadId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'cash' as 'cash' | 'bank' | 'cheque' | 'upi' | 'card',
  });
  const [success, setSuccess] = useState('');
  const [seedingHeads, setSeedingHeads] = useState(false);

  useEffect(() => {
    dispatch(fetchExpenseHeads());
    dispatch(fetchExpenses({}));
  }, [dispatch]);

  useEffect(() => {
    if (seedingHeads) return;
    let cancelled = false;
    setSeedingHeads(true);
    void (async () => {
      try {
        const existingNames = new Set(
          expenseHeads
            .map((h) => String(h.name || '').trim().toLowerCase())
            .filter(Boolean)
        );
        const missingDefaults = DEFAULT_EXPENSE_HEADS.filter(
          (h) => !existingNames.has(h.name.trim().toLowerCase())
        );
        if (missingDefaults.length === 0) return;
        for (const head of missingDefaults) {
          // eslint-disable-next-line no-await-in-loop
          await dispatch(createExpenseHead(head)).unwrap();
        }
        if (!cancelled) {
          await dispatch(fetchExpenseHeads()).unwrap();
        }
      } catch {
        // ignore seeding errors; user can still add manually
      } finally {
        if (!cancelled) setSeedingHeads(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, expenseHeads, seedingHeads]);

  const heads = useMemo(() => {
    const active = expenseHeads.filter((h) => h.isActive);
    const seen = new Set<string>();
    const uniq = [] as typeof active;
    for (const h of active) {
      const k = String(h.name || '').trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      uniq.push(h);
    }
    return uniq;
  }, [expenseHeads]);
  const defaultClassByHeadName = useMemo(() => {
    const map = new Map<string, 'direct' | 'indirect'>();
    DEFAULT_EXPENSE_HEADS.forEach((h) => map.set(h.name.trim().toLowerCase(), h.kind));
    return map;
  }, []);
  const selectedHead = useMemo(() => heads.find((h) => h.id === form.expenseHeadId) || null, [heads, form.expenseHeadId]);

  useEffect(() => {
    if (!selectedHead) return;
    if (form.manualClassOverride && isAdmin) return;
    const nameKey = String(selectedHead.name || '').trim().toLowerCase();
    const fromDefaults = defaultClassByHeadName.get(nameKey);
    const fromHeadKind = String((selectedHead as any)?.kind || '').toLowerCase();
    const derivedClass: 'direct' | 'indirect' =
      fromDefaults ||
      (fromHeadKind === 'indirect' ? 'indirect' : 'direct');
    if (derivedClass !== form.expenseClass) {
      setForm((p) => ({ ...p, expenseClass: derivedClass }));
    }
  }, [selectedHead, form.manualClassOverride, isAdmin, form.expenseClass, defaultClassByHeadName]);

  const classHeadNames = useMemo(() => {
    return new Set(
      DEFAULT_EXPENSE_HEADS.filter((h) => h.kind === form.expenseClass).map((h) => h.name.trim().toLowerCase())
    );
  }, [form.expenseClass]);
  const headsForClass = useMemo(() => {
    if (isAdmin && form.manualClassOverride) {
      return heads.filter((h) => classHeadNames.has(String(h.name || '').trim().toLowerCase()));
    }
    return heads;
  }, [heads, classHeadNames, form.manualClassOverride, isAdmin]);

  const totalsByHead = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((e) => map.set(e.expenseHeadId, (map.get(e.expenseHeadId) ?? 0) + Number(e.amount || 0)));
    return map;
  }, [expenses]);

  const thisMonthExpense = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((e) => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  }, [expenses]);

  const handleSave = async () => {
    setSuccess('');
    const amount = Number(form.amount);
    if (!form.expenseHeadId) return;
    if (!Number.isFinite(amount) || amount <= 0) return;

    const head = heads.find((h) => h.id === form.expenseHeadId);
    if (!head) return;
    const classTag = form.expenseClass === 'direct' ? '[DIRECT]' : '[INDIRECT]';

    await dispatch(
      createExpense({
        expenseHeadId: head.id,
        expenseHeadName: head.name,
        expenseHeadLedgerId: head.ledgerId || null,
        amount,
        description: form.description.trim() || `${head.name} expense`,
        date: form.date,
        paymentMode: form.paymentMode,
        notes: `[AUTO_LEDGER_POST] ${classTag} ${form.description.trim()}`.trim(),
        createdBy: user?.fullName || 'Unknown',
      })
    ).unwrap();

    setForm((prev) => ({ ...prev, amount: '', description: '' }));
    setSuccess('Expense saved successfully.');
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Expense Entry
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {success ? <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert> : null}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={8}>
          <Card variant="outlined" sx={{ borderColor: '#cbd5e1' }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Expense Form
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={4}>
                    <TextField
                      select
                      label="Expense Type"
                      value={form.expenseHeadId}
                      onChange={(e) => setForm((p) => ({ ...p, expenseHeadId: e.target.value }))}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value=""><em>Select head</em></MenuItem>
                      {headsForClass.map((h) => (
                        <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <TextField
                      type="number"
                      label="Amount"
                      value={form.amount}
                      onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                      inputProps={{ min: 0, step: '0.01' }}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      type="date"
                      label="Date"
                      value={form.date}
                      onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      select
                      label="Payment Mode"
                      value={form.paymentMode}
                      onChange={(e) => setForm((p) => ({ ...p, paymentMode: e.target.value as any }))}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="cash">Cash</MenuItem>
                      <MenuItem value="bank">Bank</MenuItem>
                      <MenuItem value="upi">UPI</MenuItem>
                      <MenuItem value="card">Card</MenuItem>
                      <MenuItem value="cheque">Cheque</MenuItem>
                    </TextField>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <TextField
                      label="Purpose (optional)"
                      value={form.description}
                      onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                      fullWidth
                      size="small"
                    />
                  </Grid>
                </Grid>
                {isAdmin ? (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" color="info" variant="outlined" label={`Auto Class: ${form.expenseClass === 'direct' ? 'Direct' : 'Indirect'}`} />
                    <Button
                      size="small"
                      variant={form.manualClassOverride ? 'contained' : 'text'}
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          manualClassOverride: !p.manualClassOverride,
                          ...(p.manualClassOverride ? {} : { expenseHeadId: '' }),
                        }))
                      }
                      sx={{ textTransform: 'none' }}
                    >
                      {form.manualClassOverride ? 'Disable Manual Class' : 'Override Class (Admin)'}
                    </Button>
                    {form.manualClassOverride ? (
                      <TextField
                        select
                        label="Expense Class"
                        value={form.expenseClass}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            expenseClass: e.target.value as 'direct' | 'indirect',
                            expenseHeadId: '',
                          }))
                        }
                        size="small"
                        sx={{ minWidth: 180 }}
                      >
                        <MenuItem value="direct">Direct</MenuItem>
                        <MenuItem value="indirect">Indirect</MenuItem>
                      </TextField>
                    ) : null}
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Expense class auto-detect hota hai; aapko direct/indirect choose karne ki zarurat nahi.
                  </Typography>
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  <Button
                    variant="contained"
                    onClick={() => void handleSave()}
                    disabled={loading || !form.expenseHeadId || !form.amount}
                    sx={{ textTransform: 'none' }}
                  >
                    Save Expense
                  </Button>
                  {selectedHead ? <Chip label={`Head: ${selectedHead.name}`} size="small" /> : null}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <Card variant="outlined" sx={{ borderColor: '#cbd5e1' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700}>Quick Summary</Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2">Total entries: <strong>{expenses.length}</strong></Typography>
              <Typography variant="body2">This month: <strong>{formatCurrency(thisMonthExpense)}</strong></Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                System auto expense ledger me post karta hai; aapko impact mode choose karne ki zarurat nahi.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ mt: 2, borderColor: '#cbd5e1' }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Expense by Head
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Head</TableCell>
                <TableCell align="right">Total Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {heads.map((h) => (
                <TableRow key={h.id} hover>
                  <TableCell>{h.name}</TableCell>
                  <TableCell align="right">{formatCurrency(totalsByHead.get(h.id) ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Box>
  );
}
