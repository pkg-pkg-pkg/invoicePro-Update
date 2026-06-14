import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { useSelector } from 'react-redux';
import ScreenContainer from '../components/common/ScreenContainer';
import { apiGetDashboardSummary } from '../services/api/dataApi';
import { readCache, writeCache, CACHE_KEYS } from '../services/cache/offlineCache';
import { middlewareSync } from '../services/sync/middlewareSync';
import type { DashboardSummary } from '../types/domain';
import { formatInr, formatPct, formatTimeHm, greetingForHour } from '../utils/format';
import { RootState } from '../store';

type Props = { navigation: { navigate: (name: string, params?: object) => void } };

function SummaryCard({ title, amount, pct }: { title: string; amount: string; pct: number }) {
  return (
    <Card style={styles.card}>
      <Card.Content>
        <Text variant="titleMedium">{title}</Text>
        <Text variant="headlineMedium">{amount}</Text>
        <Text variant="bodySmall" style={styles.pct}>{formatPct(pct)}</Text>
      </Card.Content>
    </Card>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const user = useSelector((s: RootState) => s.auth.user);
  const sync = useSelector((s: RootState) => s.sync);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cached = await readCache<DashboardSummary>(CACHE_KEYS.dashboard);
      if (cached) setSummary(cached);
      const fresh = await apiGetDashboardSummary();
      setSummary(fresh);
      await writeCache(CACHE_KEYS.dashboard, fresh);
    } catch {
      const cached = await readCache<DashboardSummary>(CACHE_KEYS.dashboard);
      if (cached) setSummary(cached);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const actions: Array<{ label: string; tab: string; screen: string }> = [
    { label: 'Invoice', tab: 'Sales', screen: 'TaxInvoices' },
    { label: 'Receipt', tab: 'More', screen: 'PaymentReceiptDesk' },
    { label: 'Payment', tab: 'More', screen: 'PaymentReceiptDesk' },
    { label: 'Purchase', tab: 'Purchase', screen: 'PurchaseBills' },
    { label: 'Customer', tab: 'More', screen: 'Customers' },
    { label: 'Item', tab: 'More', screen: 'ItemsList' },
  ];

  return (
    <ScreenContainer refreshing={loading} onRefresh={load}>
      <Text variant="headlineSmall">
        {greetingForHour()}, {user?.name || user?.fullName || 'User'}
      </Text>
      <Text variant="bodySmall" style={styles.meta}>
        {new Date().toLocaleDateString('en-IN')} · {formatTimeHm()} · {summary?.financialYear || ''}
      </Text>
      <SummaryCard title="Today's Sales" amount={formatInr(summary?.todaySales)} pct={summary?.todaySalesVsPriorPct || 0} />
      <SummaryCard title="Today's Receipts" amount={formatInr(summary?.todayReceipts)} pct={summary?.todayReceiptsVsPriorPct || 0} />
      <SummaryCard title="Outstanding" amount={formatInr(summary?.outstandingAmount)} pct={summary?.outstandingVsPriorPct || 0} />
      <SummaryCard title="Stock Value" amount={formatInr(summary?.stockValue)} pct={summary?.stockValueVsPriorPct || 0} />
      <Text variant="titleMedium" style={styles.section}>Quick Actions</Text>
      <View style={styles.actions}>
        {actions.map((a) => (
          <Button
            key={a.label}
            mode="outlined"
            style={styles.actionBtn}
            onPress={() => navigation.navigate(a.tab, { screen: a.screen })}
          >
            {a.label}
          </Button>
        ))}
      </View>
      <Button mode="contained" onPress={() => void middlewareSync.syncNow()} loading={loading}>
        Refresh from desktop
      </Button>
      <Text variant="bodySmall" style={styles.syncMeta}>Last sync: {sync.lastSyncAt || 'Never'}</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  meta: { color: '#666', marginBottom: 12 },
  card: { marginBottom: 12 },
  pct: { color: '#666', marginTop: 4 },
  section: { marginTop: 8, marginBottom: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  actionBtn: { marginRight: 4, marginBottom: 4 },
  syncMeta: { color: '#888', marginTop: 8 },
});
