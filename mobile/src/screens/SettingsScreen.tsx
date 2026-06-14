import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Text, HelperText } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { setMobileAuthToken } from '../services/api';
import { clearAuthSession } from '../services/authStorage';
import { middlewareSync } from '../services/sync/middlewareSync';

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);
  const sync = useSelector((state: RootState) => state.sync);

  const handleLogout = async () => {
    await clearAuthSession();
    setMobileAuthToken(null);
    dispatch(logout());
  };

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">Settings</Text>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">{user?.fullName || user?.name || user?.username || 'Mobile User'}</Text>
          <Text variant="bodySmall">Role: {user?.role || 'N/A'}</Text>
          <Text variant="bodySmall">Company: {user?.companyId || 'N/A'}</Text>
          {user?.permissions?.length ? (
            <Text variant="bodySmall">Permissions: {user.permissions.join(', ')}</Text>
          ) : null}
        </Card.Content>
      </Card>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Cloud Sync</Text>
          <Text variant="bodySmall">Pending queue: {sync.pendingChanges}</Text>
          <Text variant="bodySmall">Last sync: {sync.lastSyncAt || 'Never'}</Text>
          {!!sync.lastError && <HelperText type="error">{sync.lastError}</HelperText>}
          <View style={styles.row}>
            <Button mode="outlined" onPress={() => void middlewareSync.retryNow()}>
              Sync now
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
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginTop: 10,
  },
});
