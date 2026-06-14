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
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { stockAdjustmentService } from '../../../services/masters/stockAdjustmentService';
import { inventoryItemService } from '../../../services/masters/inventoryItemService';
import { godownService } from '../../../services/masters/godownService';
import { reasonTypeLabel } from '../../../constants/stockAdjustmentReasons';
import { StockAdjustment } from '../../../types/masters';
import { usePermission } from '../../../hooks/usePermission';
import { formatDate } from '../../../utils/formatters';

export default function StockAdjustmentList() {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [rows, setRows] = useState<StockAdjustment[]>([]);
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [godownNames, setGodownNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [adjustments, items, godowns] = await Promise.all([
        stockAdjustmentService.list(),
        inventoryItemService.list({ status: 'ACTIVE' }),
        godownService.list({ includeInactive: false }),
      ]);
      setRows([...adjustments].reverse());
      setItemNames(Object.fromEntries(items.map((i) => [i.id, i.name])));
      setGodownNames(Object.fromEntries(godowns.map((g) => [g.id, g.name])));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => rows, [rows]);

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={800} sx={{ flex: 1 }}>
          Inventory Adjustments
        </Typography>
        <IconButton onClick={() => void load()} aria-label="Refresh">
          <RefreshIcon />
        </IconButton>
        {can('manage-inventory') ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/masters/stock-adjustments/new')}>
            New Adjustment
          </Button>
        ) : null}
      </Stack>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Item</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Qty</TableCell>
              <TableCell>Direction</TableCell>
              <TableCell>Godown</TableCell>
              <TableCell>Reason</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>{formatDate(row.date)}</TableCell>
                <TableCell>{itemNames[row.itemId] ?? row.itemId}</TableCell>
                <TableCell>
                  <Chip label={row.type} size="small" />
                </TableCell>
                <TableCell>{row.quantity}</TableCell>
                <TableCell>
                  {row.direction === 'DECREASE' ? (
                    <Chip label="Decrease" size="small" color="warning" variant="outlined" />
                  ) : (
                    <Chip label="Increase" size="small" color="success" variant="outlined" />
                  )}
                </TableCell>
                <TableCell>{row.godownId ? godownNames[row.godownId] ?? row.godownId : '—'}</TableCell>
                <TableCell>
                  {row.reasonType ? reasonTypeLabel(row.reasonType) : row.notes || row.reason || '—'}
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No stock adjustments recorded yet.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      )}
    </Box>
  );
}
