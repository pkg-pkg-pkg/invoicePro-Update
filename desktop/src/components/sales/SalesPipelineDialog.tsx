import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import type { SalesDocKind, SalesDocumentStatus } from '../../types/salesDocuments';
import { salesPipelineService } from '../../services/sales/salesDocumentService';
import type { LedgerAccount } from '../../types/masters';

type Props = {
  open: boolean;
  kind: SalesDocKind;
  customers: LedgerAccount[];
  onClose: () => void;
  onSaved: () => void;
};

const STATUS_OPTIONS: SalesDocumentStatus[] = ['DRAFT', 'SENT', 'APPROVED'];

export function SalesPipelineDialog({ open, kind, customers, onClose, onSaved }: Props) {
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<SalesDocumentStatus>('DRAFT');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCustomerId('');
    setCustomerName('');
    setAmount('');
    setDate(new Date().toISOString().slice(0, 10));
    setDueDate('');
    setStatus('DRAFT');
    setNotes('');
    setError(null);
  }, [open, kind]);

  const handleCustomerPick = (id: string) => {
    setCustomerId(id);
    const c = customers.find((x) => x.id === id);
    setCustomerName(c?.name ?? '');
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await salesPipelineService.create({
        kind,
        customerId: customerId || null,
        customerName: customerName.trim(),
        amount: Number(amount || 0),
        date,
        dueDate: dueDate || null,
        status,
        notes,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle fontWeight={800}>Create document</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? (
            <TextField error helperText={error} disabled fullWidth size="small" />
          ) : null}
          <FormControl fullWidth size="small">
            <InputLabel>Customer</InputLabel>
            <Select label="Customer" value={customerId} onChange={(e) => handleCustomerPick(e.target.value)}>
              <MenuItem value="">Manual entry</MenuItem>
              {customers.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {!customerId ? (
            <TextField
              label="Customer name"
              size="small"
              fullWidth
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          ) : null}
          <TextField label="Amount (₹)" type="number" size="small" fullWidth value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Stack direction="row" spacing={1}>
            <TextField label="Date" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={date} onChange={(e) => setDate(e.target.value)} />
            <TextField label="Due date" type="date" size="small" fullWidth InputLabelProps={{ shrink: true }} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </Stack>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as SalesDocumentStatus)}>
              {STATUS_OPTIONS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label="Notes" size="small" fullWidth multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving} onClick={() => void handleSave()}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
