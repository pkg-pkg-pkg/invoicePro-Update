import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Text, TextInput, HelperText } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { setMobileAuthToken } from '../services/api';
import { clearAuthSession } from '../services/authStorage';
import { mobileSyncWorker } from '../services/sync/mobileSyncWorker';
import { readSyncConfig } from '../services/sync/storage';

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const sync = useSelector((state: RootState) => state.sync);
  const [endpointBase, setEndpointBase] = useState('');
  const [syncToken, setSyncToken] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [syncError, setSyncError] = useState('');

  const handleLogout = async () => {
    await clearAuthSession();
    setMobileAuthToken(null);
    dispatch(logout());
  };

  useEffect(() => {
    void (async () => {
      const cfg = await readSyncConfig();
      setEndpointBase(cfg.endpointBase);
      setSyncToken(cfg.token);
    })();
  }, []);

  const handleSaveSyncConfig = async () => {
    try {
      setSyncError('');
      await mobileSyncWorker.configure({
        endpointBase: endpointBase.trim(),
        token: syncToken.trim(),
      });
      setSyncMessage('Sync endpoint settings saved.');
      await mobileSyncWorker.retryNow();
    } catch (e: any) {
      setSyncError(String(e?.message || 'Failed to save sync config'));
    }
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">Settings</Text>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">{user?.fullName || user?.username || 'Mobile User'}</Text>
          <Text variant="bodySmall">Role: {user?.role || 'N/A'}</Text>
          <Text variant="bodySmall">Company: {user?.companyId || 'N/A'}</Text>
        </Card.Content>
      </Card>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Mobile Sync</Text>
          <TextInput
            label="Desktop Sync Endpoint"
            mode="outlined"
            value={endpointBase}
            onChangeText={setEndpointBase}
            style={styles.field}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            label="Sync Token"
            mode="outlined"
            value={syncToken}
            onChangeText={setSyncToken}
            style={styles.field}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text variant="bodySmall">Pending queue: {sync.pendingChanges}</Text>
          <Text variant="bodySmall">Last sync: {sync.lastSyncAt || 'Never'}</Text>
          {!!sync.lastError && <HelperText type="error">{sync.lastError}</HelperText>}
          {!!syncMessage && <HelperText type="info">{syncMessage}</HelperText>}
          {!!syncError && <HelperText type="error">{syncError}</HelperText>}
          <View style={styles.row}>
            <Button mode="contained" onPress={handleSaveSyncConfig}>
              Save & Retry
            </Button>
            <Button mode="outlined" onPress={() => void mobileSyncWorker.retryNow()}>
              Retry now
            </Button>
          </View>
        </Card.Content>
      </Card>
      <Button mode="outlined" onPress={handleLogout}>
        Logout
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginTop: 12,
    marginBottom: 16,
  },
  field: {
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
});

