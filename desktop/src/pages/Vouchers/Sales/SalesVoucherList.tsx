import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import ShareIcon from '@mui/icons-material/Share';
import { useNavigate, useSearchParams } from 'react-router-dom';

import {
  buildSalesVoucherInvoiceHtml,
  voucherGrandTotal,
} from '../../../services/voucherPrintBuilder';
import PrintExportSetupDialog, { type PrintExportAction } from '../../../components/invoice/PrintExportSetupDialog';
import { WhatsAppReminderPreviewDialog } from '../../../components/whatsapp/WhatsAppReminderPreviewDialog';
import { EwayBillStatusChip } from '../../../components/eway/EwayBillStatusChip';
import { VoucherNumberLink } from '../../../components/Vouchers/VoucherNumberLink';
import { buildInvoiceWhatsAppMessage } from '../../../services/printService';
import { resolvePartyPhone } from '../../../services/whatsappOutstandingReminder';

import { voucherService } from '../../../services/vouchers/voucherService';
import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { inventoryItemService } from '../../../services/masters/inventoryItemService';
import { Voucher } from '../../../types/vouchers';
import { LedgerAccount } from '../../../types/masters';
import { useMasterList } from '../../../hooks/useMasterList';
import { usePermission } from '../../../hooks/usePermission';
import { usePermissions } from '../../../hooks/usePermissions';
import { approvalService } from '../../../services/approvals/approvalService';
import {
  resolveVoucherCustomerPhone,
  runInvoicePrintExportAction,
} from '../../../services/invoicePrintFlow';
import {
  currentCalendarMonthRange,
  isDateWithinInclusive,
  toLocalYmd,
} from '../../../utils/dateRange';

interface FilterState {
  fromDate: string;
  toDate: string;
  customerId: string;
  status: 'ALL' | 'ACTIVE' | 'CANCELLED';
}

const createDefaultFilters = (): FilterState => {
  const { from, to } = currentCalendarMonthRange();
  return {
    fromDate: from,
    toDate: to,
    customerId: '',
    status: 'ALL',
  };
};

const SalesVoucherList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can } = usePermission();
  const { isAdmin } = usePermissions();
  const canCreate = can('create-vouchers');

  const [filters, setFilters] = useState<FilterState>(() => createDefaultFilters());
  const [customers, setCustomers] = useState<LedgerAccount[]>([]);
  const [itemNameMap, setItemNameMap] = useState<Map<string, string>>(new Map());
  const [itemPurchasePriceMap, setItemPurchasePriceMap] = useState<Map<string, number>>(new Map());
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);
  const [printSetup, setPrintSetup] = useState<{ open: boolean; action: PrintExportAction }>({
    open: false,
    action: 'print',
  });
  const [waShareOpen, setWaShareOpen] = useState(false);
  const [waShareBusy, setWaShareBusy] = useState(false);
  const [waShareDraft, setWaShareDraft] = useState<{
    customerName: string;
    mobile: string;
    amount: number;
    message: string;
  } | null>(null);
  const [showProfit, setShowProfit] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');

  useEffect(() => {
    ledgerAccountService
      .list({ includeInactive: false })
      .then((accounts) => setCustomers(accounts.filter((acct) => acct.isActive !== false)))
      .catch(() => setCustomers([]));
  }, []);

  useEffect(() => {
    const requestedPeriod = (searchParams.get('viewPeriod') || '').toLowerCase();
    const fyStartRaw = searchParams.get('fyStart');
    if (requestedPeriod !== 'month' && requestedPeriod !== 'year') return;
    if (requestedPeriod === 'month') {
      setViewMode('month');
      const { from, to } = currentCalendarMonthRange();
      setFilters((prev) => ({ ...prev, fromDate: from, toDate: to }));
      return;
    }
    setViewMode('year');
    const fyStart = Number.parseInt(fyStartRaw || '', 10);
    if (!Number.isFinite(fyStart)) return;
    const from = `${fyStart}-04-01`;
    const to = `${fyStart + 1}-03-31`;
    setFilters((prev) => ({ ...prev, fromDate: from, toDate: to }));
  }, [searchParams]);

  useEffect(() => {
    inventoryItemService
      .list({ includeInactive: false })
      .then((items) => {
        setItemNameMap(new Map(items.map((item) => [item.id, item.name])));
        setItemPurchasePriceMap(new Map(items.map((item) => [item.id, Number(item.pricing?.purchase || 0)])));
      })
      .catch(() => {
        setItemNameMap(new Map());
        setItemPurchasePriceMap(new Map());
      });
  }, []);

  const fetchVouchers = useCallback(async () => {
    const list = await voucherService.list();
    return list.filter((voucher) => voucher.type === 'SALES');
  }, []);

  const { data: vouchers, loading, error, refresh } = useMasterList<Voucher>(fetchVouchers);

  const effectiveDateRange = useMemo(() => {
    if (filters.fromDate && filters.toDate) {
      return { from: filters.fromDate, to: filters.toDate };
    }
    if (viewMode === 'month') {
      return currentCalendarMonthRange();
    }
    return {
      from: filters.fromDate || '0000-01-01',
      to: filters.toDate || '9999-12-31',
    };
  }, [filters.fromDate, filters.toDate, viewMode]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      if (filters.status !== 'ALL' && voucher.status !== filters.status) {
        return false;
      }
      if (!isDateWithinInclusive(voucher.date, effectiveDateRange.from, effectiveDateRange.to)) {
        return false;
      }
      if (filters.customerId) {
        const customerLine = voucher.lines.find((line) => (line.debit ?? 0) > 0);
        if (!customerLine || customerLine.ledgerId !== filters.customerId) {
          return false;
        }
      }
      return true;
    });
  }, [effectiveDateRange.from, effectiveDateRange.to, filters, vouchers]);

  const voucherTotal = (voucher: Voucher) => {
    const debit = voucher.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = voucher.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return Math.max(debit, credit);
  };

  const yearlyMonthRows = useMemo(() => {
    if (viewMode !== 'year') return [];
    const monthMap = new Map<string, { count: number; total: number; label: string; monthStart: string; monthEnd: string }>();
    const fromDate = filters.fromDate || null;
    const toDate = filters.toDate || null;
    vouchers.forEach((voucher) => {
      if (filters.status !== 'ALL' && voucher.status !== filters.status) return;
      if (filters.customerId) {
        const customerLine = voucher.lines.find((line) => (line.debit ?? 0) > 0);
        if (!customerLine || customerLine.ledgerId !== filters.customerId) return;
      }
      const rangeFrom = fromDate ?? '0000-01-01';
      const rangeTo = toDate ?? '9999-12-31';
      if (!isDateWithinInclusive(voucher.date, rangeFrom, rangeTo)) return;
      const vDate = new Date(voucher.date);
      const y = vDate.getFullYear();
      const m = vDate.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const monthStart = toLocalYmd(new Date(y, m, 1));
      const monthEnd = toLocalYmd(new Date(y, m + 1, 0));
      const label = new Date(y, m, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' });
      const cur = monthMap.get(key) ?? { count: 0, total: 0, label, monthStart, monthEnd };
      cur.count += 1;
      cur.total += voucherTotal(voucher);
      monthMap.set(key, cur);
    });
    return Array.from(monthMap.values()).sort((a, b) => (a.monthStart < b.monthStart ? 1 : -1));
  }, [viewMode, vouchers, filters]);

  const drillDownToMonth = useCallback((monthStart: string, monthEnd: string) => {
    setFilters((prev) => ({ ...prev, fromDate: monthStart, toDate: monthEnd }));
    setViewMode('month');
  }, []);

  const customerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    customers.forEach((acct) => map.set(acct.id, acct.name));
    return map;
  }, [customers]);

  const primaryCustomerName = (voucher: Voucher) => {
    const line = voucher.lines.find((l) => (l.debit ?? 0) > 0);
    return line ? customerNameMap.get(line.ledgerId) ?? line.ledgerId : '—';
  };

  const customerLedgerForVoucher = useCallback(
    (voucher: Voucher): LedgerAccount | undefined => {
      const line = voucher.lines.find((l) => (l.debit ?? 0) > 0);
      if (!line) return undefined;
      return customers.find((acct) => acct.id === line.ledgerId);
    },
    [customers]
  );

  const buildPrintPackageForDialog = useCallback(
    async (voucher: Voucher, input: { pageSize: import('../../../templates/invoice/invoiceTemplatesConfig').InvoicePaperSize }) =>
      buildSalesVoucherInvoiceHtml({
        voucher,
        itemNameMap,
        ledgerNameMap: customerNameMap,
        customerLedger: customerLedgerForVoucher(voucher) ?? null,
        pageSize: input.pageSize,
      }),
    [itemNameMap, customerNameMap, customerLedgerForVoucher]
  );

  const handleShareWhatsApp = useCallback(async () => {
    if (!selectedVoucher) return;
    setWaShareBusy(true);
    try {
      const customerName = primaryCustomerName(selectedVoucher);
      const line = selectedVoucher.lines.find((l) => (l.debit ?? 0) > 0);
      const phone = line
        ? await resolvePartyPhone(line.ledgerId, customerName)
        : null;
      if (!phone?.replace(/\D/g, '')) {
        window.alert(
          `"${customerName}" has no mobile or WhatsApp number.\n\nAdd contact details in Party Master (Masters → Parties).`
        );
        return;
      }
      const total = voucherGrandTotal(selectedVoucher);
      setWaShareDraft({
        customerName,
        mobile: phone,
        amount: total,
        message: buildInvoiceWhatsAppMessage(selectedVoucher.number, selectedVoucher.date, total),
      });
      setWaShareOpen(true);
    } catch (err) {
      console.error('WhatsApp share prepare failed', err);
      window.alert(err instanceof Error ? err.message : 'Could not prepare WhatsApp share.');
    } finally {
      setWaShareBusy(false);
    }
  }, [selectedVoucher]);

  const runInvoiceAction = useCallback(
    async (action: PrintExportAction) => {
      if (!selectedVoucher) return;
      const customerName = primaryCustomerName(selectedVoucher);
      const ledger = customerLedgerForVoucher(selectedVoucher);
      const partyPhone = await resolveVoucherCustomerPhone(selectedVoucher, customerName);
      const phone = partyPhone || ledger?.contactDetails?.phone || undefined;

      const result = await runInvoicePrintExportAction({
        action,
        onNeedPaperSize: () => setPrintSetup({ open: true, action: 'download' }),
        buildPackage: (input) => buildPrintPackageForDialog(selectedVoucher, input),
        whatsAppMeta: {
          invoiceNumber: selectedVoucher.number,
          invoiceDate: selectedVoucher.date,
          grandTotal: voucherGrandTotal(selectedVoucher),
          phone,
        },
      });

      if (!result.ok && result.error) {
        window.alert(result.error);
      }
    },
    [selectedVoucher, customerLedgerForVoucher, buildPrintPackageForDialog]
  );

  const voucherProfit = useCallback(
    (voucher: Voucher) => {
      const lines = voucher.lines.filter((line) => line.itemId && Number(line.quantity || 0) > 0);
      const grossRevenue = lines.reduce((sum, line) => sum + Number(line.credit || line.debit || 0), 0);
      const cost = lines.reduce((sum, line) => {
        const qty = Number(line.quantity || 0);
        const itemId = String(line.itemId || '');
        const estimatedPurchase = Number(itemPurchasePriceMap.get(itemId) || 0);
        return sum + estimatedPurchase * qty;
      }, 0);
      const grossProfit = grossRevenue - cost;
      const grossMarginPct = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;
      return { grossRevenue, cost, grossProfit, grossMarginPct };
    },
    [itemPurchasePriceMap]
  );

  const handleDeleteVoucher = async (voucher: Voucher) => {
    if (!isAdmin) {
      try {
        await approvalService.request({
          section: 'SALES',
          action: 'DELETE_VOUCHER',
          entityType: 'VOUCHER',
          entityId: voucher.id,
          entityLabel: voucher.number,
          reason: 'Delete sales voucher requested by non-admin user',
        });
        alert('Approval request sent to Admin. Once approved, invoice will be deleted.');
      } catch (e) {
        alert((e as Error).message || 'Could not send approval request.');
      }
      return;
    }
    if (!window.confirm(`Delete invoice ${voucher.number}?`)) return;
    try {
      await voucherService.delete(voucher.id);
      if (selectedVoucher?.id === voucher.id) setSelectedVoucher(null);
      await refresh();
    } catch (e) {
      alert((e as Error).message || 'Failed to delete invoice.');
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5}>
        <Typography variant="h5" fontWeight={600}>
          Invoices
        </Typography>
        <Stack direction="row" spacing={1}>
          <FormControlLabel
            control={<Switch size="small" checked={showProfit} onChange={(_, checked) => setShowProfit(checked)} />}
            label={<Typography variant="body2">Show Profit</Typography>}
            sx={{ mr: 0.5 }}
          />
          <Tooltip title="Refresh">
            <IconButton onClick={refresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/vouchers/sales/new')}>
              New Invoice
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="From Date"
                type="date"
                value={filters.fromDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="To Date"
                type="date"
                value={filters.toDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <Select
                displayEmpty
                value={filters.customerId}
                onChange={(e) => setFilters((prev) => ({ ...prev, customerId: e.target.value }))}
                fullWidth
              >
                <MenuItem value="">
                  <em>All Debtors</em>
                </MenuItem>
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </MenuItem>
                ))}
              </Select>
              <Select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as FilterState['status'] }))}
                fullWidth
              >
                <MenuItem value="ALL">All Statuses</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </Select>
            </Stack>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="text" onClick={() => setFilters(createDefaultFilters())}>
                Reset to this month
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error.message}</Alert>}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={6}>
              Loading...
            </Box>
          ) : viewMode === 'year' ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Month</TableCell>
                    <TableCell align="right">Vouchers</TableCell>
                    <TableCell align="right">Sales Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {yearlyMonthRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No yearly month-wise data found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    yearlyMonthRows.map((row) => (
                      <TableRow key={row.monthStart} hover sx={{ cursor: 'pointer' }} onClick={() => drillDownToMonth(row.monthStart, row.monthEnd)}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell align="right">{row.count}</TableCell>
                        <TableCell align="right">₹ {row.total.toFixed(2)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice Date</TableCell>
                  <TableCell>Invoice No.</TableCell>
                  <TableCell>Customer</TableCell>
                  <TableCell align="right">Items</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>EWB</TableCell>
                  {showProfit && <TableCell align="right">Gross Revenue</TableCell>}
                  {showProfit && <TableCell align="right">Cost</TableCell>}
                  {showProfit && <TableCell align="right">Gross Profit</TableCell>}
                  {showProfit && <TableCell align="right">G% Age</TableCell>}
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredVouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showProfit ? 12 : 8} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No invoices found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVouchers
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((voucher) => {
                      const profit = voucherProfit(voucher);
                      return (
                        <TableRow key={voucher.id} hover>
                          <TableCell>{new Date(voucher.date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <VoucherNumberLink
                              voucherId={voucher.id}
                              voucherType="SALES"
                              voucherNumber={voucher.number}
                            />
                          </TableCell>
                          <TableCell>{primaryCustomerName(voucher)}</TableCell>
                          <TableCell align="right">
                            {voucher.lines.filter((line) => Boolean(line.itemId) && Number(line.quantity || 0) > 0).length}
                          </TableCell>
                          <TableCell align="right">₹ {voucherTotal(voucher).toFixed(2)}</TableCell>
                          <TableCell><EwayBillStatusChip eway={voucher.ewayBill} /></TableCell>
                          {showProfit && <TableCell align="right">₹ {profit.grossRevenue.toFixed(2)}</TableCell>}
                          {showProfit && <TableCell align="right">₹ {profit.cost.toFixed(2)}</TableCell>}
                          {showProfit && (
                            <TableCell align="right" sx={{ color: profit.grossProfit >= 0 ? 'success.main' : 'error.main', fontWeight: 600 }}>
                              ₹ {profit.grossProfit.toFixed(2)}
                            </TableCell>
                          )}
                          {showProfit && <TableCell align="right">{profit.grossMarginPct.toFixed(2)} %</TableCell>}
                          <TableCell>
                            <Chip
                              size="small"
                              label={voucher.status}
                              color={voucher.status === 'ACTIVE' ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="View">
                              <IconButton onClick={() => setSelectedVoucher(voucher)}>
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit">
                              <IconButton onClick={() => navigate(`/vouchers/sales/${voucher.id}/edit`)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={isAdmin ? 'Delete (Admin)' : 'Send Delete for Admin Approval'}>
                              <span>
                                <IconButton onClick={() => void handleDeleteVoucher(voucher)} color="error">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedVoucher)} onClose={() => setSelectedVoucher(null)} maxWidth="md" fullWidth>
        <DialogTitle>Invoice Details</DialogTitle>
        <DialogContent dividers>
          {selectedVoucher ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField label="Invoice Number" value={selectedVoucher.number} fullWidth InputProps={{ readOnly: true }} />
                <TextField
                  label="Date"
                  value={new Date(selectedVoucher.date).toLocaleString()}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Stack>
              {selectedVoucher.narration && (
                <TextField label="Narration" value={selectedVoucher.narration} fullWidth multiline InputProps={{ readOnly: true }} />
              )}
              <Typography variant="subtitle1" fontWeight={600}>
                Account Impact
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Ledger</TableCell>
                    <TableCell align="right">Debit</TableCell>
                    <TableCell align="right">Credit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedVoucher.lines.map((line, idx) => (
                    <TableRow key={`${line.ledgerId}-${idx}`}>
                      <TableCell>{customerNameMap.get(line.ledgerId) ?? line.ledgerId}</TableCell>
                      <TableCell align="right">{line.debit?.toFixed(2) ?? '0.00'}</TableCell>
                      <TableCell align="right">{line.credit?.toFixed(2) ?? '0.00'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Typography variant="subtitle1" fontWeight={600}>
                Item Details
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell align="right">Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedVoucher.lines.filter((line) => line.itemId).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        No item lines found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedVoucher.lines
                      .filter((line) => line.itemId)
                      .map((line, idx) => (
                        <TableRow key={`item-${line.itemId}-${idx}`}>
                          <TableCell>{itemNameMap.get(String(line.itemId)) ?? line.itemId}</TableCell>
                          <TableCell align="right">{Number(line.quantity || 0).toFixed(2)}</TableCell>
                          <TableCell align="right">{Number(line.credit || line.debit || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
          <Button onClick={() => setSelectedVoucher(null)}>Close</Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            startIcon={<ShareIcon />}
            onClick={() => void handleShareWhatsApp()}
            disabled={!selectedVoucher || waShareBusy}
          >
            {waShareBusy ? 'Loading…' : 'Share on WhatsApp'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={() => void runInvoiceAction('download')}
            disabled={!selectedVoucher}
          >
            Download PDF
          </Button>
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={() => void runInvoiceAction('print')}
            disabled={!selectedVoucher}
          >
            Print
          </Button>
        </DialogActions>
      </Dialog>

      {selectedVoucher && (
        <PrintExportSetupDialog
          open={printSetup.open}
          action={printSetup.action}
          onClose={() => setPrintSetup((p) => ({ ...p, open: false }))}
          buildPackage={(input) => buildPrintPackageForDialog(selectedVoucher, input)}
        />
      )}

      {waShareDraft ? (
        <WhatsAppReminderPreviewDialog
          open={waShareOpen}
          onClose={() => {
            setWaShareOpen(false);
            setWaShareDraft(null);
          }}
          title="Share Invoice on WhatsApp"
          amountLabel="Invoice Amount"
          customerName={waShareDraft.customerName}
          mobile={waShareDraft.mobile}
          outstandingAmount={waShareDraft.amount}
          initialMessage={waShareDraft.message}
        />
      ) : null}
    </Stack>
  );
};

export default SalesVoucherList;
