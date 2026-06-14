import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { inventoryItemService } from '../../../services/masters/inventoryItemService';
import { stockAdjustmentService } from '../../../services/masters/stockAdjustmentService';
import { itemCategoryService } from '../../../services/masters/itemCategoryService';
import { unitOfMeasureService } from '../../../services/masters/unitOfMeasureService';
import { godownService } from '../../../services/masters/godownService';
import { voucherService } from '../../../services/vouchers/voucherService';
import { InventoryItem } from '../../../types/masters';
import { Voucher } from '../../../types/vouchers';
import { formatCurrency, formatDate } from '../../../utils/formatters';
import { usePermission } from '../../../hooks/usePermission';

type TxRow = {
  id: string;
  date: string;
  type: string;
  number: string;
  quantity: number;
  voucherId: string;
};

export default function InventoryItemDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { can } = usePermission();
  const [tab, setTab] = useState(0);
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [categoryName, setCategoryName] = useState('—');
  const [unitName, setUnitName] = useState('—');
  const [godownLabels, setGodownLabels] = useState<Record<string, string>>({});
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [adjustments, setAdjustments] = useState<Awaited<ReturnType<typeof stockAdjustmentService.list>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [found, categories, units, godowns, adj, vouchers] = await Promise.all([
        inventoryItemService.getById(id),
        itemCategoryService.list(),
        unitOfMeasureService.list(),
        godownService.list({ includeInactive: true }),
        stockAdjustmentService.list({ itemId: id }),
        voucherService.list(),
      ]);
      if (!found) throw new Error('Item not found');
      setItem(found);
      setCategoryName(categories.find((c) => c.id === found.categoryId)?.name ?? '—');
      setUnitName(units.find((u) => u.id === found.unitId)?.symbol ?? units.find((u) => u.id === found.unitId)?.name ?? '—');
      setGodownLabels(Object.fromEntries(godowns.map((g) => [g.id, g.name])));
      setAdjustments(adj);

      const txRows: TxRow[] = [];
      for (const v of vouchers as Voucher[]) {
        v.lines.forEach((line, idx) => {
          if (line.itemId !== id || line.quantity === undefined) return;
          txRows.push({
            id: `${v.id}-${idx}`,
            date: v.date,
            type: v.type,
            number: v.number,
            quantity: Number(line.quantity),
            voucherId: v.id,
          });
        });
      }
      txRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTransactions(txRows);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const overviewFields = useMemo(() => {
    if (!item) return [];
    return [
      { label: 'SKU', value: item.sku },
      { label: 'Barcode', value: item.barcode || '—' },
      { label: 'Category', value: categoryName },
      { label: 'Unit', value: unitName },
      { label: 'GST %', value: String(item.gstRate) },
      { label: 'HSN', value: item.hsnCode || '—' },
      { label: 'Current stock', value: String(item.currentStock) },
      { label: 'Reorder level', value: item.reorderLevel != null ? String(item.reorderLevel) : '—' },
      { label: 'Sale price', value: formatCurrency(item.pricing?.sale ?? 0) },
      { label: 'Purchase price', value: formatCurrency(item.pricing?.purchase ?? 0) },
      { label: 'MRP', value: item.pricing?.mrp != null ? formatCurrency(item.pricing.mrp) : '—' },
      { label: 'Status', value: item.status },
    ];
  }, [item, categoryName, unitName]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !item) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>{error ?? 'Item not found'}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/masters/inventory-items')}>
          Back to items
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/masters/inventory-items')} sx={{ mr: 'auto' }}>
          All items
        </Button>
        {can('manage-inventory') ? (
          <>
            <Button variant="outlined" onClick={() => navigate(`/masters/stock-adjustments/new`)}>
              Adjust stock
            </Button>
            <Button variant="contained" startIcon={<EditIcon />} onClick={() => navigate(`/items?edit=${item.id}`)}>
              Edit item
            </Button>
          </>
        ) : null}
      </Stack>

      <Paper elevation={0} sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h5" fontWeight={800}>
            {item.name}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Chip label={item.sku} size="small" />
            <Chip label={`Stock: ${item.currentStock} ${unitName}`} size="small" color="primary" variant="outlined" />
          </Stack>
        </Box>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Overview" />
          <Tab label="Transactions" />
          <Tab label="History" />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {tab === 0 ? (
            <Grid container spacing={2}>
              {overviewFields.map((f) => (
                <Grid item xs={12} sm={6} md={4} key={f.label}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {f.label}
                  </Typography>
                  <Typography variant="body1" fontWeight={600}>
                    {f.value}
                  </Typography>
                </Grid>
              ))}
              {item.godownStocks && item.godownStocks.length > 0 ? (
                <Grid item xs={12}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Godown-wise stock
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Godown</TableCell>
                        <TableCell>Quantity</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {item.godownStocks.map((gs) => (
                        <TableRow key={gs.godownId}>
                          <TableCell>{godownLabels[gs.godownId] ?? gs.godownId}</TableCell>
                          <TableCell>{gs.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Grid>
              ) : null}
            </Grid>
          ) : null}

          {tab === 1 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Number</TableCell>
                  <TableCell>Qty</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow
                    key={tx.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      const base =
                        tx.type === 'SALES'
                          ? '/vouchers/sales'
                          : tx.type === 'PURCHASE'
                            ? '/vouchers/purchase'
                            : tx.type === 'SALES_RETURN'
                              ? '/vouchers/sales-return'
                              : tx.type === 'PURCHASE_RETURN'
                                ? '/vouchers/purchase-return'
                                : '/vouchers';
                      navigate(`${base}/${tx.voucherId}/edit`);
                    }}
                  >
                    <TableCell>{formatDate(tx.date)}</TableCell>
                    <TableCell>{tx.type}</TableCell>
                    <TableCell>{tx.number}</TableCell>
                    <TableCell>{tx.quantity}</TableCell>
                  </TableRow>
                ))}
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                      No voucher transactions for this item yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          ) : null}

          {tab === 2 ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Qty</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {adjustments.map((adj) => (
                  <TableRow key={adj.id}>
                    <TableCell>{formatDate(adj.date)}</TableCell>
                    <TableCell>{adj.type}</TableCell>
                    <TableCell>{adj.quantity}</TableCell>
                    <TableCell>{adj.reason || '—'}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="caption" color="text.secondary">
                      Created {formatDate(item.createdAt)} · Updated {formatDate(item.updatedAt)}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : null}
        </Box>
      </Paper>
    </Box>
  );
}
