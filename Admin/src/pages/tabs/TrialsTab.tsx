import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { listAllTrials } from '../../services/trialAdminService';
import TrialsStatsCards from '../../components/trials/TrialsStatsCards';
import TrialsTable from '../../components/trials/TrialsTable';
import {
  exportTrialsCsv,
  trialStatus,
  tsToMs,
  type TrialRecord,
} from '../../utils/trialHelpers';

type StatusFilter = 'all' | 'active' | 'expired' | 'converted';

export default function TrialsTab() {
  const [rows, setRows] = useState<TrialRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [acting, setActing] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAllTrials());
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to load trials'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const states = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const s = String(r.location?.state ?? '').trim();
      if (s) set.add(s);
    }
    return Array.from(set).sort();
  }, [rows]);

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();
    let active = 0;
    let expired = 0;
    let converted = 0;
    let todaySignups = 0;
    for (const r of rows) {
      const st = trialStatus(r);
      if (st === 'Active') active += 1;
      else if (st === 'Expired') expired += 1;
      else converted += 1;
      const created = tsToMs(r.created_at);
      if (created != null && created >= todayMs) todaySignups += 1;
    }
    return { total: rows.length, active, expired, converted, todaySignups };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.replace(/\D/g, '');
    const startMs = startDate ? new Date(startDate).getTime() : null;
    const endMs = endDate ? new Date(endDate).getTime() + 86400000 : null;
    return rows.filter((r) => {
      if (q && !r.mobile_no.includes(q)) return false;
      if (stateFilter && String(r.location?.state ?? '') !== stateFilter) return false;
      const st = trialStatus(r);
      if (statusFilter === 'active' && st !== 'Active') return false;
      if (statusFilter === 'expired' && st !== 'Expired') return false;
      if (statusFilter === 'converted' && st !== 'Converted') return false;
      const created = tsToMs(r.created_at);
      if (startMs != null && (created == null || created < startMs)) return false;
      if (endMs != null && (created == null || created >= endMs)) return false;
      return true;
    });
  }, [rows, search, stateFilter, statusFilter, startDate, endDate]);

  const runAction = async (mobile: string, label: string, fn: () => Promise<void>) => {
    setActing(`${mobile}:${label}`);
    try {
      await fn();
      await reload();
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Action failed'));
    } finally {
      setActing(null);
    }
  };

  return (
    <Stack spacing={2}>
      <TrialsStatsCards
        total={stats.total}
        active={stats.active}
        expired={stats.expired}
        converted={stats.converted}
        todaySignups={stats.todaySignups}
      />

      <Paper sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={800}>
              Trial Users
            </Typography>
            <Typography variant="body2" color="text.secondary">
              7-day desktop trials — OTP verified signups
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => exportTrialsCsv(filtered)} disabled={!filtered.length}>
              Export Excel
            </Button>
            <Button variant="outlined" onClick={() => void reload()} disabled={loading}>
              Refresh
            </Button>
          </Stack>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField
            size="small"
            label="Search mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 160 }}
          />
          <TextField
            select
            size="small"
            label="State"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="">All states</MenuItem>
            {states.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="active">Active</MenuItem>
            <MenuItem value="expired">Expired</MenuItem>
            <MenuItem value="converted">Converted</MenuItem>
          </TextField>
          <TextField
            size="small"
            type="date"
            label="From"
            InputLabelProps={{ shrink: true }}
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            InputLabelProps={{ shrink: true }}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </Stack>

        <TrialsTable rows={filtered} loading={loading} acting={acting} onAction={runAction} />
      </Paper>
    </Stack>
  );
}
