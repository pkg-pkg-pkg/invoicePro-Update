import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import { EwayBillDetailsModal } from '../../components/eway/EwayBillDetailsModal';
import { EwayBillStatusChip } from '../../components/eway/EwayBillStatusChip';
import { dashboardCardSx, useDashboardTheme } from '../../components/dashboard/dashboardTheme';
import {
  ewayBillToFormValues,
  formValuesToEwayBill,
  listEwayEligibleInvoices,
  patchVoucherEwayBill,
} from '../../services/ewayBillService';
import { loadEwayBillSettings } from '../../services/ewayBillSettingsService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { Voucher } from '../../types/vouchers';

export default function EWayBillPage() {
  const navigate = useNavigate();
  const dt = useDashboardTheme();
  const threshold = loadEwayBillSettings().thresholdAmount;
  const [rows, setRows] = useState<Array<{ voucher: Voucher; grandTotal: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editVoucher, setEditVoucher] = useState<Voucher | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEwayEligibleInvoices();
      setRows(data.map((d) => ({ voucher: d.voucher, grandTotal: d.grandTotal })));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load invoices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const eligibleCount = useMemo(
    () => rows.filter((r) => r.grandTotal >= threshold).length,
    [rows, threshold]
  );

  const handleSaveDetails = async (values: ReturnType<typeof ewayBillToFormValues>) => {
    if (!editVoucher) return;
    const row = rows.find((r) => r.voucher.id === editVoucher.id);
    setBusy(true);
    try {
      const eway = formValuesToEwayBill(
        values,
        row?.grandTotal ?? 0,
        editVoucher.ewayBill?.status
      );
      await patchVoucherEwayBill(editVoucher.id, eway);
      setEditVoucher(null);
      await load();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not save E-Way Bill.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ fontFamily: dt.fontFamily, minHeight: '100%', bgcolor: dt.bg, px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ textTransform: 'none', fontWeight: 600 }}>
          Dashboard
        </Button>
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.5 }}>
        <LocalShippingIcon color="primary" />
        <Typography variant="h5" fontWeight={800}>E-Way Bill</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Manage E-Way Bill details on tax invoices. Threshold: ₹{threshold.toLocaleString('en-IN')}.
      </Typography>
      <Alert severity="info" sx={{ mb: 2.5 }}>
        Manual entry only — GSP API integration (Masters India, ClearTax) coming in a future release.
      </Alert>
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      <Paper elevation={0} sx={{ ...dashboardCardSx(dt), p: 2.25 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography fontWeight={800}>Tax invoices</Typography>
            <Typography variant="caption" color="text.secondary">
              {rows.length} invoice(s) • {eligibleCount} above threshold
            </Typography>
          </Box>
          <Button onClick={() => void load()} disabled={loading} sx={{ textTransform: 'none', fontWeight: 600 }}>Refresh</Button>
        </Stack>
        {loading ? (
          <Stack alignItems="center" sx={{ py: 5 }}><CircularProgress size={28} /></Stack>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: dt.bgSubtle }}>
                  <TableCell sx={{ fontWeight: 700 }}>Invoice</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Amount</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>EWB</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No tax invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ voucher, grandTotal }) => (
                    <TableRow key={voucher.id} hover>
                      <TableCell sx={{ fontWeight: 700 }}>{voucher.number}</TableCell>
                      <TableCell>{formatDate(voucher.date)}</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{formatCurrency(grandTotal)}</TableCell>
                      <TableCell><EwayBillStatusChip eway={voucher.ewayBill} /></TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button size="small" onClick={() => setEditVoucher(voucher)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                            {voucher.ewayBill?.status === 'PENDING' || !voucher.ewayBill ? 'Add EWB' : 'Edit EWB'}
                          </Button>
                          <Button size="small" startIcon={<OpenInNewIcon />} onClick={() => navigate(`/sales/invoices/${voucher.id}`)} sx={{ textTransform: 'none', fontWeight: 600 }}>
                            Open
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>
      <EwayBillDetailsModal
        open={Boolean(editVoucher)}
        initialValues={ewayBillToFormValues(editVoucher?.ewayBill)}
        title="E-Way Bill Details"
        onClose={() => setEditVoucher(null)}
        onSave={(values) => void handleSaveDetails(values)}
        busy={busy}
      />
    </Box>
  );
}
