import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, Searchbar, Text, Card } from 'react-native-paper';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useOfflineList } from '../../hooks/useOfflineList';
import { apiGetVouchers } from '../../services/api/dataApi';
import type { CacheKey } from '../../services/cache/offlineCache';
import type { VoucherRecord } from '../../types/domain';
import { formatDateDdMmYyyy, formatInr } from '../../utils/format';
import ScreenContainer from '../common/ScreenContainer';
import StatusBadge from '../common/StatusBadge';
import { ListEmpty, ListError, ListLoading } from '../common/ListStates';

type Props = {
  title: string;
  voucherType: string;
  cacheKey: CacheKey;
  formRoute: string;
  navigation: StackNavigationProp<Record<string, object | undefined>>;
};

export default function DocumentListScreen({ title, voucherType, cacheKey, formRoute, navigation }: Props) {
  const [query, setQuery] = useState('');
  const fetcher = useMemo(() => () => apiGetVouchers(voucherType), [voucherType]);
  const { items, loading, refreshing, error, reload } = useOfflineList<VoucherRecord>({
    cacheKey,
    fetcher,
  });

  const filtered = items.filter((row) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      String(row.documentNo || '').toLowerCase().includes(q) ||
      String(row.partyName || '').toLowerCase().includes(q)
    );
  });

  return (
    <ScreenContainer scroll={false}>
      <Text variant="headlineSmall" style={styles.title}>
        {title}
      </Text>
      <Searchbar placeholder="Search number or party" value={query} onChangeText={setQuery} style={styles.search} />
      {loading && !refreshing ? <ListLoading /> : null}
      {error && !items.length ? <ListError message={error} onRetry={reload} /> : null}
      {!loading && !filtered.length ? <ListEmpty message="No documents found" /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(item, idx) => String(item.id || idx)}
        refreshing={refreshing}
        onRefresh={reload}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium">{item.documentNo || item.id}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text variant="bodySmall">{formatDateDdMmYyyy(item.date)} · {item.partyName || '—'}</Text>
              <Text variant="bodyMedium">{formatInr(item.amount)} · GST {formatInr(item.gstAmount)}</Text>
              <Text variant="bodySmall">Balance: {formatInr(item.balanceDue)}</Text>
            </Card.Content>
          </Card>
        )}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => navigation.navigate(formRoute)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { paddingHorizontal: 16, paddingTop: 8 },
  search: { margin: 16, marginBottom: 8 },
  card: { marginHorizontal: 16, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
