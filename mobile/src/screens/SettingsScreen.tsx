import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../store';
import { logout } from '../store/slices/authSlice';
import { setMobileAuthToken } from '../services/api';
import { clearAuthSession } from '../services/authStorage';

export default function SettingsScreen() {
  const dispatch = useDispatch();
  const user = useSelector((state: RootState) => state.auth.user);

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
          <Text variant="titleMedium">{user?.fullName || user?.username || 'Mobile User'}</Text>
          <Text variant="bodySmall">Role: {user?.role || 'N/A'}</Text>
          <Text variant="bodySmall">Company: {user?.companyId || 'N/A'}</Text>
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
});

