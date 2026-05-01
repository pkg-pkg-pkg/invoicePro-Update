import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextInput, Button, Text, Surface, HelperText } from 'react-native-paper';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../store/slices/authSlice';
import { mobileLogin } from '../services/mobileAuthService';
import { setMobileAuthToken } from '../services/api';
import { saveAuthSession } from '../services/authStorage';

export default function LoginScreen() {
  const dispatch = useDispatch();
  const [usernameOrMobile, setUsernameOrMobile] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!usernameOrMobile.trim() || !password.trim()) {
      setError('Username/mobile and password are required.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const data = await mobileLogin(usernameOrMobile.trim(), password);
      setMobileAuthToken(data.token);
      await saveAuthSession({
        token: data.token,
        user: data.user,
      });
      dispatch(
        setCredentials({
          user: data.user,
          token: data.token,
        })
      );
    } catch (e: any) {
      const msg = String(e?.response?.data?.error || e?.message || 'Login failed');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.surface}>
        <Text variant="headlineMedium" style={styles.title}>
          GST Billing
        </Text>
        <Text variant="bodyMedium" style={styles.subtitle}>
          Sign in to your account
        </Text>
        <TextInput
          label="Username or Mobile"
          value={usernameOrMobile}
          onChangeText={setUsernameOrMobile}
          mode="outlined"
          style={styles.input}
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />
        <Button
          mode="contained"
          onPress={handleLogin}
          style={styles.button}
          loading={loading}
          disabled={loading}
        >
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

