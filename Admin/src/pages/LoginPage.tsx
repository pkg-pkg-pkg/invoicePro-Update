import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';

import Logo from '../components/Logo';
import { auth } from '../firebase/firebase';
import { adminCheckMessage, checkAdminUid } from '../firebase/adminAuth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const handledUid = useRef<string | null>(null);

  const canAttempt = useMemo(() => email.trim() && password.trim(), [email, password]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        handledUid.current = null;
        setChecking(false);
        return;
      }
      if (handledUid.current === u.uid) {
        setChecking(false);
        return;
      }
      handledUid.current = u.uid;
      setChecking(true);
      setError(null);
      try {
        const result = await checkAdminUid(u.uid);
        if (result === 'yes') {
          navigate('/admin/licenses', { replace: true });
          return;
        }
        await signOut(auth).catch(() => undefined);
        handledUid.current = null;
        setError(adminCheckMessage(result, u.uid));
      } catch (e: unknown) {
        await signOut(auth).catch(() => undefined);
        handledUid.current = null;
        setError(String((e as Error)?.message ?? 'Could not verify admin permission.'));
      } finally {
        setChecking(false);
      }
    });
    return () => unsub();
  }, [navigate]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const result = await checkAdminUid(cred.user.uid);
      if (result === 'yes') {
        navigate('/admin/licenses', { replace: true });
        return;
      }
      await signOut(auth).catch(() => undefined);
      handledUid.current = null;
      setError(adminCheckMessage(result, cred.user.uid));
    } catch (e: unknown) {
      setError(String((e as Error)?.message ?? 'Login failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f8fb', display: 'flex', alignItems: 'center' }}>
      <Container maxWidth="sm">
        <Paper sx={{ p: 3 }}>
          <Stack alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
            <Logo size="auth" />
            <Typography variant="h5" fontWeight={800} textAlign="center">
              InvoicePro Admin
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
              disabled={busy || checking}
            />
            <TextField
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              fullWidth
              disabled={busy || checking}
            />
            <Button variant="contained" disabled={!canAttempt || busy || checking} onClick={submit}>
              {checking ? 'Checking session…' : busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
