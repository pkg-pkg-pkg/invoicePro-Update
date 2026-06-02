import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { LicenseRecord } from '../../utils/licenseHelpers';
import {
  deviceCount,
  firstActivationMs,
  formatTs,
  generatedAtMs,
  isLicenseActive,
  isPendingGeneratedLicense,
  licenseStatusLabel,
  maskKey,
} from '../../utils/licenseHelpers';
import { revokeLicense, updateLicenseAdmin } from '../../services/adminApi';
import LicenseEditDialog from './LicenseEditDialog';

type Props = {
  title: string;
  subtitle: string;
  rows: LicenseRecord[];
  loading: boolean;
  error: string | null;
  mode: 'active' | 'inactive' | 'pending' | 'all';
  onRefresh: () => void;
};

export default function LicensesTable({
  title,
  subtitle,
  rows,
  loading,
  error,
  mode,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState('');
  const [editRow, setEditRow] = useState<LicenseRecord | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = rows;
    if (mode === 'active') list = list.filter(isLicenseActive);
    if (mode === 'inactive' || mode === 'pending') list = list.filter(isPendingGeneratedLicense);
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter((r) => {
      const key = String(r.id ?? r.licenseKey ?? '').toLowerCase();
      const email = String(r.assignedToEmail ?? '').toLowerCase();
      return key.includes(s) || email.includes(s);
    });
  }, [rows, search, mode]);

  const runRevoke = async (key: string) => {
    if (!window.confirm(`Revoke license ${maskKey(key)}?`)) return;
    setActing(key);
    try {
      await revokeLicense(key);
      onRefresh();
    } catch (e: unknown) {
      alert(String((e as Error)?.message ?? 'Revoke failed'));
    } finally {
      setActing(null);
    }
  };

  const runBlacklist = async (key: string) => {
    if (!window.confirm(`Blacklist (revoke + clear devices) ${maskKey(key)}?`)) return;
    setActing(key);
    try {
      await updateLicenseAdmin(key, { revoked: true, clearDevices: true });
      onRefresh();
    } catch (e: unknown) {
      alert(String((e as Error)?.message ?? 'Blacklist failed'));
    } finally {
      setActing(null);
    }
  };

  const statusColor = (lic: LicenseRecord): 'success' | 'default' | 'error' | 'warning' => {
    const label = licenseStatusLabel(lic);
    if (label === 'Active') return 'success';
    if (label === 'Revoked') return 'error';
    if (label === 'Pending') return 'warning';
    return 'default';
  };

  const emptyLabel =
    mode === 'pending' || mode === 'inactive'
      ? loading
        ? 'Loading…'
        : 'No pending keys — use Generate to create a new license'
      : loading
        ? 'Loading…'
        : 'No licenses';

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ md: 'center' }} justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search key or email…"
            sx={{ minWidth: 240 }}
          />
          <Button variant="outlined" onClick={onRefresh} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Key</TableCell>
            <TableCell>Assigned email</TableCell>
            <TableCell align="right">Max</TableCell>
            <TableCell align="right">Devices</TableCell>
            <TableCell>License generated</TableCell>
            <TableCell>License activated</TableCell>
            <TableCell>Expiry</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} align="center">
                <Typography variant="body2" color="text.secondary">
                  {emptyLabel}
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((r) => {
              const key = String(r.id ?? r.licenseKey ?? '');
              const busy = acting === key;
              return (
                <TableRow key={key} hover>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: 11,
                        wordBreak: 'break-all',
                        whiteSpace: 'normal',
                        lineHeight: 1.35,
                      }}
                    >
                      {key}
                    </Typography>
                    <Link
                      component="button"
                      variant="caption"
                      onClick={() => void navigator.clipboard.writeText(key)}
                      sx={{ display: 'block', mt: 0.5 }}
                    >
                      Copy
                    </Link>
                  </TableCell>
                  <TableCell>{String(r.assignedToEmail ?? '') || '—'}</TableCell>
                  <TableCell align="right">{Number(r.maxActivations ?? 1)}</TableCell>
                  <TableCell align="right">{deviceCount(r)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatTs(generatedAtMs(r))}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatTs(firstActivationMs(r))}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatTs(r.expiryDate ?? null)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={licenseStatusLabel(r)} color={statusColor(r)} />
                  </TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end" flexWrap="wrap">
                      <Button size="small" disabled={busy} onClick={() => setEditRow(r)}>
                        Edit
                      </Button>
                      <Button size="small" color="warning" disabled={busy || r.revoked} onClick={() => void runRevoke(key)}>
                        Revoke
                      </Button>
                      <Button size="small" color="error" disabled={busy} onClick={() => void runBlacklist(key)}>
                        Blacklist
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <LicenseEditDialog
        open={Boolean(editRow)}
        license={editRow}
        onClose={() => setEditRow(null)}
        onSaved={onRefresh}
      />
    </Box>
  );
}
