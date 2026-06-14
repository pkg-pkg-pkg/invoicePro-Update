import React, { useMemo } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import ScreenContainer from '../../components/common/ScreenContainer';
import { ListEmpty, ListError, ListLoading } from '../../components/common/ListStates';
import { useOfflineList } from '../../hooks/useOfflineList';
import { apiGetLedgers } from '../../services/api/dataApi';
import { CACHE_KEYS } from '../../services/cache/offlineCache';
import type { LedgerAccount } from '../../types/domain';
import { formatInr } from '../../utils/format';

export default function BankAccountsScreen() {
  const fetcher = useMemo(() => () => apiGetLedgers(), []);
  const { items, loading, refreshing, error, reload } = useOfflineList<LedgerAccount>({
    cacheKey: CACHE_KEYS.ledgers,
    fetcher,
  });

  return (
    <ScreenContainer scroll={false}>
      <Text variant="headlineSmall" style={styles.title}>Bank & Cash Accounts</Text>
      {loading && !refreshing ? <ListLoading /> : null}
      {error && !items.length ? <ListError message={error} onRetry={reload} /> : null}
      {!loading && !items.length ? <ListEmpty message="No bank accounts" /> : null}
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={reload}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.name || item.id}</Text>
              <Text variant="bodyMedium">Balance {formatInr(item.balance)}</Text>
            </Card.Content>
          </Card>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ title: { padding: 16, paddingBottom: 0 }, card: { marginHorizontal: 16, marginBottom: 10 } });
