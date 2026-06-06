import { useCallback, useEffect, useState } from 'react';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { priceListService, type PriceListReportRow } from '../../../services/masters/priceListService';
import { formatDate } from '../../../utils/formatters';

export default function PriceListReport() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<PriceListReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await priceListService.reportRows());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => navigate('/masters/price-lists')} aria-label="Back">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h5" fontWeight={800} sx={{ flex: 1 }}>
          Price List Report
        </Typography>
        <IconButton onClick={() => void load()} aria-label="Refresh">
          <RefreshIcon />
        </IconButton>
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
              <TableCell>Price list</TableCell>
              <TableCell>Pricing</TableCell>
              <TableCell align="right">Item count</TableCell>
              <TableCell>Effective from</TableCell>
              <TableCell>Effective to</TableCell>
              <TableCell>Last used</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography fontWeight={700}>{row.name}</Typography>
                  {row.description ? (
                    <Typography variant="caption" color="text.secondary" display="block">
                      {row.description}
                    </Typography>
                  ) : null}
                </TableCell>
                <TableCell>
                  {row.pricingType === 'INCLUSIVE' ? 'GST Inclusive' : 'GST Exclusive'}
                </TableCell>
                <TableCell align="right">{row.itemCount}</TableCell>
                <TableCell>{row.effectiveFrom ? formatDate(row.effectiveFrom) : '—'}</TableCell>
                <TableCell>{row.effectiveTo ? formatDate(row.effectiveTo) : '—'}</TableCell>
                <TableCell>{row.lastUsedAt ? formatDate(row.lastUsedAt) : 'Never'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    color={row.status === 'ACTIVE' ? 'success' : 'default'}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate('/masters/price-lists')}>
        Back to price lists
      </Button>
    </Box>
  );
}
