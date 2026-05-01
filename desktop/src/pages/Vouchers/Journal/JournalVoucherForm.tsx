import { memo, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

import { voucherService } from '../../../services/vouchers/voucherService';
import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { LedgerAccount } from '../../../types/masters';
import { VoucherLine } from '../../../types/vouchers';
import { usePermission } from '../../../hooks/usePermission';
import { generateId } from '../../../utils/id';

type LineDraft = {
  id: string;
  ledgerId: string;
  debit: string;
  credit: string;
};

const numberFrom = (s: string) => {
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return n;
};

const JournalVoucherForm = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');

  const [ledgers, setLedgers] = useState<LedgerAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [number, setNumber] = useState(() => `JRN-${dayjs().format('YYYYMMDD-HHmmss')}`);
  const [narration, setNarration] = useState('');

  const [lines, setLines] = useState<LineDraft[]>([
    { id: generateId('jrn-line'), ledgerId: '', debit: '0', credit: '' },
    { id: generateId('jrn-line'), ledgerId: '', debit: '', credit: '0' },
  ]);

  useEffect(() => {
    ledgerAccountService
      .list({ includeInactive: false })
      .then((list) => setLedgers(list.filter((l) => l.isActive !== false)))
      .catch(() => setLedgers([]));
  }, []);

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((sum, l) => sum + (l.debit ? numberFrom(l.debit) : 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + (l.credit ? numberFrom(l.credit) : 0), 0);
    const d = Number(totalDebit.toFixed(4));
    const c = Number(totalCredit.toFixed(4));
    return { totalDebit: d, totalCredit: c, balanced: d === c };
  }, [lines]);

  const addLine = () => {
    setLines((prev) => [
      ...prev,
      { id: generateId('jrn-line'), ledgerId: '', debit: '0', credit: '' },
    ]);
  };

  const removeLine = (id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id));
  };

  const updateLine = (id: string, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const payloadLines: VoucherLine[] = useMemo(() => {
    const out: VoucherLine[] = [];
    for (const l of lines) {
      const debit = l.debit ? numberFrom(l.debit) : 0;
      const credit = l.credit ? numberFrom(l.credit) : 0;
      const hasAmount = debit > 0 || credit > 0;
      if (!l.ledgerId || !hasAmount) continue;

      out.push({
        ledgerId: l.ledgerId,
        debit: debit > 0 ? Number(debit.toFixed(2)) : 0,
        credit: credit > 0 ? Number(credit.toFixed(2)) : 0,
      });
    }
    return out;
  }, [lines]);

  const canSave = useMemo(() => {
    if (!canCreate) return false;
    if (!number.trim()) return false;
    if (!date) return false;
    if (payloadLines.length < 2) return false;
    if (!totals.balanced) return false;
    return true;
  }, [canCreate, date, number, payloadLines.length, totals.balanced]);

  const handleSave = async () => {
    if (!canCreate) return;
    setError(null);
    setSaving(true);
    try {
      if (payloadLines.length < 2) {
        throw new Error('Please add at least two ledger lines with debit/credit amounts.');
      }
      if (!totals.balanced) {
        throw new Error(`Voucher is not balanced. Debit (${totals.totalDebit}) != Credit (${totals.totalCredit}).`);
      }

      await voucherService.create({
        type: 'JOURNAL',
        date: new Date(date).toISOString(),
        number: number.trim(),
        narration: narration.trim() || undefined,
        lines: payloadLines,
      });
      navigate('/vouchers/journal');
    } catch (e) {
      setError((e as Error).message ?? 'Failed to save journal voucher');
    } finally {
      setSaving(false);
    }
  };

  if (!canCreate) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">You do not have permission to create vouchers.</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 1100, mx: 'auto' }}>
      <Stack spacing={2}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" fontWeight={700}>
            New Journal Voucher
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add debit/credit entries; total debit must equal total credit.
          </Typography>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  label="Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  fullWidth
                />
                <TextField
                  label="Voucher Number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  fullWidth
                />
              </Stack>
              <TextField
                label="Narration (optional)"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ p: 2 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Ledger entries
                </Typography>
                <Button startIcon={<AddIcon />} variant="outlined" onClick={addLine}>
                  Add line
                </Button>
              </Stack>
            </Box>

            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Ledger</TableCell>
                  <TableCell align="right">Debit</TableCell>
                  <TableCell align="right">Credit</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((l) => (
                  <TableRow key={l.id} hover>
                    <TableCell sx={{ minWidth: 320 }}>
                      <TextField
                        select
                        value={l.ledgerId}
                        onChange={(e) => updateLine(l.id, { ledgerId: e.target.value })}
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="">
                          <em>Select ledger</em>
                        </MenuItem>
                        {ledgers.map((ledger) => (
                          <MenuItem key={ledger.id} value={ledger.id}>
                            {ledger.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell align="right" sx={{ width: 200 }}>
                      <TextField
                        type="number"
                        size="small"
                        value={l.debit}
                        onChange={(e) => {
                          const next = e.target.value;
                          const debitNum = numberFrom(next);
                          updateLine(l.id, { debit: next, credit: debitNum > 0 ? '' : l.credit });
                        }}
                        inputProps={{ min: 0, step: '0.01' }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ width: 200 }}>
                      <TextField
                        type="number"
                        size="small"
                        value={l.credit}
                        onChange={(e) => {
                          const next = e.target.value;
                          const creditNum = numberFrom(next);
                          updateLine(l.id, { credit: next, debit: creditNum > 0 ? '' : l.debit });
                        }}
                        inputProps={{ min: 0, step: '0.01' }}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => removeLine(l.id)}
                        disabled={lines.length <= 2}
                        title={lines.length <= 2 ? 'At least two lines required' : 'Remove line'}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Paper sx={{ p: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Total Debit: <strong>{totals.totalDebit.toFixed(2)}</strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Credit: <strong>{totals.totalCredit.toFixed(2)}</strong>
              </Typography>
            </Box>
            <Box>
              {totals.balanced ? (
                <Typography variant="body2" color="success.main" fontWeight={700}>
                  Balanced
                </Typography>
              ) : (
                <Typography variant="body2" color="error.main" fontWeight={700}>
                  Not balanced yet
                </Typography>
              )}
            </Box>
          </Stack>
        </Paper>

        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={2} justifyContent="flex-end" flexWrap="wrap">
          <Button variant="outlined" onClick={() => navigate('/vouchers/journal')}>
            Cancel
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={!canSave || saving}
            onClick={handleSave}
          >
            {saving ? 'Saving…' : 'Save Journal'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
};

export default memo(JournalVoucherForm);

