import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  IconButton,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Typography,
} from '@mui/material';

import { auth } from '../firebase/firebase';
import { adminCheckMessage, checkAdminUid } from '../firebase/adminAuth';
import { clearPasscodeVault, hasPasscodeVault } from '../services/passcodeVault';
import { clearSessionUnlock, isSessionUnlocked } from '../services/sessionLock';
import Logo from '../components/Logo';
import LicensesTab from './tabs/LicensesTab';
import UsersTab from './tabs/UsersTab';
import AppUpdateTab from './tabs/AppUpdateTab';
import ActivityTab from './tabs/ActivityTab';
import LanUpgradesTab from './tabs/LanUpgradesTab';
import GatewayRenewalsTab from './tabs/GatewayRenewalsTab';
import MobileUsersTab from './tabs/MobileUsersTab';
import RiskTab from './tabs/RiskTab';

const TAB_PATHS = [
  'licenses',
  'activity',
  'users',
  'app-update',
  'lan-upgrades',
  'gateway-renewals',
  'mobile-users',
  'risk',
] as const;

const TAB_LABELS = [
  'Licenses',
  'Activity',
  'Users',
  'App update',
  'LAN upgrades',
  'Gateway renewals',
  'Mobile users',
  'Risk',
] as const;

function indexFromPath(path: string): number {
  const p = path.replace(/^\/+/, '').split('/')[0] || 'licenses';
  const idx = TAB_PATHS.indexOf(p as (typeof TAB_PATHS)[number]);
  return idx >= 0 ? idx : 0;
}

export default function AdminDashboard() {
  const nav = useNavigate();
  const loc = useLocation();

  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [denyMessage, setDenyMessage] = useState<string | null>(null);

  const tabIndex = useMemo(() => indexFromPath(loc.pathname.replace(/^\/admin\/?/, '')), [loc.pathname]);

  useEffect(() => {
    let cancelled = false;
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (cancelled) return;
      if (!u) {
        setAllowed(false);
        setDenyMessage(null);
        setReady(true);
        return;
      }
      if (hasPasscodeVault() && !isSessionUnlocked()) {
        await signOut(auth).catch(() => undefined);
        if (!cancelled) {
          setAllowed(false);
          setDenyMessage(null);
          setReady(true);
        }
        return;
      }
      setReady(false);
      try {
        const result = await checkAdminUid(u.uid);
        if (cancelled) return;
        setAllowed(result === 'yes');
        setDenyMessage(result === 'yes' ? null : adminCheckMessage(result, u.uid));
      } catch (e: unknown) {
        if (cancelled) return;
        setAllowed(false);
        setDenyMessage(String((e as Error)?.message ?? 'Could not verify admin permission.'));
      } finally {
        if (!cancelled) setReady(true);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  if (!ready) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!auth.currentUser || (hasPasscodeVault() && !isSessionUnlocked())) {
    return <Navigate to="/login" replace />;
  }

  if (!allowed) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f6f8fb', display: 'flex', alignItems: 'center', p: 2 }}>
        <Container maxWidth="sm">
          <Alert severity="error" sx={{ mb: 2 }}>
            {denyMessage ?? 'Not authorized for Admin panel.'}
          </Alert>
          <Button
            variant="contained"
            onClick={async () => {
              await signOut(auth).catch(() => undefined);
              nav('/login', { replace: true });
            }}
          >
            Back to login
          </Button>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f8fb' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          <Stack direction="row" alignItems="center" sx={{ flexShrink: 0, minWidth: 0 }}>
            <Logo size="toolbar" />
          </Stack>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton color="inherit" title="Refresh page" onClick={() => window.location.reload()}>
              <RefreshIcon />
            </IconButton>
            <Button
              color="inherit"
              onClick={async () => {
                clearSessionUnlock();
                await signOut(auth).catch(() => undefined);
                nav('/login', { replace: true });
              }}
            >
              Lock
            </Button>
            <Button
              color="inherit"
              onClick={async () => {
                clearPasscodeVault();
                clearSessionUnlock();
                await signOut(auth).catch(() => undefined);
                nav('/login', { replace: true });
              }}
            >
              Logout
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ py: 2, px: { xs: 2, md: 3 } }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => nav(`/admin/${TAB_PATHS[v]}`)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mb: 2 }}
        >
          {TAB_LABELS.map((label) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>

        <Routes>
          <Route path="licenses" element={<LicensesTab />} />
          <Route path="activity" element={<ActivityTab />} />
          <Route path="users" element={<UsersTab />} />
          <Route path="app-update" element={<AppUpdateTab />} />
          <Route path="lan-upgrades" element={<LanUpgradesTab />} />
          <Route path="gateway-renewals" element={<GatewayRenewalsTab />} />
          <Route path="mobile-users" element={<MobileUsersTab />} />
          <Route path="risk" element={<RiskTab />} />
          <Route path="" element={<Navigate to="/admin/licenses" replace />} />
        </Routes>
      </Container>
    </Box>
  );
}
