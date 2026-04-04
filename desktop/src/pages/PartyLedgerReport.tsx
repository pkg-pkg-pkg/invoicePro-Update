import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  Alert,
} from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import type { AppDispatch, RootState } from '../store';
import { fetchCustomers, fetchSuppliers, clearError } from '../store/slices/partySlice';

type PartyType = 'customer' | 'supplier';

export default function PartyLedgerReport() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();

  const { customers, suppliers, loading, error } = useSelector((state: RootState) => state.parties);

  const [partyType, setPartyType] = useState<PartyType>('customer');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  useEffect(() => {
    dispatch(fetchCustomers());
    dispatch(fetchSuppliers());
  }, [dispatch]);

  const options = useMemo(() => {
    const list = partyType === 'customer' ? customers : suppliers;
    return (list || []).map((p) => ({ id: String((p as any).id ?? ''), name: String((p as any).name ?? '') }));
  }, [partyType, customers, suppliers]);

  const selected = options.find((o) => o.id === selectedPartyId) ?? null;

  const openLedger = () => {
    if (!selectedPartyId) return;

    const base = partyType === 'customer' ? `/customers/ledger/${encodeURIComponent(selectedPartyId)}` : `/suppliers/ledger/${encodeURIComponent(selectedPartyId)}`;
    const params = new URLSearchParams();
    if (fromDate) params.set('fromDate', fromDate);
    if (toDate) params.set('toDate', toDate);

    const url = params.toString() ? `${base}?${params.toString()}` : base;
    navigate(url);
  };

  return (
    <Box sx={{ p: 1 }}>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Ledger Report
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => dispatch(clearError())}>
          {error}
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
              onChange={(_e, v) => setSelectedPartyId(v?.id ?? '')}
              loading={loading}
              renderInput={(params) => (
                <TextField {...params} size="small" label={partyType === 'customer' ? 'Customer' : 'Supplier'} />
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
              <Button variant="contained" disabled={!selectedPartyId} onClick={openLedger}>
                View Ledger
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}
