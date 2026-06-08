import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, Surface, HelperText } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../store/slices/authSlice';
import { loginViaDesktopSync } from '../services/mobileDesktopAuthService';
import { readSyncConfig } from '../services/sync/storage';
import { saveAuthSession } from '../services/authStorage';
import { mobileSyncWorker } from '../services/sync/mobileSyncWorker';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const [loginId, setLoginId] = useState('');
  const [pin, setPin] = useState('');
  const [syncEndpoint, setSyncEndpoint] = useState('');
  const [syncToken, setSyncToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  React.useEffect(() => {
    void (async () => {
      const cfg = await readSyncConfig();
      setSyncEndpoint(cfg.endpointBase);
      setSyncToken(cfg.token);
    })();
  }, []);

  const handleLogin = async () => {
    if (!loginId.trim() || !pin.trim()) {
      setError('Email/mobile and PIN are required.');
      return;
    }
    if (!syncEndpoint.trim() || !syncToken.trim()) {
      setError('Set Desktop Sync URL and token first (ask admin / desktop About → Mobile Sync).');
      return;
    }
    try {
      setLoading(true);
      setError('');
      await mobileSyncWorker.configure({
        endpointBase: syncEndpoint.trim(),
        token: syncToken.trim(),
      });
      const data = await loginViaDesktopSync({ loginId: loginId.trim(), pin: pin.trim() });
      const user = {
        id: data.user.id,
        username: data.user.email,
        fullName: data.user.displayName || data.user.email,
        email: data.user.email,
        mobile: data.user.mobile,
        role: 'MOBILE_USER',
        companyId: 'desktop',
        validUntilMs: data.user.validUntilMs,
      };
      await saveAuthSession({
        token: data.sessionToken,
        user,
      });
      dispatch(
        setCredentials({
          user,
          token: data.sessionToken,
        })
      );
      await mobileSyncWorker.retryNow();
    } catch (e: unknown) {
      setError(String((e as Error)?.message || 'Login failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.surface}>
        <Text variant="headlineMedium" style={styles.title}>
          PVE InvoicePro 360
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Mobile — connects to your desktop while it is running
        </Text>
        <TextInput
          label="Desktop Sync URL"
          value={syncEndpoint}
          onChangeText={setSyncEndpoint}
          mode="outlined"
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          label="Sync Token"
          value={syncToken}
          onChangeText={setSyncToken}
          mode="outlined"
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          label="Email or mobile"
          value={loginId}
          onChangeText={setLoginId}
          mode="outlined"
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          label="PIN (from admin)"
          value={pin}
          onChangeText={setPin}
          mode="outlined"
          secureTextEntry
          keyboardType="number-pad"
          style={styles.input}
        />
        <Button mode="contained" onPress={handleLogin} style={styles.button} loading={loading} disabled={loading}>
          Sign In
        </Button>
        {!!error && <HelperText type="error">{error}</HelperText>}
      </Surface>
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
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
  },
});
