import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Switch, Text, TextInput, Card } from 'react-native-paper';
import ScreenContainer from '../../components/common/ScreenContainer';
import { apiGetDayBook } from '../../services/api/dataApi';
import type { DayBookEntry, DayBookResponse } from '../../types/domain';
import { formatDateDdMmYyyy, formatInr } from '../../utils/format';

export default function DayBookScreen() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [voucherType, setVoucherType] = useState('');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const [data, setData] = useState<DayBookResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGetDayBook({
        date,
        type: voucherType || undefined,
        party: party || undefined,
        amount: amount || undefined,
        showDeleted,
      });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [amount, date, party, showDeleted, voucherType]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScreenContainer scroll={false}>
      <View style={styles.filters}>
        <TextInput label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} mode="outlined" style={styles.input} />
        <TextInput label="Voucher type" value={voucherType} onChangeText={setVoucherType} mode="outlined" style={styles.input} />
        <TextInput label="Party name" value={party} onChangeText={setParty} mode="outlined" style={styles.input} />
        <TextInput label="Amount" value={amount} onChangeText={setAmount} mode="outlined" style={styles.input} />
        <View style={styles.row}>
          <Text>Show deleted</Text>
          <Switch value={showDeleted} onValueChange={setShowDeleted} />
        </View>
        <Button mode="contained" onPress={() => void load()} loading={loading}>Apply Filters</Button>
      </View>
      {data ? (
        <Text variant="bodySmall" style={styles.summary}>
          Dr {formatInr(data.totals.totalDebit)} · Cr {formatInr(data.totals.totalCredit)} · Vouchers {data.totals.totalVouchers} · Sales {formatInr(data.totals.totalSales)} · Receipts {formatInr(data.totals.totalReceipts)}
        </Text>
      ) : null}
      <FlatList
        data={data?.entries || []}
        keyExtractor={(item: DayBookEntry) => item.id}
        refreshing={loading}
        onRefresh={() => void load()}
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.voucherType} · {item.voucherNumber}</Text>
              <Text variant="bodySmall">{formatDateDdMmYyyy(item.date)} · {item.partyName || '—'}</Text>
              <Text variant="bodyMedium">{item.description}</Text>
              <Text variant="bodySmall">Dr {formatInr(item.debit)} · Cr {formatInr(item.credit)} · {item.createdBy}</Text>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No vouchers for selected filters</Text>}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  filters: { padding: 16, paddingBottom: 8 },
  input: { marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  summary: { paddingHorizontal: 16, marginBottom: 8, color: '#444' },
  card: { marginHorizontal: 16, marginBottom: 8 },
  empty: { textAlign: 'center', padding: 24, color: '#666' },
});
