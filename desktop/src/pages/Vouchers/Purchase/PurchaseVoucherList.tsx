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
import { useNavigate } from 'react-router-dom';

import { voucherService } from '../../../services/vouchers/voucherService';
import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { Voucher } from '../../../types/vouchers';
import { LedgerAccount } from '../../../types/masters';
import { useMasterList } from '../../../hooks/useMasterList';
import { usePermission } from '../../../hooks/usePermission';

interface FilterState {
  fromDate: string;
  toDate: string;
  supplierId: string;
  status: 'ALL' | 'ACTIVE' | 'CANCELLED';
}

const initialFilters: FilterState = {
  fromDate: '',
  toDate: '',
  supplierId: '',
  status: 'ALL',
};

const PurchaseVoucherList = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');

  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [ledgers, setLedgers] = useState<LedgerAccount[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);

  useEffect(() => {
    ledgerAccountService
      .list({ includeInactive: false })
      .then((accounts) => setLedgers(accounts.filter((acct) => acct.isActive !== false)))
      .catch(() => setLedgers([]));
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

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      if (filters.status !== 'ALL' && voucher.status !== filters.status) {
        return false;
      }
      if (filters.fromDate && new Date(voucher.date) < new Date(filters.fromDate)) {
        return false;
      }
      if (filters.toDate && new Date(voucher.date) > new Date(filters.toDate)) {
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
  }, [filters, vouchers]);

  const supplierName = (voucher: Voucher) => {
    const line = voucher.lines.find((l) => (l.credit ?? 0) > 0);
    return line ? ledgerNameMap.get(line.ledgerId) ?? line.ledgerId : '—';
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
                  <em>All Suppliers</em>
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
              <Button variant="text" onClick={() => setFilters(initialFilters)}>
                Clear filters
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
                  <TableCell>Supplier</TableCell>
                  <TableCell align="right">Lines</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredVouchers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
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
                        <TableCell>{voucher.number}</TableCell>
                        <TableCell>{supplierName(voucher)}</TableCell>
                        <TableCell align="right">{voucher.lines.length}</TableCell>
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
            </Stack>
          ) : null}
        </DialogContent>
      </Dialog>
    </Stack>
  );
};

export default PurchaseVoucherList;
