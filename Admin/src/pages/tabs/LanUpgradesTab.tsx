import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  approveMultiUserUpgradeRequest,
  listMultiUserUpgradeRequests,
  rejectMultiUserUpgradeRequest,
} from '../../services/adminApi';

export default function LanUpgradesTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<{ id: string; [k: string]: unknown }>>([]);
  const [acting, setActing] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await listMultiUserUpgradeRequests(''));
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to load requests'));
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            LAN upgrades
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Multi-user LAN upgrade requests (UTR)
          </Typography>
        </Box>
        <Button variant="outlined" onClick={() => void reload()} disabled={loading}>
          Refresh
        </Button>
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Status</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>License</TableCell>
            <TableCell>UTR</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => {
            const id = String(r.id);
            const status = String(r.status ?? '');
            return (
              <TableRow key={id}>
                <TableCell>
                  <Chip size="small" label={status || '—'} color={status === 'pending' ? 'warning' : 'default'} />
                </TableCell>
                <TableCell>{String(r.email ?? '')}</TableCell>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{String(r.licenseKey ?? '')}</TableCell>
                <TableCell>{String(r.utr ?? '')}</TableCell>
                <TableCell align="right">
                  {status === 'pending' && (
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        variant="contained"
                        disabled={acting === id}
                        onClick={async () => {
                          setActing(id);
                          try {
                            await approveMultiUserUpgradeRequest(id);
                            await reload();
                          } catch (e: unknown) {
                            alert(String((e as Error)?.message ?? 'Approve failed'));
                          } finally {
                            setActing(null);
                          }
                        }}
                      >
                        Approve
                      </Button>
                      <Button
                        size="small"
                        color="inherit"
                        disabled={acting === id}
                        onClick={async () => {
                          setActing(id);
                          try {
                            await rejectMultiUserUpgradeRequest(id, 'Rejected by admin');
                            await reload();
                          } catch (e: unknown) {
                            alert(String((e as Error)?.message ?? 'Reject failed'));
                          } finally {
                            setActing(null);
                          }
                        }}
                      >
                        Reject
                      </Button>
                    </Stack>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}
