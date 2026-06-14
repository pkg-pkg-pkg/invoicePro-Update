import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { voucherService } from '../../../services/vouchers/voucherService';
import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { Voucher } from '../../../types/vouchers';
import { LedgerAccount } from '../../../types/masters';
import { useMasterList } from '../../../hooks/useMasterList';
import { usePermission } from '../../../hooks/usePermission';
import { usePermissions } from '../../../hooks/usePermissions';
import { VoucherNumberLink } from '../../../components/Vouchers/VoucherNumberLink';
import { inventoryItemService } from '../../../services/masters/inventoryItemService';
import { approvalService } from '../../../services/approvals/approvalService';
import {
  currentCalendarMonthRange,
  isDateWithinInclusive,
  toLocalYmd,
} from '../../../utils/dateRange';

interface FilterState {
  fromDate: string;
  toDate: string;
  supplierId: string;
  status: 'ALL' | 'ACTIVE' | 'CANCELLED';
}

const createDefaultFilters = (): FilterState => {
  const { from, to } = currentCalendarMonthRange();
  return {
    fromDate: from,
    toDate: to,
    supplierId: '',
    status: 'ALL',
  };
};

const PurchaseVoucherList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { can } = usePermission();
  const { isAdmin } = usePermissions();
  const canCreate = can('create-vouchers');

  const [filters, setFilters] = useState<FilterState>(() => createDefaultFilters());
  const [ledgers, setLedgers] = useState<LedgerAccount[]>([]);
  const [itemNameMap, setItemNameMap] = useState<Map<string, string>>(new Map());
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
    const requestedPeriod = (searchParams.get('viewPeriod') || '').toLowerCase();
    const fyStartRaw = searchParams.get('fyStart');
    if (requestedPeriod !== 'month' && requestedPeriod !== 'year') return;
    if (requestedPeriod === 'month') {
      const { from, to } = currentCalendarMonthRange();
      setFilters((prev) => ({ ...prev, fromDate: from, toDate: to }));
      return;
    }
    const fyStart = Number.parseInt(fyStartRaw || '', 10);
    if (!Number.isFinite(fyStart)) return;
    const from = `${fyStart}-04-01`;
    const to = `${fyStart + 1}-03-31`;
    setFilters((prev) => ({ ...prev, fromDate: from, toDate: to }));
  }, [searchParams]);

  useEffect(() => {
    ledgerAccountService
      .list({ includeInactive: false })
      .then((accounts) => setLedgers(accounts.filter((acct) => acct.isActive !== false)))
      .catch(() => setLedgers([]));
  }, []);

  useEffect(() => {
    inventoryItemService
      .list({ includeInactive: false })
      .then((items) => setItemNameMap(new Map(items.map((item) => [item.id, item.name]))))
      .catch(() => setItemNameMap(new Map()));
  }, []);

  const fetchVouchers = useCallback(async () => {
    const list = await voucherService.list();
    return list.filter((voucher) => voucher.type === 'PURCHASE');
  }, []);

  const { data: vouchers, loading, error, refresh } = useMasterList<Voucher>(fetchVouchers);

  const ledgerNameMap = useMemo(() => {
    const map = new Map<string, string>();
    ledgers.forEach((ledger) => map.set(ledger.id, ledger.name));
    return map;
  }, [ledgers]);

  const effectiveDateRange = useMemo(() => {
    if (filters.fromDate && filters.toDate) {
      return { from: filters.fromDate, to: filters.toDate };
    }
    return currentCalendarMonthRange();
  }, [filters.fromDate, filters.toDate]);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      if (filters.status !== 'ALL' && voucher.status !== filters.status) {
        return false;
      }
      if (!isDateWithinInclusive(voucher.date, effectiveDateRange.from, effectiveDateRange.to)) {
        return false;
      }
      if (filters.supplierId) {
        const supplierLine = voucher.lines.find((line) => (line.credit ?? 0) > 0);
        if (!supplierLine || supplierLine.ledgerId !== filters.supplierId) {
          return false;
        }
      }
      return true;
    });
  }, [effectiveDateRange.from, effectiveDateRange.to, filters, vouchers]);

  const supplierName = (voucher: Voucher) => {
    const line = voucher.lines.find((l) => (l.credit ?? 0) > 0);
    return line ? ledgerNameMap.get(line.ledgerId) ?? line.ledgerId : '—';
  };
  const voucherTotal = (voucher: Voucher) => {
    const debit = voucher.lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const credit = voucher.lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
    return Math.max(debit, credit);
  };

  const handleDeleteVoucher = async (voucher: Voucher) => {
    if (!isAdmin) {
      try {
        await approvalService.request({
          section: 'PURCHASE',
          action: 'DELETE_VOUCHER',
          entityType: 'VOUCHER',
          entityId: voucher.id,
          entityLabel: voucher.number,
          reason: 'Delete purchase voucher requested by non-admin user',
        });
        alert('Approval request sent to Admin. Once approved, voucher will be deleted.');
      } catch (e) {
        alert((e as Error).message || 'Could not send approval request.');
      }
      return;
    }
    if (!window.confirm(`Delete purchase voucher ${voucher.number}?`)) return;
    try {
      await voucherService.delete(voucher.id);
      if (selectedVoucher?.id === voucher.id) setSelectedVoucher(null);
      await refresh();
    } catch (e) {
      alert((e as Error).message || 'Failed to delete purchase voucher.');
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5}>
        <Typography variant="h5" fontWeight={600}>
          Purchase Vouchers
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={refresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/vouchers/purchase/new')}>
              New Purchase Voucher
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
                value={filters.supplierId}
                onChange={(e) => setFilters((prev) => ({ ...prev, supplierId: e.target.value }))}
                fullWidth
              >
                <MenuItem value="">
                  <em>All Creditors</em>
                </MenuItem>
                {ledgers.map((ledger) => (
                  <MenuItem key={ledger.id} value={ledger.id}>
                    {ledger.name}
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
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Voucher No.</TableCell>
                  <TableCell>Creditor</TableCell>
                  <TableCell align="right">Items</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredVouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No purchase vouchers found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredVouchers
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((voucher) => (
                      <TableRow key={voucher.id} hover>
                        <TableCell>{new Date(voucher.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <VoucherNumberLink
                            voucherId={voucher.id}
                            voucherType="PURCHASE"
                            voucherNumber={voucher.number}
                          />
                        </TableCell>
                        <TableCell>{supplierName(voucher)}</TableCell>
                        <TableCell align="right">
                          {voucher.lines.filter((line) => Boolean(line.itemId) && Number(line.quantity || 0) > 0).length}
                        </TableCell>
                        <TableCell align="right">₹ {voucherTotal(voucher).toFixed(2)}</TableCell>
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
                            <IconButton onClick={() => navigate(`/vouchers/purchase/${voucher.id}/edit`)}>
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
                    ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedVoucher)} onClose={() => setSelectedVoucher(null)} maxWidth="md" fullWidth>
        <DialogTitle>Voucher Details</DialogTitle>
        <DialogContent dividers>
          {selectedVoucher ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField label="Number" value={selectedVoucher.number} fullWidth InputProps={{ readOnly: true }} />
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
                Ledger Lines
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
                      <TableCell>{ledgerNameMap.get(line.ledgerId) ?? line.ledgerId}</TableCell>
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
                          <TableCell align="right">{Number(line.debit || line.credit || 0).toFixed(2)}</TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default PurchaseVoucherList;
