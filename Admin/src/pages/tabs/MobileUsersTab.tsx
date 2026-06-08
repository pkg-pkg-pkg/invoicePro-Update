import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Paper,
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
import {
  approveMobileUserRequest,
  listMobileUserRequests,
  listMobileUsersAdmin,
  rejectMobileUserRequest,
  transferMobileUserDevice,
} from '../../services/adminApi';

export default function MobileUsersTab() {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requests, setRequests] = useState<Array<{ id: string; [k: string]: unknown }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; [k: string]: unknown }>>([]);
  const [acting, setActing] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await listMobileUserRequests(''));
      setUsers(await listMobileUsersAdmin());
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to load mobile users'));
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
            Mobile app users
          </Typography>
          <Typography variant="body2" color="text.secondary">
            ₹599/year per user — approve UTR, share PIN, manage device binding
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
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Pending purchases" />
        <Tab label="Active users" />
      </Tabs>

      {tab === 0 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Employee</TableCell>
              <TableCell>Mobile</TableCell>
              <TableCell>Owner</TableCell>
              <TableCell>UTR</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map((r) => {
              const id = String(r.id);
              const status = String(r.status ?? '');
              return (
                <TableRow key={id}>
                  <TableCell>
                    <Chip size="small" label={status || '—'} color={status === 'pending' ? 'warning' : 'default'} />
                  </TableCell>
                  <TableCell>{String(r.userEmail ?? '')}</TableCell>
                  <TableCell>{String(r.mobileNumber ?? '')}</TableCell>
                  <TableCell>{String(r.ownerEmail ?? '')}</TableCell>
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
                              const res = await approveMobileUserRequest(id);
                              alert(`Approved. Share PIN with employee: ${String(res.initialPin ?? '—')}`);
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
                          disabled={acting === id}
                          onClick={async () => {
                            setActing(id);
                            try {
                              await rejectMobileUserRequest(id, 'Rejected by admin');
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
      )}

      {tab === 1 && (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Mobile</TableCell>
              <TableCell>License</TableCell>
              <TableCell>Device ID</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((u) => {
              const id = String(u.id);
              return (
                <TableRow key={id}>
                  <TableCell>{String(u.displayName || u.userEmail)}</TableCell>
                  <TableCell>{String(u.mobileNumber ?? '')}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{String(u.licenseKey ?? '')}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>
                    {u.deviceId ? String(u.deviceId).slice(0, 16) + '…' : '—'}
                  </TableCell>
                  <TableCell>{String(u.status ?? 'active')}</TableCell>
                  <TableCell align="right">
                    {!!u.deviceId && (
                      <Button
                        size="small"
                        disabled={acting === id}
                        onClick={async () => {
                          setActing(id);
                          try {
                            await transferMobileUserDevice(id);
                            await reload();
                          } catch (e: unknown) {
                            alert(String((e as Error)?.message ?? 'Transfer failed'));
                          } finally {
                            setActing(null);
                          }
                        }}
                      >
                        Transfer device
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}
