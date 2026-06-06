import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
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
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { priceListService } from '../../../services/masters/priceListService';
import type { PriceList } from '../../../types/masters';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/formatters';

export default function PriceListList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [rows, setRows] = useState<PriceList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await priceListService.list({ search, status: 'ALL' });
      setRows(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChange = () => void load();
    window.addEventListener('pve:price-lists-changed', onChange);
    return () => window.removeEventListener('pve:price-lists-changed', onChange);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => `${r.name} ${r.description ?? ''}`.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800} sx={{ flex: 1 }}>
          Price Lists
        </Typography>
        <TextField
          size="small"
          placeholder="Search price lists…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <IconButton onClick={() => void load()} aria-label="Refresh">
          <RefreshIcon />
        </IconButton>
        <Button
          variant="outlined"
          startIcon={<AssessmentIcon />}
          onClick={() => navigate('/masters/price-lists/report')}
        >
          Report
        </Button>
        {can('manage-inventory') ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/masters/price-lists/new')}>
            New Price List
          </Button>
        ) : null}
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Effective</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Last used</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.pricingType === 'INCLUSIVE' ? 'GST Inclusive' : 'GST Exclusive'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{row.entries.length}</TableCell>
                <TableCell>
                  {row.effectiveFrom || row.effectiveTo
                    ? `${row.effectiveFrom ? formatDate(row.effectiveFrom) : 'Start'} → ${row.effectiveTo ? formatDate(row.effectiveTo) : 'Open'}`
                    : 'Always'}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={row.status === 'ACTIVE' ? 'success' : 'default'}
                    label={row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  />
                </TableCell>
                <TableCell>{row.lastUsedAt ? formatDate(row.lastUsedAt) : '—'}</TableCell>
                <TableCell align="right">
                  {can('manage-inventory') ? (
                    <IconButton size="small" onClick={() => navigate(`/masters/price-lists/${row.id}/edit`)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No price lists yet. Create Retail, Wholesale, Dealer, or Contractor lists.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
