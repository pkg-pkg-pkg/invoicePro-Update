import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';
import type { StackScreenProps } from '@react-navigation/stack';
import ScreenContainer from '../../components/common/ScreenContainer';
import { apiGetPartyLedger } from '../../services/api/dataApi';
import { formatDateDdMmYyyy, formatInr } from '../../utils/format';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'CustomerLedger'>;

export default function CustomerLedgerScreen({ route }: Props) {
  const partyId = (route.params as { partyId?: string } | undefined)?.partyId || '';
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (!partyId) return;
      setLoading(true);
      try {
        const data = await apiGetPartyLedger(partyId);
        setRows(data);
      } finally {
        setLoading(false);
      }
    })();
  }, [partyId]);

  return (
    <ScreenContainer scroll={false}>
      <Text variant="headlineSmall" style={styles.title}>Customer Ledger</Text>
      <FlatList
        data={rows}
        keyExtractor={(item, idx) => String(item.ENTRY_ID || item.entry_id || idx)}
        refreshing={loading}
        onRefresh={() => undefined}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="bodySmall">{formatDateDdMmYyyy(String(item.ENTRY_DATE || item.entry_date || ''))}</Text>
              <Text variant="titleMedium">{String(item.NARRATION || item.narration || 'Entry')}</Text>
              <Text variant="bodyMedium">Dr {formatInr(Number(item.DEBIT || item.debit || 0))} · Cr {formatInr(Number(item.CREDIT || item.credit || 0))}</Text>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No ledger entries</Text>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { padding: 16 },
  card: { marginHorizontal: 16, marginBottom: 8 },
  empty: { textAlign: 'center', padding: 24, color: '#666' },
});
