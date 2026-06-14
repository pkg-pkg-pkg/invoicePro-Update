import React, { useState } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, Surface, HelperText, Snackbar } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { setCredentials, setSuperAdminMode } from '../store/slices/authSlice';
import { saveAuthSession } from '../services/authStorage';
import { apiLogin } from '../services/api/invoiceProClient';
import { setMobileAuthToken } from '../services/api';
import { middlewareSync } from '../services/sync/middlewareSync';
import { auth } from '../firebase/firebase';
import { checkSuperAdminUid } from '../services/superAdminService';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const [mobileNo, setMobileNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuperAdminLogin, setShowSuperAdminLogin] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [toast, setToast] = useState('');

  const handleLogin = async () => {
    const digits = mobileNo.replace(/\D/g, '');
    if (digits.length < 10) {
      setError('Enter a valid 10-digit mobile number.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const data = await apiLogin({ mobile_no: digits });
      if (!data.success || !data.token) {
        throw new Error(data.error || 'Login failed');
      }

      const token = data.token || data.jwt || '';
      const refreshToken = data.refreshToken || token;
      const apiUser = data.user;
      const user = {
        id: String(apiUser.id),
        username: apiUser.username || apiUser.email || digits,
        name: apiUser.name || apiUser.fullName,
        fullName: apiUser.fullName || apiUser.name,
        mobileNumber: apiUser.mobileNumber,
        role: apiUser.role,
        companyId: apiUser.companyId ? String(apiUser.companyId) : undefined,
        permissions: apiUser.permissions,
        mobilePermissions: apiUser.mobilePermissions,
      };

      await saveAuthSession({ token, refreshToken, user });
      setMobileAuthToken(token);
      dispatch(setCredentials({ user, token }));
      await middlewareSync.syncNow();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSuperAdminLogin = async () => {
    if (!auth) {
      setError('Firebase is not configured on mobile (.env FIREBASE_*).');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const cred = await signInWithEmailAndPassword(
        auth,
        adminEmail.trim().toLowerCase(),
        adminPassword
      );
      const allowed = await checkSuperAdminUid(cred.user.uid);
      if (!allowed) {
        setError('Not authorized as super admin.');
        return;
      }
      dispatch(setSuperAdminMode(true));
      setToast('Super admin access granted');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Super admin login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.surface}>
        <Pressable onLongPress={() => setShowSuperAdminLogin((v) => !v)} delayLongPress={1200}>
          <Text variant="headlineMedium" style={styles.title}>
            PVE InvoicePro 360
          </Text>
        </Pressable>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Mobile — connects to your desktop while it is running
        </Text>

        {showSuperAdminLogin ? (
          <>
            <Text variant="labelLarge" style={styles.adminHint}>
              Super Admin (Firebase)
            </Text>
            <TextInput
              label="Email"
              value={adminEmail}
              onChangeText={setAdminEmail}
              mode="outlined"
              style={styles.input}
              autoCapitalize="none"
            />
            <TextInput
              label="Password"
              value={adminPassword}
              onChangeText={setAdminPassword}
              mode="outlined"
              secureTextEntry
              style={styles.input}
            />
            <Button
              mode="contained"
              onPress={() => void handleSuperAdminLogin()}
              loading={loading}
              disabled={loading}
            >
              Super Admin Sign In
            </Button>
          </>
        ) : (
          <>
            <TextInput
              label="Mobile number"
              value={mobileNo}
              onChangeText={setMobileNo}
              mode="outlined"
              style={styles.input}
              autoCapitalize="none"
              keyboardType="phone-pad"
            />
            <Button mode="contained" onPress={() => void handleLogin()} style={styles.button} loading={loading} disabled={loading}>
              Sign In
            </Button>
          </>
        )}

        {!!error && <HelperText type="error">{error}</HelperText>}
      </Surface>
      <Snackbar visible={Boolean(toast)} onDismiss={() => setToast('')} duration={3000}>
        {toast}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  surface: {
    padding: 20,
    borderRadius: 8,
    elevation: 4,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  adminHint: {
    marginBottom: 8,
    color: '#334155',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});
