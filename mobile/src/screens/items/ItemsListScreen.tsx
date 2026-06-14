import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { FAB, Searchbar, Text, Card } from 'react-native-paper';
import type { StackScreenProps } from '@react-navigation/stack';
import ScreenContainer from '../../components/common/ScreenContainer';
import { ListEmpty, ListError, ListLoading } from '../../components/common/ListStates';
import { useOfflineList } from '../../hooks/useOfflineList';
import { apiGetItems } from '../../services/api/dataApi';
import { CACHE_KEYS } from '../../services/cache/offlineCache';
import type { ItemRecord } from '../../types/domain';
import { formatInr } from '../../utils/format';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'ItemsList'>;

function parseExtra(item: ItemRecord): Record<string, unknown> {
  if (!item.extra_data) return {};
  if (typeof item.extra_data === 'object') return item.extra_data;
  try {
    return JSON.parse(item.extra_data) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export default function ItemsListScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const fetcher = useMemo(() => () => apiGetItems(), []);
  const { items, loading, refreshing, error, reload } = useOfflineList<ItemRecord>({
    cacheKey: CACHE_KEYS.items,
    fetcher,
  });

  const filtered = items.filter((row) => String(row.name || '').toLowerCase().includes(query.toLowerCase()));

  return (
    <ScreenContainer scroll={false}>
      <Searchbar placeholder="Search items" value={query} onChangeText={setQuery} style={styles.search} />
      {loading && !refreshing ? <ListLoading /> : null}
      {error && !items.length ? <ListError message={error} onRetry={reload} /> : null}
      {!loading && !filtered.length ? <ListEmpty message="No items found" /> : null}
      <FlatList
        data={filtered}
        keyExtractor={(item, idx) => String(item.item_id || item.id || idx)}
        refreshing={refreshing}
        onRefresh={reload}
        renderItem={({ item }) => {
          const extra = parseExtra(item);
          return (
            <Card style={styles.card}>
              <Card.Content>
                <Text variant="titleMedium">{item.name || '—'}</Text>
                <Text variant="bodySmall">SKU {String(extra.sku || '—')} · HSN {item.hsn_code || '—'}</Text>
                <Text variant="bodySmall">Pur {formatInr(Number(extra.purchase_rate || 0))} · Sale {formatInr(item.sale_rate)}</Text>
                <Text variant="bodySmall">Stock {String(extra.stock || extra.openingStock || 0)} {item.unit || ''}</Text>
              </Card.Content>
            </Card>
          );
        }}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => navigation.navigate('ItemForm')} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  search: { margin: 16 },
  card: { marginHorizontal: 16, marginBottom: 10 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
