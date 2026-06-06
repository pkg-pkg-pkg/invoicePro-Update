import { useCallback, useEffect, useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
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
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

import { db } from '../../firebase/firebase';
import { resolveLatestAppRelease } from '../../services/appReleaseConfig';
import { listLicenses, listUsers } from '../../services/adminApi';
import {
  firstActivationMs,
  formatTs,
  generatedAtMs,
  gatewayValidUntilMs,
  isLicenseActive,
  isPendingGeneratedLicense,
  isRecentlyActive,
  resolveLicenseByKey,
  userLastActiveMs,
  type LicenseRecord,
} from '../../utils/licenseHelpers';
import { needsAppUpdate } from '../../utils/version';

type UserRow = {
  id: string;
  email?: string;
  name?: string;
  businessName?: string;
  licenseKey?: string;
  appVersion?: string;
  gatewayValidUntilMs?: number | null;
  gatewayUpdatesEntitled?: boolean;
  lastLoginMs?: number | null;
  lastActiveAtMs?: number | null;
};

export default function UsersTab() {
  const [userSubTab, setUserSubTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [licenses, setLicenses] = useState<LicenseRecord[]>([]);
  const [latestVersion, setLatestVersion] = useState('');
  const [latestDownloadUrl, setLatestDownloadUrl] = useState('');
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState<string | null>(null);

  const licenseByKey = useMemo(() => {
    const m = new Map<string, LicenseRecord>();
    for (const l of licenses) {
      const k = String(l.id ?? l.licenseKey ?? '').trim().toUpperCase();
      if (k) m.set(k, l);
    }
    return m;
  }, [licenses]);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [uItems, licItems, release] = await Promise.all([
        listUsers(500),
        listLicenses(500),
        resolveLatestAppRelease().catch(() => null),
      ]);
      setUsers(
        uItems.map((d) => ({
          id: d.id,
          email: String(d.email ?? d.id),
          name: d.name as string | undefined,
          businessName: d.businessName as string | undefined,
          licenseKey: d.licenseKey as string | undefined,
          appVersion: d.appVersion as string | undefined,
          gatewayValidUntilMs: d.gatewayValidUntilMs as number | null | undefined,
          gatewayUpdatesEntitled: d.gatewayUpdatesEntitled as boolean | undefined,
          lastLoginMs: (d.lastLogin as number | null | undefined) ?? null,
          lastActiveAtMs: (d.lastActiveAt as number | null | undefined) ?? null,
        }))
      );
      setLicenses(licItems);
      setLatestVersion(release?.latestVersion ?? '');
      setLatestDownloadUrl(release?.downloadUrl ?? '');
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to load users'));
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const withActiveLicense = useMemo(() => {
    const seen = new Set<string>();
    const out: UserRow[] = [];

    for (const u of users) {
      const email = String(u.email ?? u.id).trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      const licKey = String(u.licenseKey ?? '').trim().toUpperCase();
      const lic = resolveLicenseByKey(licKey, licenseByKey, licenses);
      const activeByKey = lic ? isLicenseActive(lic) : false;
      const activeByEmail =
        lic &&
        String(lic.assignedToEmail ?? '')
          .trim()
          .toLowerCase() === email &&
        isLicenseActive(lic);
      if (activeByKey || activeByEmail) {
        seen.add(email);
        out.push(u);
      }
    }

    for (const lic of licenses) {
      if (!isLicenseActive(lic)) continue;
      const email = String(lic.assignedToEmail ?? '').trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      const existing = users.find((u) => String(u.email ?? u.id).toLowerCase() === email);
      out.push(
        existing ?? {
          id: email,
          email,
          licenseKey: String(lic.id ?? lic.licenseKey ?? ''),
        }
      );
    }

    return out;
  }, [users, licenseByKey, licenses]);

  const withInactiveLicense = useMemo(() => {
    const activeEmails = new Set(withActiveLicense.map((u) => String(u.email ?? u.id).toLowerCase()));
    return users.filter((u) => {
      const email = String(u.email ?? u.id).trim().toLowerCase();
      if (activeEmails.has(email)) return false;
      const key = String(u.licenseKey ?? '').trim().toUpperCase();
      if (!key) return false;
      const lic = resolveLicenseByKey(key, licenseByKey, licenses);
      return lic ? isPendingGeneratedLicense(lic) : true;
    });
  }, [users, licenseByKey, licenses, withActiveLicense]);

  const list = userSubTab === 0 ? withActiveLicense : withInactiveLicense;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return list;
    return list.filter((u) => {
      const email = String(u.email ?? u.id).toLowerCase();
      const name = String(u.name ?? u.businessName ?? '').toLowerCase();
      const lic = String(u.licenseKey ?? '').toLowerCase();
      return email.includes(s) || name.includes(s) || lic.includes(s);
    });
  }, [list, search]);

  const activityStats = useMemo(() => {
    let active7 = 0;
    let active30 = 0;
    for (const u of withActiveLicense) {
      const licKey = String(u.licenseKey ?? '').trim().toUpperCase();
      const lic = resolveLicenseByKey(licKey, licenseByKey, licenses);
      const lastMs = userLastActiveMs(
        { lastLogin: u.lastLoginMs, lastActiveAt: u.lastActiveAtMs },
        lic
      );
      if (isRecentlyActive(lastMs, 7)) active7 += 1;
      if (isRecentlyActive(lastMs, 30)) active30 += 1;
    }
    return { active7, active30 };
  }, [withActiveLicense, licenseByKey, licenses]);

  const sendUpdatePopup = async (u: UserRow) => {
    const targetEmail = String(u.email ?? u.id).trim().toLowerCase();
    if (!targetEmail) return;
    setSending(targetEmail);
    setError(null);
    try {
      const release = await resolveLatestAppRelease();
      const required = release.latestVersion;
      if (!required) throw new Error('Could not resolve latest version from Firestore or GitHub.');
      await setDoc(
        doc(db, 'users', targetEmail),
        {
          adminUpdateNotice: {
            requiredVersion: required,
            downloadUrl: release.downloadUrl || latestDownloadUrl,
            releaseNotes: release.releaseNotes || '',
            title: 'Update available',
            message: `A newer version (v${required}) is available. Please update PVE InvoicePro 360.`,
            createdAt: serverTimestamp(),
          },
        },
        { merge: true }
      );
      setLatestVersion(required);
      setLatestDownloadUrl(release.downloadUrl || latestDownloadUrl);
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Failed to send notice'));
    } finally {
      setSending(null);
    }
  };

  return (
    <Paper sx={{ p: 2.5 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} alignItems={{ md: 'center' }} justifyContent="space-between" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={800}>
            Users
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Active users = license assigned + activated. Used app in last 7 days:{' '}
            <strong>{activityStats.active7}</strong> · last 30 days:{' '}
            <strong>{activityStats.active30}</strong>. Latest GitHub/desktop version:{' '}
            {latestVersion ? `v${latestVersion}` : '— (fetch failed — use App Update tab)'}
          </Typography>
        </Box>
        <Stack direction="row" gap={1} alignItems="center">
          <TextField
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search email/name/license…"
            sx={{ minWidth: 260 }}
          />
          <Button variant="outlined" onClick={() => void reload()} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Tabs value={userSubTab} onChange={(_, v) => setUserSubTab(v)} sx={{ mb: 2 }}>
        <Tab label={`Active users (${withActiveLicense.length})`} />
        <Tab label={`Inactive / pending (${withInactiveLicense.length})`} />
      </Tabs>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 1100 }}>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Last login</TableCell>
              <TableCell>Last used app</TableCell>
              <TableCell>App version</TableCell>
              <TableCell>License key</TableCell>
              <TableCell>License generated</TableCell>
              <TableCell>License activated</TableCell>
              <TableCell>Gateway valid till</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <Typography variant="body2" color="text.secondary">
                    {loading ? 'Loading…' : 'No users'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((u) => {
                const email = String(u.email ?? u.id);
                const licKey = String(u.licenseKey ?? '').trim().toUpperCase();
                const lic = resolveLicenseByKey(licKey, licenseByKey, licenses);
                const ver = String(u.appVersion ?? '').trim();
                const isOutdated = needsAppUpdate(ver, latestVersion);
                const gwMs = gatewayValidUntilMs(u.gatewayValidUntilMs, lic);
                const gwEntitled = Boolean(
                  u.gatewayUpdatesEntitled ?? lic?.gatewayUpdatesEntitled
                );
                const gwOk = gwEntitled && gwMs != null && gwMs > Date.now();
                const genMs = lic ? generatedAtMs(lic) : null;
                const actMs = lic ? firstActivationMs(lic) : null;
                const lastLoginMs = u.lastLoginMs ?? null;
                const lastUsedMs = userLastActiveMs(
                  { lastLogin: u.lastLoginMs, lastActiveAt: u.lastActiveAtMs },
                  lic
                );
                const usedRecently = isRecentlyActive(lastUsedMs, 7);

                return (
                  <TableRow key={`${email}-${licKey}`} hover>
                    <TableCell>{email}</TableCell>
                    <TableCell>{String(u.name ?? u.businessName ?? '') || '—'}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatTs(lastLoginMs)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {lastUsedMs != null ? (
                        <Chip
                          size="small"
                          label={formatTs(lastUsedMs)}
                          color={usedRecently ? 'success' : 'default'}
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      {ver ? (
                        <Chip size="small" label={ver} color={isOutdated ? 'warning' : 'success'} />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 11, maxWidth: 220, wordBreak: 'break-all' }}>
                      {licKey || '—'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatTs(genMs)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatTs(actMs)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                      {gwMs != null ? (
                        <Chip
                          size="small"
                          label={formatTs(gwMs)}
                          color={gwOk ? 'success' : 'default'}
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {userSubTab === 0 ? (
                        <Tooltip
                          title={
                            !latestVersion
                              ? 'Latest version not loaded — refresh or use App Update tab'
                              : !isOutdated
                                ? `User is on v${ver || '?'} (latest v${latestVersion})`
                                : !gwOk
                                  ? 'Gateway not valid — update popup only when gateway is active'
                                  : `Send update notice (v${latestVersion})`
                          }
                        >
                          <span>
                            <Button
                              size="small"
                              variant="contained"
                              disabled={!latestVersion || !isOutdated || !gwOk || sending === email}
                              onClick={() => void sendUpdatePopup(u)}
                            >
                              {sending === email ? 'Sending…' : 'Send update popup'}
                            </Button>
                          </span>
                        </Tooltip>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
