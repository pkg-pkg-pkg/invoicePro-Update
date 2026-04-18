import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Grid,
  Paper,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import type { Party } from '../types/party';
import { partyService } from '../services/masters/partyService';

type PartyType = 'customer' | 'supplier';

type PartyOption = { id: string; name: string; ledgerId: string };

export default function PartyLedgerReport() {
  const navigate = useNavigate();

  const [partyType, setPartyType] = useState<PartyType>('customer');
  const [customers, setCustomers] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Party[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);

  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  const refreshLists = useCallback(async () => {
    setLoadingLists(true);
    setLoadError(null);
    try {
      const [buyers, sellers] = await Promise.all([
        partyService.listForSales(),
        partyService.listForPurchase(),
      ]);
      setCustomers(buyers);
      setSuppliers(sellers);
    } catch (e) {
      setLoadError((e as Error).message ?? 'Failed to load parties');
      setCustomers([]);
      setSuppliers([]);
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    void refreshLists();
  }, [refreshLists]);

  const options: PartyOption[] = useMemo(() => {
    const list = partyType === 'customer' ? customers : suppliers;
    return (list || []).map((p) => ({
      id: p.id,
      name: p.name || p.id,
      ledgerId: String(p.ledgerId ?? '').trim(),
    }));
  }, [partyType, customers, suppliers]);

  const selected = options.find((o) => o.id === selectedPartyId) ?? null;

  const openLedger = () => {
    if (!selectedPartyId || !selected?.ledgerId) {
      return;
    }
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);
    const q = params.toString();
    const path = `/parties/party-ledger/${encodeURIComponent(selected.ledgerId)}`;
    navigate(q ? `${path}?${q}` : path);
  };

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Ledger Report
      </Typography>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          {loadError}
        </Alert>
      )}

      <Paper sx={{ p: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Party Type</InputLabel>
              <Select
                label="Party Type"
                value={partyType}
                onChange={(e) => {
                  setPartyType(e.target.value as PartyType);
                  setSelectedPartyId('');
                }}
              >
                <MenuItem value="customer">Customer</MenuItem>
                <MenuItem value="supplier">Supplier</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} md={5}>
            <Autocomplete
              options={options}
              value={selected}
              getOptionLabel={(o) => o.name}
              isOptionEqualToValue={(a, b) => a.id === b.id}
              onChange={(_e, v) => setSelectedPartyId(v?.id ?? '')}
              loading={loadingLists}
              noOptionsText={loadingLists ? 'Loading…' : 'No parties — add them in Party Master'}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label={partyType === 'customer' ? 'Customer' : 'Supplier'}
                  helperText={
                    !loadingLists && options.length === 0
                      ? 'Party list is empty. Create buyers/suppliers under Party Master.'
                      : undefined
                  }
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              label="From Date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} md={2}>
            <TextField
              label="To Date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={() => {
                  setSelectedPartyId('');
                  setFromDate('');
                  setToDate('');
                }}
              >
                Clear
              </Button>
              <Button
                variant="contained"
                disabled={!selectedPartyId || !selected?.ledgerId}
                onClick={openLedger}
              >
                View Ledger
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
