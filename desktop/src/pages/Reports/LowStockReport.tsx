import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
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
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';
import { useTheme } from '@mui/material/styles';
import { getDashboardTheme, dashboardCardSx } from '../../components/dashboard/dashboardTheme';
import { inventoryItemService } from '../../services/masters/inventoryItemService';
import { listLowStockItems, type LowStockRow } from '../../services/inventory/lowStockService';
import { printLowStockReport } from '../../services/inventory/lowStockPrint';
import { getNormalizedCompanyProfile } from '../../utils/companyProfile';

function downloadLowStockCsv(rows: LowStockRow[]): void {
  const header = 'Item,SKU,Current Stock,Min Stock,Reorder Qty,Status';
  const lines = rows.map(
    (r) =>
      `"${r.name.replace(/"/g, '""')}","${r.sku}",${r.currentStock},${r.threshold},${r.reorderQty},${r.severity}`
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `low-stock-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function severityChip(row: LowStockRow) {
  if (row.severity === 'out') return <Chip size="small" color="error" label="Out of stock" />;
  if (row.severity === 'critical') return <Chip size="small" color="warning" label="Critical" />;
  return <Chip size="small" color="default" label="Low" />;
}

export default function LowStockReport() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dt = getDashboardTheme(theme.palette.mode);
  const [rows, setRows] = useState<LowStockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const items = await inventoryItemService.list({ includeInactive: false });
        setRows(listLowStockItems(items));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const companyName = useMemo(
    () => String(getNormalizedCompanyProfile().businessName || getNormalizedCompanyProfile().name || 'Company'),
    []
  );

  const exportExcel = () => downloadLowStockCsv(rows);

  const pageBg = `linear-gradient(180deg, ${dt.bg} 0%, ${dt.bgSubtle} 100%)`;

  return (
    <Box sx={{ fontFamily: dt.fontFamily, minHeight: '100%', bgcolor: pageBg, px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/dashboard')} sx={{ textTransform: 'none', fontWeight: 600 }}>
          Dashboard
        </Button>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<PrintIcon />} variant="outlined" onClick={() => printLowStockReport(rows, companyName)} disabled={!rows.length}>
            Print Low Stock
          </Button>
          <Button startIcon={<DownloadIcon />} variant="outlined" onClick={exportExcel} disabled={!rows.length}>
            Export Excel
          </Button>
        </Stack>
      </Stack>

      <Typography variant="h5" fontWeight={800} sx={{ mb: 0.5 }}>
        Low Stock Products
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Items at or below alert threshold — sorted by stock quantity.
      </Typography>

      <Paper elevation={0} sx={{ ...dashboardCardSx(dt), p: 2.25 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: dt.bgSubtle }}>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Item</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>SKU</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Current</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Min</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>Reorder Qty</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {loading ? 'Loading…' : 'No low stock items.'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell>{severityChip(row)}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                    <TableCell>{row.sku}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>{row.currentStock}</TableCell>
                    <TableCell align="right">{row.threshold}</TableCell>
                    <TableCell align="right">{row.reorderQty}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
