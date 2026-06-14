import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
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
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useNavigate } from 'react-router-dom';

import { voucherService } from '../../../services/vouchers/voucherService';
import { Voucher } from '../../../types/vouchers';
import { useMasterList } from '../../../hooks/useMasterList';
import { usePermission } from '../../../hooks/usePermission';

type VoucherStatus = 'ALL' | 'ACTIVE' | 'CANCELLED';

const JournalVoucherList = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const canCreate = can('create-vouchers');
  const canView = can('view-vouchers');

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [status, setStatus] = useState<VoucherStatus>('ALL');

  const fetchVouchers = useCallback(async () => {
    const list = await voucherService.list();
    return list.filter((voucher) => voucher.type === 'JOURNAL');
  }, []);

  const { data: vouchers, loading, error, refresh } = useMasterList<Voucher>(fetchVouchers);

  const filteredVouchers = useMemo(() => {
    return vouchers.filter((voucher) => {
      if (status !== 'ALL' && voucher.status !== status) return false;
      if (fromDate && new Date(voucher.date) < new Date(fromDate)) return false;
      if (toDate && new Date(voucher.date) > new Date(toDate)) return false;
      return true;
    });
  }, [vouchers, fromDate, toDate, status]);

  const handleDelete = async (voucher: Voucher) => {
    if (!window.confirm(`Delete journal voucher "${voucher.number}"?`)) return;
    try {
      await voucherService.delete(voucher.id);
      await refresh();
    } catch (e) {
      alert((e as Error).message ?? 'Failed to delete');
    }
  };

  if (!canView) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">You do not have permission to view journal vouchers.</Alert>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', md: 'center' }}
        spacing={1.5}
      >
        <Typography variant="h5" fontWeight={600}>
          Journal Vouchers
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <span style={{ display: 'inline-flex' }}>
              <IconButton onClick={refresh} disabled={loading}>
                <RefreshIcon />
              </IconButton>
            </span>
          </Tooltip>
          {canCreate && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/vouchers/journal/new')}>
              New Journal Voucher
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
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="To Date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <Select value={status} onChange={(e) => setStatus(e.target.value as VoucherStatus)} fullWidth>
                <MenuItem value="ALL">All Statuses</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="CANCELLED">Cancelled</MenuItem>
              </Select>
            </Stack>
            <Stack direction="row" justifyContent="flex-end">
              <Button variant="text" onClick={() => { setFromDate(''); setToDate(''); setStatus('ALL'); }}>
                Clear filters
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error.message}</Alert>}

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 2 }}>
            {loading ? (
              <Typography color="text.secondary">Loading...</Typography>
            ) : filteredVouchers.length === 0 ? (
              <Typography color="text.secondary">No journal vouchers found</Typography>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Voucher No.</TableCell>
                    <TableCell>Narration</TableCell>
                    <TableCell align="right">Lines</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredVouchers
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .map((voucher) => (
                      <TableRow key={voucher.id} hover>
                        <TableCell>{new Date(voucher.date).toLocaleDateString()}</TableCell>
                        <TableCell>{voucher.number}</TableCell>
                        <TableCell>{voucher.narration ?? '—'}</TableCell>
                        <TableCell align="right">{voucher.lines.length}</TableCell>
                        <TableCell>{voucher.status}</TableCell>
                        <TableCell align="right">
                          {canCreate ? (
                            <IconButton onClick={() => handleDelete(voucher)} size="small" color="error">
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
};

export default JournalVoucherList;

