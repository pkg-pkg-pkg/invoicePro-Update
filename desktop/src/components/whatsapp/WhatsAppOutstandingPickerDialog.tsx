import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { alpha } from '@mui/material/styles';
import type { CustomerSummary } from '../../types/dashboard';
import { formatCurrency } from '../../utils/formatters';
import { resolvePartyPhone } from '../../services/whatsappOutstandingReminder';

export interface OutstandingCustomerRow {
  customer: CustomerSummary;
  phone: string | null;
}

export interface WhatsAppOutstandingPickerDialogProps {
  open: boolean;
  onClose: () => void;
  customers: CustomerSummary[];
  onConfirm: (selected: CustomerSummary[]) => void;
  busy?: boolean;
}

export function WhatsAppOutstandingPickerDialog({
  open,
  onClose,
  customers,
  onConfirm,
  busy = false,
}: WhatsAppOutstandingPickerDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<OutstandingCustomerRow[]>([]);
  const [loadingPhones, setLoadingPhones] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelectedIds(new Set());
      setRows([]);
      return;
    }

    let cancelled = false;
    setLoadingPhones(true);

    void (async () => {
      const nextRows: OutstandingCustomerRow[] = [];
      for (const customer of customers) {
        if (cancelled) return;
        const phone = await resolvePartyPhone(customer.id, customer.name);
        nextRows.push({ customer, phone: phone?.trim() || null });
      }
      if (!cancelled) {
        setRows(nextRows);
        setSelectedIds(new Set());
        setLoadingPhones(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, customers]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.customer.name.toLowerCase().includes(q));
  }, [rows, search]);

  const selectableRows = useMemo(
    () => filteredRows.filter((r) => r.phone),
    [filteredRows]
  );

  const allSelectableSelected =
    selectableRows.length > 0 && selectableRows.every((r) => selectedIds.has(r.customer.id));

  const someSelectableSelected =
    selectableRows.some((r) => selectedIds.has(r.customer.id)) && !allSelectableSelected;

  const selectedCount = useMemo(
    () => rows.filter((r) => r.phone && selectedIds.has(r.customer.id)).length,
    [rows, selectedIds]
  );

  const toggleAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selectableRows.map((r) => r.customer.id)));
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = rows
      .filter((r) => r.phone && selectedIds.has(r.customer.id))
      .map((r) => r.customer);
    onConfirm(selected);
  };

  const totalOutstanding = useMemo(
    () => customers.reduce((sum, c) => sum + Number(c.currentBalance || 0), 0),
    [customers]
  );

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Send WhatsApp Reminder</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Select customers with outstanding balance. WhatsApp will open for each selected
            customer — you must tap <strong>Send</strong> in WhatsApp manually.
          </Typography>

          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: (t) => alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.08 : 0.06),
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Total outstanding customers
              </Typography>
              <Typography fontWeight={800}>{customers.length}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.75 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Total due amount
              </Typography>
              <Typography fontWeight={800} color="warning.main">
                {formatCurrency(totalOutstanding)}
              </Typography>
            </Stack>
          </Box>

          <TextField
            size="small"
            placeholder="Search customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
            }}
          />

          {loadingPhones ? (
            <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Loading customer contacts…
              </Typography>
            </Stack>
          ) : filteredRows.length === 0 ? (
            <Alert severity="info">No outstanding customers match your search.</Alert>
          ) : (
            <Box
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                spacing={1}
                sx={{
                  px: 1.5,
                  py: 1,
                  bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.04),
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Checkbox
                  size="small"
                  checked={allSelectableSelected}
                  indeterminate={someSelectableSelected}
                  onChange={toggleAll}
                  disabled={selectableRows.length === 0 || busy}
                />
                <Typography variant="body2" fontWeight={700} sx={{ flex: 1 }}>
                  Customer
                </Typography>
                <Typography variant="body2" fontWeight={700} sx={{ minWidth: 96, textAlign: 'right' }}>
                  Outstanding
                </Typography>
              </Stack>

              <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {filteredRows.map(({ customer, phone }) => {
                  const hasPhone = Boolean(phone);
                  const checked = selectedIds.has(customer.id);
                  return (
                    <Stack
                      key={customer.id}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                      sx={{
                        px: 1.5,
                        py: 1.1,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        opacity: hasPhone ? 1 : 0.55,
                        '&:last-child': { borderBottom: 'none' },
                      }}
                    >
                      <Checkbox
                        size="small"
                        checked={checked}
                        disabled={!hasPhone || busy}
                        onChange={() => toggleOne(customer.id)}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700} noWrap>
                          {customer.name}
                        </Typography>
                        <Typography variant="caption" color={hasPhone ? 'text.secondary' : 'error.main'}>
                          {hasPhone ? phone : 'No mobile / WhatsApp — add in Party Master'}
                        </Typography>
                      </Box>
                      <Typography
                        variant="body2"
                        fontWeight={700}
                        color="warning.main"
                        sx={{ minWidth: 96, textAlign: 'right' }}
                      >
                        {formatCurrency(customer.currentBalance)}
                      </Typography>
                    </Stack>
                  );
                })}
              </Box>
            </Box>
          )}

          {!loadingPhones && rows.some((r) => !r.phone) ? (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              Some customers have no contact number and cannot be selected.
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color="success"
          startIcon={<WhatsAppIcon />}
          disabled={busy || loadingPhones || selectedCount === 0}
          onClick={handleConfirm}
          sx={{ textTransform: 'none', fontWeight: 700, minWidth: 200 }}
        >
          {busy ? 'Preparing…' : `Send WhatsApp (${selectedCount})`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
