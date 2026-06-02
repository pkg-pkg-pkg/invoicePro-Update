import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
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
import { alpha, useTheme } from '@mui/material/styles';
import { AppDispatch, RootState } from '../../store';
import { fetchLowStock } from '../../store/slices/dashboardSlice';
import { DASHBOARD_THEME, dashboardCardSx } from '../../components/dashboard/dashboardTheme';
import { formatCurrency } from '../../utils/formatters';

export default function LowStockReport() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { lowStock, loading } = useSelector((s: RootState) => s.dashboard);
  const isDark = theme.palette.mode === 'dark';

  useEffect(() => {
    dispatch(fetchLowStock());
  }, [dispatch]);

  const rows = useMemo(() => lowStock ?? [], [lowStock]);

  const pageBg = isDark
    ? `linear-gradient(165deg, ${alpha('#0F172A', 0.99)} 0%, ${alpha('#0B1220', 0.99)} 100%)`
    : `linear-gradient(180deg, ${DASHBOARD_THEME.bg} 0%, ${DASHBOARD_THEME.bgSubtle} 100%)`;

  return (
    <Box
      sx={{
        fontFamily: DASHBOARD_THEME.fontFamily,
        minHeight: '100%',
        bgcolor: pageBg,
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/dashboard')}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          Dashboard
        </Button>
      </Stack>

      <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em', mb: 0.5 }}>
        Low Stock Products
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
        Items at or below reorder level — current stock ≤ minimum stock.
      </Typography>

      <Paper elevation={0} sx={{ ...dashboardCardSx(isDark), p: 2.25 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: isDark ? alpha('#fff', 0.04) : DASHBOARD_THEME.bgSubtle }}>
                <TableCell sx={{ fontWeight: 700 }}>Product Name</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Current Stock
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Minimum Stock
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Required Quantity
                </TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Supplier</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Action
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    {loading ? 'Loading…' : 'No low stock items. All products are above reorder level.'}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
                    <TableCell align="right" sx={{ color: DASHBOARD_THEME.status.warn, fontWeight: 700 }}>
                      {row.currentStock}
                    </TableCell>
                    <TableCell align="right">{row.reorderLevel}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {row.requiredQuantity ?? Math.max(0, row.reorderLevel - row.currentStock)}
                    </TableCell>
                    <TableCell>{row.supplier || '—'}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => navigate(`/masters/inventory-items/${encodeURIComponent(row.id)}/edit`)}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                      >
                        Open
                      </Button>
                    </TableCell>
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
