import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import Logo from '../components/Logo';
import { auth } from '../firebase/firebase';
import { adminCheckMessage, checkAdminUid } from '../firebase/adminAuth';
import {
  clearPasscodeVault,
  getPasscodeEmailHint,
  hasPasscodeVault,
  savePasscodeVault,
  unlockPasscodeVault,
} from '../services/passcodeVault';
import { clearSessionUnlock, isSessionUnlocked, markSessionUnlocked } from '../services/sessionLock';

type Screen = 'checking' | 'passcode' | 'login';

export default function LoginPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [rememberWithPasscode, setRememberWithPasscode] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [pendingCreds, setPendingCreds] = useState<{ email: string; password: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledUid = useRef<string | null>(null);

  const emailHint = useMemo(() => getPasscodeEmailHint(), [screen]);
  const canAttempt = useMemo(() => email.trim() && password.trim(), [email, password]);
  const canUnlock = useMemo(() => passcode.trim().length >= 4, [passcode]);
  const canSavePasscode = useMemo(
    () => passcode.trim().length >= 4 && passcode === confirmPasscode,
    [passcode, confirmPasscode],
  );

  const finishAdminLogin = async (uid: string) => {
    const result = await checkAdminUid(uid);
    if (result === 'yes') {
      markSessionUnlocked();
      navigate('/admin/licenses', { replace: true });
      return true;
    }
    await signOut(auth).catch(() => undefined);
    handledUid.current = null;
    setError(adminCheckMessage(result, uid));
    return false;
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        handledUid.current = null;
        setScreen(hasPasscodeVault() ? 'passcode' : 'login');
        return;
      }

      if (hasPasscodeVault() && !isSessionUnlocked()) {
        await signOut(auth).catch(() => undefined);
        handledUid.current = null;
        setScreen('passcode');
        return;
      }

      if (handledUid.current === u.uid) return;
      handledUid.current = u.uid;
      setError(null);
      try {
        await finishAdminLogin(u.uid);
      } catch (e: unknown) {
        await signOut(auth).catch(() => undefined);
        handledUid.current = null;
        clearSessionUnlock();
        setError(String((e as Error)?.message ?? 'Could not verify admin permission.'));
        setScreen(hasPasscodeVault() ? 'passcode' : 'login');
      }
    });
    return () => unsub();
  }, [navigate]);

  const submitLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const cred = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      const ok = await finishAdminLogin(cred.user.uid);
      if (!ok) return;

      if (rememberWithPasscode) {
        setPendingCreds({ email: normalizedEmail, password });
        setPasscode('');
        setConfirmPasscode('');
        setSetupOpen(true);
      }
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  const submitPasscode = async () => {
    setBusy(true);
    setError(null);
    try {
      const creds = await unlockPasscodeVault(passcode.trim());
      const cred = await signInWithEmailAndPassword(auth, creds.email, creds.password);
      await finishAdminLogin(cred.user.uid);
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Wrong passcode'));
    } finally {
      setBusy(false);
    }
  };

  const savePasscodeAndContinue = async () => {
    if (!pendingCreds) return;
    setBusy(true);
    setError(null);
    try {
      await savePasscodeVault(pendingCreds.email, pendingCreds.password, passcode.trim());
      setSetupOpen(false);
      setPendingCreds(null);
      setPasscode('');
      setConfirmPasscode('');
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Could not save passcode'));
    } finally {
      setBusy(false);
    }
  };

  const useDifferentAccount = () => {
    clearPasscodeVault();
    clearSessionUnlock();
    setPasscode('');
    setError(null);
    setScreen('login');
  };

  if (screen === 'checking') {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: '#f6f8fb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography color="text.secondary">Loading…</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f8fb', display: 'flex', alignItems: 'center' }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 3 }}>
          <Stack alignItems="center" spacing={2} sx={{ mb: 2 }}>
            <Logo size="auth" />
          </Stack>

          {screen === 'passcode' ? (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                Enter your passcode to open InvoicePro Admin
                {emailHint ? ` for ${emailHint}` : ''}.
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Stack spacing={2}>
                <TextField
                  label="Passcode"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  fullWidth
                  disabled={busy}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canUnlock) void submitPasscode();
                  }}
                />
                <Button variant="contained" disabled={!canUnlock || busy} onClick={submitPasscode}>
                  {busy ? 'Unlocking…' : 'Unlock'}
                </Button>
                <Button variant="text" disabled={busy} onClick={useDifferentAccount}>
                  Use email login instead
                </Button>
              </Stack>
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, textAlign: 'center' }}>
                Sign in with your admin account.
              </Typography>
              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                  fullWidth
                  disabled={busy}
                />
                <TextField
                  label="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  fullWidth
                  disabled={busy}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberWithPasscode}
                      onChange={(e) => setRememberWithPasscode(e.target.checked)}
                      disabled={busy}
                    />
                  }
                  label="Save login with passcode"
                />
                <Button variant="contained" disabled={!canAttempt || busy} onClick={submitLogin}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </Button>
                {hasPasscodeVault() && (
                  <Button
                    variant="text"
                    disabled={busy}
                    onClick={() => {
                      setError(null);
                      setPasscode('');
                      setScreen('passcode');
                    }}
                  >
                    Unlock with passcode
                  </Button>
                )}
              </Stack>
            </>
          )}
        </Paper>
      </Container>

      <Dialog open={setupOpen} onClose={() => !busy && setSetupOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Set passcode</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Choose a passcode to unlock the app next time without entering email and password.
          </Typography>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Passcode"
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              fullWidth
              autoFocus
            />
            <TextField
              label="Confirm passcode"
              type="password"
              value={confirmPasscode}
              onChange={(e) => setConfirmPasscode(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setSetupOpen(false)}>
            Skip
          </Button>
          <Button variant="contained" disabled={!canSavePasscode || busy} onClick={savePasscodeAndContinue}>
            Save passcode
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
