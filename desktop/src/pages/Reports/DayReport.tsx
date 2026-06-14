import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RestoreFromTrashIcon from '@mui/icons-material/RestoreFromTrash';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate } from 'react-router-dom';
import {
  DAY_BOOK_VOUCHER_TYPES,
  dayBookService,
  type DayBookEntry,
  type DayBookResult,
} from '../../services/dayBook/dayBookService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { PREMIUM_ERP } from '../../theme/premiumErpTheme';
import { usePermissions } from '../../hooks/usePermissions';
import { openPrintPreview } from '../../services/printService';
import { VoucherNumberLink } from '../../components/Vouchers/VoucherNumberLink';
function buildVoucherPrintHtml(entry: DayBookEntry): string {
  const v = entry.voucher;
  const lines = v?.lines ?? [];
  const lineRows = lines
    .map(
      (line) =>
        `<tr><td>${line.ledgerId}</td><td align="right">${formatCurrency(Number(line.debit || 0))}</td><td align="right">${formatCurrency(Number(line.credit || 0))}</td></tr>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><title>${entry.voucherNumber}</title>
<style>body{font-family:Arial,sans-serif;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;font-size:13px}th{background:#f5f5f5}</style>
</head><body>
<h2>${entry.voucherType}</h2>
<p><strong>Voucher No:</strong> ${entry.voucherNumber}</p>
<p><strong>Date:</strong> ${formatDate(entry.date)}</p>
<p><strong>Party:</strong> ${entry.partyName}</p>
<p><strong>Description:</strong> ${entry.description}</p>
<table><thead><tr><th>Ledger</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${lineRows}</tbody></table>
<p><strong>Amount:</strong> ${formatCurrency(entry.amount)}</p>
</body></html>`;
}

export default function DayReport() {
  const navigate = useNavigate();
  const { isAdmin, hasPermission } = usePermissions();

  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [voucherType, setVoucherType] = useState('ALL');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [includeDeleted, setIncludeDeleted] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DayBookResult | null>(null);

  const [viewEntry, setViewEntry] = useState<DayBookEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<DayBookEntry | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const canDeleteEntry = useCallback(
    (entry: DayBookEntry) => {
      if (isAdmin) return true;
      if (entry.voucherType === 'Sales Invoice' || entry.voucherType === 'Purchase Invoice') {
        return hasPermission('deleteInvoices');
      }
      return hasPermission('deletePayments') || hasPermission('deleteInvoices');
    },
    [isAdmin, hasPermission]
  );

  const canEditEntry = useCallback(
    (entry: DayBookEntry) => {
      if (entry.isDeleted) return false;
      if (isAdmin) return true;
      if (entry.voucherType === 'Sales Invoice' || entry.voucherType === 'Purchase Invoice') {
        return hasPermission('editInvoices');
      }
      return hasPermission('editPayments') || hasPermission('editInvoices');
    },
    [isAdmin, hasPermission]
  );

  const loadDayBook = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await dayBookService.fetch({
        date,
        voucherType: voucherType === 'ALL' ? undefined : voucherType,
        partyName,
        amount,
        createdBy,
        includeDeleted: isAdmin && includeDeleted,
      });
      setResult(data);
    } catch (e) {
      setError((e as Error).message || 'Failed to load day book');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [date, voucherType, partyName, amount, createdBy, includeDeleted, isAdmin]);

  useEffect(() => {
    void loadDayBook();
  }, [loadDayBook]);

  const entries = result?.entries ?? [];
  const totals = result?.totals;

  const handleView = (entry: DayBookEntry) => setViewEntry(entry);

  const handleEdit = (entry: DayBookEntry) => {
    if (!entry.editPath) return;
    navigate(entry.editPath);
  };

  const handlePrint = async (entry: DayBookEntry) => {
    if (entry.source === 'voucher' && entry.voucherType === 'Sales Invoice' && entry.editPath) {
      navigate(`${entry.editPath}?print=1`);
      return;
    }
    await openPrintPreview(buildVoucherPrintHtml(entry));
  };

  const handleDuplicate = async (entry: DayBookEntry) => {
    if (!entry.voucher || entry.source !== 'voucher') {
      alert('Only voucher entries can be duplicated.');
      return;
    }
    if (!window.confirm(`Duplicate voucher ${entry.voucherNumber}?`)) return;
    setActionBusy(true);
    try {
      await dayBookService.duplicateVoucher(entry.voucher);
      await loadDayBook();
    } catch (e) {
      alert((e as Error).message || 'Failed to duplicate voucher.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteEntry) return;
    setActionBusy(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const username = String(user?.username || user?.email || '—');
      await dayBookService.deleteEntry(deleteEntry, username);
      setDeleteEntry(null);
      await loadDayBook();
    } catch (e) {
      alert((e as Error).message || 'Failed to delete voucher.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRestore = async (entry: DayBookEntry) => {
    if (!isAdmin) return;
    if (!window.confirm(`Restore voucher ${entry.voucherNumber}?`)) return;
    setActionBusy(true);
    try {
      await dayBookService.restoreEntry(entry);
      await loadDayBook();
    } catch (e) {
      alert((e as Error).message || 'Failed to restore voucher.');
    } finally {
      setActionBusy(false);
    }
  };

  const voucherLineRows = viewEntry?.linesDetail ?? [];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">Day Book</Typography>
          <Typography variant="body2" color="text.secondary">
            All voucher entries for the selected date — view, edit, delete, print, and duplicate.
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <span style={{ display: 'inline-flex' }}>
            <IconButton onClick={() => void loadDayBook()} disabled={loading || actionBusy}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Paper sx={{ p: 2, mb: 2, border: `1px solid ${PREMIUM_ERP.border}` }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth>
              <InputLabel>Voucher Type</InputLabel>
              <Select
                label="Voucher Type"
                value={voucherType}
                onChange={(e) => setVoucherType(String(e.target.value))}
              >
                <MenuItem value="ALL">All Types</MenuItem>
                {DAY_BOOK_VOUCHER_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Party Name"
              value={partyName}
              onChange={(e) => setPartyName(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              label="Created By"
              value={createdBy}
              onChange={(e) => setCreatedBy(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={() => void loadDayBook()}
              disabled={loading}
              sx={{ height: '56px' }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Apply Filters'}
            </Button>
          </Grid>
          {isAdmin ? (
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={includeDeleted}
                    onChange={(_, checked) => setIncludeDeleted(checked)}
                  />
                }
                label="Show deleted vouchers (Admin restore)"
              />
            </Grid>
          ) : null}
        </Grid>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {totals ? (
        <Paper sx={{ p: 2, mb: 2, border: `1px solid ${PREMIUM_ERP.border}` }}>
          <Grid container spacing={2}>
            {[
              { label: 'Total Debit', value: formatCurrency(totals.totalDebit) },
              { label: 'Total Credit', value: formatCurrency(totals.totalCredit) },
              { label: 'Total Vouchers', value: String(totals.totalVouchers) },
              { label: 'Total Sales', value: formatCurrency(totals.totalSales) },
              { label: 'Total Receipts', value: formatCurrency(totals.totalReceipts) },
            ].map((item) => (
              <Grid item xs={6} sm={4} md={2.4} key={item.label}>
                <Typography variant="body2" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="h6" fontWeight={700}>
                  {item.value}
                </Typography>
              </Grid>
            ))}
          </Grid>
        </Paper>
      ) : null}

      <TableContainer component={Paper} sx={{ border: `1px solid ${PREMIUM_ERP.border}` }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {[
                'Date',
                'Voucher Type',
                'Voucher Number',
                'Party Name',
                'Description',
                'Debit',
                'Credit',
                'Amount',
                'Created By',
                'Actions',
              ].map((col) => (
                <TableCell
                  key={col}
                  align={col === 'Debit' || col === 'Credit' || col === 'Amount' ? 'right' : 'left'}
                  sx={{ fontWeight: 700, bgcolor: '#f8fafc' }}
                >
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 6 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                  No vouchers found for this date and filters.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow
                  key={`${entry.source}-${entry.id}`}
                  hover
                  onClick={() => handleView(entry)}
                  onDoubleClick={() => canEditEntry(entry) && handleEdit(entry)}
                  sx={{
                    cursor: 'pointer',
                    opacity: entry.isDeleted ? 0.55 : 1,
                    bgcolor: entry.isDeleted ? '#fff1f2' : undefined,
                  }}
                >
                  <TableCell>{formatDate(entry.date)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <span>{entry.voucherType}</span>
                      {entry.isDeleted ? <Chip size="small" label="Deleted" color="error" /> : null}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }} onClick={(e) => e.stopPropagation()}>
                    {entry.source === 'voucher' && entry.voucher ? (
                      <VoucherNumberLink
                        voucherId={entry.voucher.id}
                        voucherType={entry.voucher.type}
                        voucherNumber={entry.voucherNumber}
                      />
                    ) : (
                      entry.voucherNumber
                    )}
                  </TableCell>
                  <TableCell>{entry.partyName}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>{entry.description}</TableCell>
                  <TableCell align="right">{formatCurrency(entry.debit)}</TableCell>
                  <TableCell align="right">{formatCurrency(entry.credit)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {formatCurrency(entry.amount)}
                  </TableCell>
                  <TableCell>{entry.createdBy}</TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" spacing={0.25} justifyContent="flex-end">
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => handleView(entry)}>
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {canEditEntry(entry) && entry.editPath ? (
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleEdit(entry)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      {entry.isDeleted && isAdmin ? (
                        <Tooltip title="Restore">
                          <IconButton size="small" color="success" onClick={() => void handleRestore(entry)}>
                            <RestoreFromTrashIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      {!entry.isDeleted && canDeleteEntry(entry) ? (
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => setDeleteEntry(entry)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                      <Tooltip title="Print">
                        <IconButton size="small" onClick={() => void handlePrint(entry)}>
                          <PrintIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {entry.source === 'voucher' && !entry.isDeleted ? (
                        <Tooltip title="Duplicate">
                          <IconButton size="small" onClick={() => void handleDuplicate(entry)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      ) : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(viewEntry)} onClose={() => setViewEntry(null)} maxWidth="md" fullWidth>
        <DialogTitle fontWeight={800}>Voucher Details</DialogTitle>
        <DialogContent dividers>
          {viewEntry ? (
            <Stack spacing={1.5}>
              <Typography><strong>Type:</strong> {viewEntry.voucherType}</Typography>
              <Typography><strong>Voucher No:</strong> {viewEntry.voucherNumber}</Typography>
              <Typography><strong>Date:</strong> {formatDate(viewEntry.date)}</Typography>
              <Typography><strong>Party:</strong> {viewEntry.partyName}</Typography>
              <Typography><strong>Description:</strong> {viewEntry.description}</Typography>
              <Typography><strong>Amount:</strong> {formatCurrency(viewEntry.amount)}</Typography>
              <Typography><strong>Created By:</strong> {viewEntry.createdBy}</Typography>
              {voucherLineRows.length > 0 ? (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Ledger</TableCell>
                      <TableCell align="right">Debit</TableCell>
                      <TableCell align="right">Credit</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {voucherLineRows.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{line.ledgerName}</TableCell>
                        <TableCell align="right">{formatCurrency(line.debit)}</TableCell>
                        <TableCell align="right">{formatCurrency(line.credit)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewEntry(null)}>Close</Button>
          {viewEntry && canEditEntry(viewEntry) && viewEntry.editPath ? (
            <Button variant="contained" onClick={() => { handleEdit(viewEntry); setViewEntry(null); }}>
              Edit Voucher
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteEntry)} onClose={() => !actionBusy && setDeleteEntry(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>Delete Voucher?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            Voucher No: <strong>{deleteEntry?.voucherNumber}</strong>
          </Typography>
          <Typography color="text.secondary">This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteEntry(null)} disabled={actionBusy}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={() => void handleConfirmDelete()} disabled={actionBusy}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
