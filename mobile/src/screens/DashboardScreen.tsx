import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, HelperText } from 'react-native-paper';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { mobileSyncWorker } from '../services/sync/mobileSyncWorker';

function formatInr(value: number) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export default function DashboardScreen() {
  const sync = useSelector((state: RootState) => state.sync);
  const snapshot = sync.snapshot;

  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Dashboard
      </Text>
      {!snapshot && (
        <HelperText type="info" style={styles.hint}>
          Open desktop app and dashboard once. Data appears while desktop is online.
        </HelperText>
      )}
      {snapshot?.companyName ? (
        <Text variant="bodySmall" style={styles.company}>
          {snapshot.companyName}
        </Text>
      ) : null}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Today&apos;s Sales</Text>
          <Text variant="headlineMedium">{formatInr(Number(snapshot?.todaySales || 0))}</Text>
        </Card.Content>
      </Card>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Today&apos;s Receipts</Text>
          <Text variant="headlineMedium">{formatInr(Number(snapshot?.todayReceipts || 0))}</Text>
        </Card.Content>
      </Card>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Outstanding</Text>
          <Text variant="headlineMedium">{formatInr(Number(snapshot?.outstanding || 0))}</Text>
        </Card.Content>
      </Card>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Stock Value</Text>
          <Text variant="headlineMedium">{formatInr(Number(snapshot?.stockValue || 0))}</Text>
        </Card.Content>
      </Card>
      <Button mode="outlined" onPress={() => void mobileSyncWorker.retryNow()} style={styles.refresh}>
        Refresh from desktop
      </Button>
      <Text variant="bodySmall" style={styles.meta}>
        Last sync: {sync.lastSyncAt || 'Never'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    marginBottom: 8,
  },
  hint: {
    marginBottom: 12,
  },
  company: {
    marginBottom: 12,
    color: '#666',
  },
  card: {
    marginBottom: 16,
  },
  refresh: {
    marginBottom: 8,
  },
  meta: {
    color: '#888',
    marginBottom: 24,
  },
});
