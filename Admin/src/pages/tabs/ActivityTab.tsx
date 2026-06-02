import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { listAuditEvents } from '../../services/adminApi';

export default function ActivityTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<{ id: string; [k: string]: unknown }>>([]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listAuditEvents(150));
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to load activity'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return (
    <Paper sx={{ p: 2.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            Activity
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Recent license audit events
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => void reload()} disabled={loading}>
          Refresh
        </Button>
      </Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Time</TableCell>
            <TableCell>Type</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>License</TableCell>
            <TableCell>OK</TableCell>
            <TableCell>Reason</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center">
                {loading ? 'Loading…' : 'No events'}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((r) => (
              <TableRow key={String(r.id)}>
                <TableCell>{String(r.createdAt ?? '—')}</TableCell>
                <TableCell>{String(r.type ?? '')}</TableCell>
                <TableCell>{String(r.email ?? '')}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{String(r.licenseKey ?? '')}</TableCell>
                <TableCell>{r.ok ? 'yes' : 'no'}</TableCell>
                <TableCell>{String(r.reason ?? '')}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Paper>
  );
}
