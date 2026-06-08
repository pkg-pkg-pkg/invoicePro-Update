import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import StorefrontIcon from '@mui/icons-material/Storefront';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroid';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import LanIcon from '@mui/icons-material/Lan';
import {
  MOBILE_USER_ANNUAL_INR,
  MOBILE_USER_PRICING_LABEL,
  mobileUserUpiQrImageUrl,
  buildMobileUserUpiPayUrl,
} from '../../constants/mobileUserSubscription';
import {
  GATEWAY_PRICING_LABEL,
  GATEWAY_RENEWAL_AMOUNT_INR,
  gatewayUpiQrImageUrl,
} from '../../constants/gatewayRenewal';
import {
  MULTI_USER_PRICING_LABEL,
  MULTI_USER_AMOUNT_INR,
  multiUserUpiQrImageUrl,
} from '../../constants/multiUserLanUpgrade';
import {
  callGetMyGatewayRenewalStatus,
  callGetMyMultiUserUpgradeStatus,
  callSubmitGatewayRenewal,
  callSubmitMultiUserUpgrade,
  getLicenseKeyFromUserProfile,
} from '../../services/licenseService';
import {
  callGetMyMobileUserRequests,
  callListMobileUsersForLicense,
  callSubmitMobileUserSubscription,
  callTransferMobileUserDevice,
  refreshAndSyncMobileEntitlements,
  callRegisterMobileUserDevice,
} from '../../services/mobileUserSubscriptionService';
import { useAuth } from '../contexts/auth';

type StoreTab = 'catalog' | 'mobile-users';

const PRODUCTS = [
  {
    id: 'mobile-user',
    title: 'Mobile App User',
    price: MOBILE_USER_PRICING_LABEL,
    icon: <PhoneAndroidIcon color="primary" />,
    description:
      'One employee phone login. Syncs with desktop while your PC app is running. No cloud database — data flows through your desktop middleware.',
    highlights: ['₹599/year per user', 'Admin approval required', 'One phone per user (transfer available)'],
  },
  {
    id: 'gateway',
    title: 'Gateway Updates',
    price: GATEWAY_PRICING_LABEL,
    icon: <CloudSyncIcon color="primary" />,
    description: 'Annual updates, new features, and online services for your desktop license.',
    highlights: ['Auto-update entitlement', 'Renew 30 days before expiry'],
  },
  {
    id: 'lan',
    title: 'Multi-user LAN',
    price: MULTI_USER_PRICING_LABEL,
    icon: <LanIcon color="primary" />,
    description: 'Connect multiple PCs on your office LAN to one licensed host.',
    highlights: ['Unlimited LAN clients', 'Admin UTR approval'],
  },
] as const;

function formatDate(raw: unknown) {
  if (raw == null) return '—';
  const ms = typeof raw === 'number' ? raw : Number(raw);
  const d = Number.isFinite(ms) && ms > 1_000_000_000_000 ? new Date(ms) : new Date(String(raw));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-IN');
}

export default function StorePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<StoreTab>('catalog');
  const [licenseKey, setLicenseKey] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [mobileEmail, setMobileEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [mobileName, setMobileName] = useState('');
  const [mobileUtr, setMobileUtr] = useState('');
  const [mobileUsers, setMobileUsers] = useState<Array<Record<string, unknown>>>([]);
  const [mobileRequests, setMobileRequests] = useState<Array<Record<string, unknown>>>([]);

  const [gatewayUtr, setGatewayUtr] = useState('');
  const [lanUtr, setLanUtr] = useState('');

  const loadLicense = useCallback(async () => {
    const email = String(user?.email ?? '');
    if (!email) return;
    const lic = await getLicenseKeyFromUserProfile(email);
    if (lic?.licenseKey) setLicenseKey(lic.licenseKey);
  }, [user?.email]);

  const reloadMobile = useCallback(async () => {
    const users = await callListMobileUsersForLicense({ licenseKey });
    setMobileUsers(users.items ?? []);
    await refreshAndSyncMobileEntitlements(licenseKey);
    const reqs = await callGetMyMobileUserRequests({ licenseKey });
    setMobileRequests(reqs.items ?? []);
  }, [licenseKey]);

  useEffect(() => {
    void loadLicense();
  }, [loadLicense]);

  useEffect(() => {
    if (licenseKey) void reloadMobile();
  }, [licenseKey, reloadMobile]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onMobileDeviceBound) return;
    const off = api.onMobileDeviceBound((payload) => {
      void (async () => {
        try {
          const p = payload as { userId?: string; deviceId?: string };
          if (p.userId && p.deviceId) {
            await callRegisterMobileUserDevice({ userId: p.userId, deviceId: p.deviceId });
            await reloadMobile();
          }
        } catch {
          // ignore
        }
      })();
    });
    return () => off?.();
  }, [reloadMobile]);

  const mobileQr = useMemo(
    () => mobileUserUpiQrImageUrl(180, mobileEmail || mobileName || undefined),
    [mobileEmail, mobileName]
  );

  const handleMobilePurchase = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await callSubmitMobileUserSubscription({
        licenseKey,
        userEmail: mobileEmail.trim(),
        mobileNumber: mobileNumber.trim(),
        displayName: mobileName.trim(),
        utr: mobileUtr.trim(),
      });
      setMessage('Mobile user purchase submitted. Admin will verify UTR and activate the seat.');
      setMobileUtr('');
      await reloadMobile();
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Purchase failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleGateway = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await callSubmitGatewayRenewal({ licenseKey, utr: gatewayUtr.trim() });
      setMessage('Gateway renewal submitted for admin approval.');
      setGatewayUtr('');
      await callGetMyGatewayRenewalStatus({ licenseKey });
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Submit failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleLan = async () => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await callSubmitMultiUserUpgrade({ licenseKey, utr: lanUtr.trim() });
      setMessage('LAN upgrade submitted for admin approval.');
      setLanUtr('');
      await callGetMyMultiUserUpgradeStatus({ licenseKey });
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Submit failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleTransfer = async (userId: string) => {
    if (!window.confirm('Allow this mobile user to sign in on a new phone? Current phone binding will be cleared.')) {
      return;
    }
    setBusy(true);
    try {
      await callTransferMobileUserDevice({ userId });
      setMessage('Device transfer enabled. User can sign in on the new phone.');
      await reloadMobile();
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Transfer failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
        <StorefrontIcon color="primary" fontSize="large" />
        <Box>
          <Typography variant="h5" fontWeight={800}>
            PVE Store
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add-ons for your desktop license — pay via UPI, admin verifies UTR
          </Typography>
        </Box>
      </Stack>

      {message && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>
          {message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab value="catalog" label="Products" />
        <Tab value="mobile-users" label="Mobile users" />
      </Tabs>

      {tab === 'catalog' && (
        <Grid container spacing={2}>
          {PRODUCTS.map((p) => (
            <Grid item xs={12} md={4} key={p.id}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    {p.icon}
                    <Typography variant="h6" fontWeight={700}>
                      {p.title}
                    </Typography>
                  </Stack>
                  <Chip label={p.price} size="small" color="primary" sx={{ mb: 1.5 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {p.description}
                  </Typography>
                  <Stack spacing={0.5}>
                    {p.highlights.map((h) => (
                      <Typography key={h} variant="caption" display="block">
                        • {h}
                      </Typography>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}

          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Buy Mobile App User — {MOBILE_USER_PRICING_LABEL}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Works only while desktop is online. Each seat is tied to one employee email/mobile and one phone device.
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={8}>
                    <Stack spacing={1.5}>
                      <TextField label="Employee email" value={mobileEmail} onChange={(e) => setMobileEmail(e.target.value)} fullWidth />
                      <TextField label="Mobile number" value={mobileNumber} onChange={(e) => setMobileNumber(e.target.value)} fullWidth />
                      <TextField label="Display name (optional)" value={mobileName} onChange={(e) => setMobileName(e.target.value)} fullWidth />
                      <TextField label="UPI UTR after paying ₹599" value={mobileUtr} onChange={(e) => setMobileUtr(e.target.value.toUpperCase())} fullWidth />
                      <Button variant="contained" disabled={busy} onClick={() => void handleMobilePurchase()}>
                        Submit for admin approval
                      </Button>
                    </Stack>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box component="img" src={mobileQr} alt="UPI QR" sx={{ width: 180, height: 180, borderRadius: 1 }} />
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Amount: ₹{MOBILE_USER_ANNUAL_INR}
                    </Typography>
                    <Button size="small" href={buildMobileUserUpiPayUrl(mobileEmail)} sx={{ mt: 0.5 }}>
                      Open UPI link
                    </Button>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Gateway renewal — {GATEWAY_PRICING_LABEL}
                </Typography>
                <Box component="img" src={gatewayUpiQrImageUrl(140)} alt="Gateway UPI" sx={{ mb: 1 }} />
                <TextField label="UTR" value={gatewayUtr} onChange={(e) => setGatewayUtr(e.target.value.toUpperCase())} fullWidth size="small" sx={{ mb: 1 }} />
                <Button variant="outlined" disabled={busy} onClick={() => void handleGateway()}>
                  Submit Gateway UTR (₹{GATEWAY_RENEWAL_AMOUNT_INR})
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Multi-user LAN — {MULTI_USER_PRICING_LABEL}
                </Typography>
                <Box component="img" src={multiUserUpiQrImageUrl(140)} alt="LAN UPI" sx={{ mb: 1 }} />
                <TextField label="UTR" value={lanUtr} onChange={(e) => setLanUtr(e.target.value.toUpperCase())} fullWidth size="small" sx={{ mb: 1 }} />
                <Button variant="outlined" disabled={busy} onClick={() => void handleLan()}>
                  Submit LAN UTR (₹{MULTI_USER_AMOUNT_INR})
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 'mobile-users' && (
        <Stack spacing={2}>
          <Alert severity="info">
            After admin approval, share the 6-digit PIN with the employee. They sign in on the mobile app using desktop sync URL + token (Settings → About → Mobile Sync).
          </Alert>
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" fontWeight={700}>
                  Active & registered users
                </Typography>
                <Button size="small" onClick={() => void reloadMobile()} disabled={busy}>
                  Refresh & sync to desktop
                </Button>
              </Stack>
              {mobileUsers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No mobile users yet. Purchase a seat from the Products tab.
                </Typography>
              ) : (
                mobileUsers.map((u) => {
                  const id = String(u.id);
                  return (
                    <Box key={id} sx={{ py: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={1}>
                        <Box>
                          <Typography fontWeight={600}>{String(u.displayName || u.userEmail)}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {String(u.userEmail)} · {String(u.mobileNumber || '—')}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Valid until: {formatDate(u.validUntil ?? u.validUntilMs)} · Device:{' '}
                            {u.deviceId ? `${String(u.deviceId).slice(0, 12)}…` : 'Not bound yet'}
                          </Typography>
                        </Box>
                        <Stack direction="row" spacing={1}>
                          <Chip size="small" label={String(u.status || 'active')} color="success" variant="outlined" />
                          {!!u.deviceId && (
                            <Button size="small" variant="outlined" onClick={() => void handleTransfer(id)}>
                              Transfer phone
                            </Button>
                          )}
                        </Stack>
                      </Stack>
                      <Divider sx={{ mt: 1.5 }} />
                    </Box>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                Pending purchase requests
              </Typography>
              {mobileRequests.filter((r) => r.status === 'pending').length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No pending requests.
                </Typography>
              ) : (
                mobileRequests
                  .filter((r) => r.status === 'pending')
                  .map((r) => (
                    <Typography key={String(r.id)} variant="body2" sx={{ py: 0.5 }}>
                      {String(r.userEmail)} — UTR {String(r.utr)} — {String(r.status)}
                    </Typography>
                  ))
              )}
            </CardContent>
          </Card>
        </Stack>
      )}
    </Box>
  );
}
