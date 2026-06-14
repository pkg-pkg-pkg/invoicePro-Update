import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, Searchbar, SegmentedButtons, Text, Card } from 'react-native-paper';
import type { StackScreenProps } from '@react-navigation/stack';
import ScreenContainer from '../../components/common/ScreenContainer';
import StatusBadge from '../../components/common/StatusBadge';
import { ListEmpty, ListError, ListLoading } from '../../components/common/ListStates';
import { useOfflineList } from '../../hooks/useOfflineList';
import { apiGetParties } from '../../services/api/dataApi';
import { CACHE_KEYS } from '../../services/cache/offlineCache';
import type { PartyRecord } from '../../types/domain';
import { formatInr } from '../../utils/format';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'Customers'>;

export default function CustomersScreen({ navigation }: Props) {
  const [tab, setTab] = useState('customers');
  const [query, setQuery] = useState('');
  const fetcher = useMemo(() => () => apiGetParties('customer'), []);
  const { items, loading, refreshing, error, reload } = useOfflineList<PartyRecord>({
    cacheKey: CACHE_KEYS.customers,
    fetcher,
  });

  const filtered = items.filter((p) => String(p.name || '').toLowerCase().includes(query.toLowerCase()));

  if (tab === 'ledger') {
    return (
      <ScreenContainer>
        <SegmentedButtons value={tab} onValueChange={setTab} buttons={[{ value: 'customers', label: 'Customers' }, { value: 'ledger', label: 'Ledger Report' }]} style={styles.segment} />
        <Text variant="bodyMedium">Select a customer and open ledger from customer row (coming soon). Use Reports → Party for outstanding.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false}>
      <SegmentedButtons value={tab} onValueChange={setTab} buttons={[{ value: 'customers', label: 'Customers' }, { value: 'ledger', label: 'Ledger Report' }]} style={styles.segment} />
      <Searchbar placeholder="Search customers" value={query} onChangeText={setQuery} style={styles.search} />
      {loading && !refreshing ? <ListLoading /> : null}
      {error && !items.length ? <ListError message={error} onRetry={reload} /> : null}
      {!loading && !filtered.length ? <ListEmpty message="No customers" /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(item, idx) => String(item.customer_id || item.id || idx)}
        refreshing={refreshing}
        onRefresh={reload}
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => navigation.navigate('CustomerLedger', { partyId: item.customer_id || item.id })}>
            <Card.Content>
              <View style={styles.row}>
                <Text variant="titleMedium">{item.name}</Text>
                <StatusBadge status={Number(item.balance || 0) > 0 ? 'overdue' : 'paid'} />
              </View>
              <Text variant="bodySmall">{item.gstin || '—'} · {item.mobile || item.email || ''}</Text>
              <Text variant="bodyMedium">Balance {formatInr(item.balance)}</Text>
            </Card.Content>
          </Card>
        )}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => navigation.navigate('CustomerForm')} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  segment: { margin: 16, marginBottom: 8 },
  search: { marginHorizontal: 16, marginBottom: 8 },
  card: { marginHorizontal: 16, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
