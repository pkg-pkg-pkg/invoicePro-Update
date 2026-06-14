import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { middlewareSync } from '../services/sync/middlewareSync';

export default function SyncStatusBar() {
  const [status, setStatus] = useState({ pendingChanges: 0, running: false, lastFetchedAt: null as string | null });

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      const s = await middlewareSync.getRuntimeStatus();
      if (mounted) setStatus(s);
    };
    void refresh();
    const id = setInterval(() => void refresh(), 15000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  const label = status.running
    ? 'Syncing…'
    : status.pendingChanges > 0
      ? `Pending ${status.pendingChanges}`
      : 'Synced';

  return (
    <View style={styles.bar}>
      <Text variant="labelSmall" style={styles.text}>
        {label}
        {status.lastFetchedAt ? ` · ${new Date(status.lastFetchedAt).toLocaleTimeString('en-IN')}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    color: '#1565c0',
  },
});
