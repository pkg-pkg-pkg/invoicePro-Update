import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Menu,
  MenuItem,
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
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CloseIcon from '@mui/icons-material/Close';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import TuneIcon from '@mui/icons-material/Tune';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import type { InventoryItem, ItemCategory, ItemHistoryEntry, UnitOfMeasure, Godown } from '../../types/masters';
import type { ItemTransactionRow } from '../../services/items/itemsApi';
import type { StockAdjustment } from '../../types/masters';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getItemsModuleTokens } from '../../theme/itemsModuleTheme';

type Props = {
  item: InventoryItem | null;
  categoryName: string;
  godowns: Godown[];
  unitName: string;
  loading?: boolean;
  transactions: ItemTransactionRow[];
  history: ItemHistoryEntry[];
  adjustments: StockAdjustment[];
  canManage: boolean;
  onEdit: () => void;
  onClose: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  onAdjustStock: () => void;
};

function FieldRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const tok = getItemsModuleTokens(theme);
  return (
    <>
      <Grid item xs={12} sm={5}>
        <Typography variant="body2" color={tok.textMuted} fontWeight={600}>
          {label}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={7}>
        <Typography variant="body2" fontWeight={600} color={tok.text}>
          {value || '—'}
        </Typography>
      </Grid>
    </>
  );
}

const ITEM_TYPE_LABEL: Record<string, string> = {
  SALES: 'Sales Items',
  PURCHASE: 'Purchase Items',
  BOTH: 'Sales & Purchase Items',
};

const TAX_LABEL: Record<string, string> = {
  TAXABLE: 'Taxable',
  NON_TAXABLE: 'Non-Taxable',
  EXEMPT: 'Tax Exempt',
};

export function ItemDetailPanel({
  item,
  categoryName,
  godowns,
  unitName,
  loading,
  transactions,
  history,
  adjustments,
  canManage,
  onEdit,
  onClose,
  onDuplicate,
  onDelete,
  onToggleStatus,
  onAdjustStock,
}: Props) {
  const theme = useTheme();
  const tok = getItemsModuleTokens(theme);
  const navigate = useNavigate();
  const [tab, setTab] = useState(0);
  const [moreAnchor, setMoreAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => setTab(0), [item?.id]);

  const overviewFields = useMemo(() => {
    if (!item) return [];
    return [
      { label: 'Item Type', value: ITEM_TYPE_LABEL[item.itemType ?? 'BOTH'] ?? 'Both' },
      { label: 'SKU', value: item.sku },
      { label: 'HSN Code', value: item.hsnCode ?? '—' },
      { label: 'Unit', value: unitName },
      { label: 'UPC', value: item.upc ?? item.barcode ?? '—' },
      { label: 'EAN', value: item.ean ?? '—' },
      { label: 'ISBN', value: item.isbn ?? '—' },
      { label: 'Created Source', value: item.createdSource ?? 'User' },
      { label: 'Tax', value: TAX_LABEL[item.taxClass ?? 'TAXABLE'] ?? 'Taxable' },
      { label: 'Category', value: categoryName },
      { label: 'GST Rate', value: `${item.gstRate}%` },
      { label: 'Selling Price', value: formatCurrency(item.pricing?.sale ?? 0) },
      { label: 'Purchase Price', value: formatCurrency(item.pricing?.purchase ?? 0) },
      { label: 'Current Stock', value: String(item.currentStock) },
      { label: 'Status', value: item.status },
      { label: 'Description', value: item.description ?? '—' },
    ];
  }, [item, categoryName, unitName]);

  if (!item) {
    return (
      <Box
        sx={{
          flex: 1,
          border: `1px solid ${tok.border}`,
          borderRadius: `${tok.radius}px`,
          bgcolor: tok.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          color: tok.textMuted,
        }}
      >
        <Typography>Select an item from the list to view details</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        flex: 1,
        border: `1px solid ${tok.border}`,
        borderRadius: `${tok.radius}px`,
        bgcolor: tok.surface,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 400,
        height: { lg: 'calc(100vh - 220px)' },
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${tok.border}` }}
      >
        <Box>
          <Typography variant="h5" fontWeight={800} color={tok.text}>
            {item.name}
          </Typography>
          <Chip label={item.sku} size="small" sx={{ mt: 0.75, fontWeight: 600 }} />
        </Box>
        <Stack direction="row" spacing={0.5}>
          {canManage ? (
            <IconButton size="small" onClick={onEdit} title="Edit">
              <EditOutlinedIcon fontSize="small" />
            </IconButton>
          ) : null}
          <Button size="small" variant="outlined" endIcon={<MoreHorizIcon />} onClick={(e) => setMoreAnchor(e.currentTarget)}>
            More
          </Button>
          <IconButton size="small" onClick={onClose} title="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
            <MenuItem onClick={() => { onDuplicate(); setMoreAnchor(null); }}>
              <ContentCopyIcon fontSize="small" sx={{ mr: 1 }} /> Duplicate
            </MenuItem>
            <MenuItem onClick={() => { onToggleStatus(); setMoreAnchor(null); }}>
              Mark as {item.status === 'ACTIVE' ? 'Inactive' : 'Active'}
            </MenuItem>
            <MenuItem onClick={() => { onAdjustStock(); setMoreAnchor(null); }}>
              <TuneIcon fontSize="small" sx={{ mr: 1 }} /> Inventory adjustment
            </MenuItem>
            {canManage ? (
              <MenuItem onClick={() => { onDelete(); setMoreAnchor(null); }}>
                <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Delete
              </MenuItem>
            ) : null}
          </Menu>
        </Stack>
      </Stack>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: `1px solid ${tok.border}` }}>
        <Tab label="Overview" sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab label="Transactions" sx={{ textTransform: 'none', fontWeight: 700 }} />
        <Tab label="History" sx={{ textTransform: 'none', fontWeight: 700 }} />
      </Tabs>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} />
          </Box>
        ) : null}

        {tab === 0 && !loading ? (
          <Grid container spacing={2}>
            {overviewFields.map((f) => (
              <FieldRow key={f.label} label={f.label} value={f.value} />
            ))}
            <Grid item xs={12}>
              <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1 }}>
                Stock by Godown
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Godown</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(item.godownStocks?.length ? item.godownStocks : [{ godownId: '', quantity: item.currentStock ?? 0 }]).map((row, idx) => (
                    <TableRow key={`${row.godownId}-${idx}`}>
                      <TableCell>{godowns.find((g) => g.id === row.godownId)?.name ?? 'Primary Warehouse'}</TableCell>
                      <TableCell align="right">{row.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Grid>
            {item.images?.[0] ? (
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
                <Box component="img" src={item.images[0]} alt={item.name} sx={{ maxWidth: 200, borderRadius: 1, border: `1px solid ${tok.border}` }} />
              </Grid>
            ) : null}
          </Grid>
        ) : null}

        {tab === 1 && !loading ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Number</TableCell>
                <TableCell align="right">Qty</TableCell>
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
                      tx.type === 'SALES' ? '/vouchers/sales' :
                      tx.type === 'PURCHASE' ? '/vouchers/purchase' :
                      tx.type === 'SALES_RETURN' ? '/vouchers/sales-return' : '/vouchers';
                    navigate(`${base}/${tx.voucherId}/edit`);
                  }}
                >
                  <TableCell>{formatDate(tx.date)}</TableCell>
                  <TableCell>{tx.type}</TableCell>
                  <TableCell>{tx.number}</TableCell>
                  <TableCell align="right">{tx.quantity}</TableCell>
                </TableRow>
              ))}
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, color: tok.textMuted }}>
                    No transactions for this item yet.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        ) : null}

        {tab === 2 && !loading ? (
          <Stack spacing={2}>
            <Typography variant="subtitle2" fontWeight={800}>
              Change log
            </Typography>
            {history.map((h) => (
              <Box key={h.id} sx={{ py: 1, borderBottom: `1px solid ${tok.border}` }}>
                <Typography variant="body2" fontWeight={600}>{h.summary}</Typography>
                <Typography variant="caption" color={tok.textMuted}>
                  {formatDate(h.createdAt)} · {h.userLabel ?? 'User'} · {h.action}
                </Typography>
              </Box>
            ))}
            {history.length === 0 ? (
              <Typography variant="body2" color={tok.textMuted}>No history recorded yet.</Typography>
            ) : null}
            {adjustments.length > 0 ? (
              <>
                <Typography variant="subtitle2" fontWeight={800} sx={{ pt: 1 }}>
                  Stock adjustments
                </Typography>
                {adjustments.map((a) => (
                  <Box key={a.id} sx={{ py: 0.75 }}>
                    <Typography variant="body2">
                      {a.type} · Qty {a.quantity} · {a.reason || '—'}
                    </Typography>
                    <Typography variant="caption" color={tok.textMuted}>{formatDate(a.date)}</Typography>
                  </Box>
                ))}
              </>
            ) : null}
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
