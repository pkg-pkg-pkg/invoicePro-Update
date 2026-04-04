import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';

import { stockSummaryService, StockSummaryEntry } from '../../services/reports/stockSummaryService';

const formatQty = (value: number) => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StockSummaryReport = () => {
  const [entries, setEntries] = useState<StockSummaryEntry[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await stockSummaryService.list({ includeInactive });
        setEntries(data);
      } catch (err) {
        setError((err as Error).message ?? 'Failed to load stock summary');
      } finally {
        setLoading(false);
      }
    };

    void fetchSummary();
  }, [includeInactive]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return entries;
    return entries.filter((entry) => entry.item.name.toLowerCase().includes(term) || entry.item.sku?.toLowerCase().includes(term));
  }, [entries, search]);

  const lowStockCount = filteredEntries.filter((entry) => entry.belowReorder).length;

  const toggleRow = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <TextField
              placeholder="Search items"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2">Include inactive</Typography>
              <Switch checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} mb={2}>
            <Typography variant="h6">Stock Summary</Typography>
            <Stack direction="row" spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Items: {filteredEntries.length}
              </Typography>
              <Typography variant="body2" color={lowStockCount ? 'warning.main' : 'text.secondary'}>
                Low stock: {lowStockCount}
              </Typography>
            </Stack>
          </Stack>

          {loading ? (
            <Box display="flex" justifyContent="center" py={6}>
              Loading...
            </Box>
          ) : filteredEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No items match the selected filters.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={48}></TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">SKU</TableCell>
                  <TableCell align="right">Total Stock</TableCell>
                  <TableCell align="right">Reorder Level</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredEntries.map((entry) => {
                  const isExpanded = expanded[entry.item.id] ?? false;
                  return (
                    <>
                      <TableRow key={entry.item.id} hover>
                        <TableCell>
                          {entry.godowns.length > 0 ? (
                            <IconButton size="small" onClick={() => toggleRow(entry.item.id)}>
                              {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {entry.item.name}
                          </Typography>
                          {entry.item.categoryId && (
                            <Typography variant="caption" color="text.secondary">
                              Category: {entry.item.categoryId}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{entry.item.sku ?? '—'}</TableCell>
                        <TableCell align="right">{formatQty(entry.totalQuantity)}</TableCell>
                        <TableCell align="right">
                          {entry.item.reorderLevel !== null && entry.item.reorderLevel !== undefined
                            ? formatQty(entry.item.reorderLevel)
                            : '—'}
                        </TableCell>
                        <TableCell>
                          {entry.belowReorder ? (
                            <Chip label="Low Stock" color="warning" size="small" />
                          ) : (
                            <Chip label="Healthy" color="success" size="small" />
                          )}
                        </TableCell>
                      </TableRow>
                      {entry.godowns.length > 0 && (
                        <TableRow key={`${entry.item.id}-godowns`}>
                          <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                              <Box px={4} py={2} bgcolor="grey.50">
                                <Typography variant="subtitle2" gutterBottom>
                                  Godown-wise stock
                                </Typography>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Godown</TableCell>
                                      <TableCell align="right">Quantity</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {entry.godowns.map((godown) => (
                                      <TableRow key={godown.godownId}>
                                        <TableCell>{godown.godownName ?? godown.godownId}</TableCell>
                                        <TableCell align="right">{formatQty(godown.quantity)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
};

export default StockSummaryReport;
