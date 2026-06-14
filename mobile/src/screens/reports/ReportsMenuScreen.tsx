import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, SegmentedButtons, Text, Card } from 'react-native-paper';
import ScreenContainer from '../../components/common/ScreenContainer';
import { apiGetReport } from '../../services/api/dataApi';

const TABS = ['Sales', 'Purchase', 'Stock', 'Financial', 'Party', 'Payment', 'Profit'] as const;

const REPORTS: Record<(typeof TABS)[number], string[]> = {
  Sales: ['sales-summary', 'Sales by Item', 'Sales by Customer', 'Invoice-wise Detail'],
  Purchase: ['purchase-summary', 'Purchase by Item', 'Purchase by Vendor'],
  Stock: ['stock-summary', 'Stock Movement', 'Low Stock Alert', 'Godown-wise Stock'],
  Financial: ['pl', 'balance-sheet', 'trial-balance', 'Cash Flow'],
  Party: ['outstanding', 'Vendor Outstanding', 'Customer Ledger', 'Vendor Ledger'],
  Payment: ['Receipt Summary', 'Payment Summary', 'Collection Report'],
  Profit: ['Item-wise Profit', 'Invoice-wise Profit'],
};

export default function ReportsMenuScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Sales');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [result, setResult] = useState<string>('');

  const runReport = async (slug: string) => {
    if (slug.includes(' ')) {
      setResult(`${slug} — desktop parity report (use desktop for full export).`);
      return;
    }
    try {
      const data = await apiGetReport(slug, { from, to });
      setResult(`${data.report}: ${data.rows.length} rows`);
    } catch (e) {
      setResult(e instanceof Error ? e.message : 'Failed');
    }
  };

  return (
    <ScreenContainer scroll={false}>
      <ScrollView>
        <SegmentedButtons
          value={tab}
          onValueChange={(v) => setTab(v as (typeof TABS)[number])}
          buttons={TABS.map((t) => ({ value: t, label: t }))}
          style={styles.tabs}
        />
        <Text variant="bodySmall" style={styles.hint}>Date range (YYYY-MM-DD) — reports always fetch fresh</Text>
        <Button mode="outlined" onPress={() => setFrom('2026-04-01')}>Set sample From</Button>
        <Button mode="outlined" onPress={() => setTo(new Date().toISOString().slice(0, 10))}>Set To = today</Button>
        {REPORTS[tab].map((r) => (
          <Card key={r} style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{r}</Text>
              <Button mode="contained" onPress={() => void runReport(r.toLowerCase().replace(/ /g, '-'))} style={styles.btn}>
                Run
              </Button>
            </Card.Content>
          </Card>
        ))}
        {!!result && <Text style={styles.result}>{result}</Text>}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  tabs: { margin: 16 },
  hint: { paddingHorizontal: 16, color: '#666' },
  card: { marginHorizontal: 16, marginBottom: 10 },
  btn: { marginTop: 8 },
  result: { padding: 16, color: '#1565c0' },
});
