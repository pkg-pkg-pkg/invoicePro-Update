import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import ScreenContainer from '../../components/common/ScreenContainer';
import { apiGetGstReport } from '../../services/api/dataApi';

export default function HSNSummaryScreen() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [summary, setSummary] = useState('');

  const generate = async () => {
    const data = await apiGetGstReport('hsn-summary', { from, to });
    setSummary(`HSN rows: ${data.hsnSummary.length}`);
  };

  return (
    <ScreenContainer>
      <Text variant="headlineSmall" style={styles.title}>HSN Summary</Text>
      <TextInput label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} mode="outlined" style={styles.input} />
      <TextInput label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} mode="outlined" style={styles.input} />
      <Button mode="contained" onPress={() => void generate()}>Generate</Button>
      {!!summary && <Text style={styles.summary}>{summary}</Text>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ title: { marginBottom: 12 }, input: { marginBottom: 12 }, summary: { marginTop: 16 } });
