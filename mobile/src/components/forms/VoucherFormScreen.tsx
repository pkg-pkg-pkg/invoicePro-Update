import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import type { StackScreenProps } from '@react-navigation/stack';
import ScreenContainer from '../common/ScreenContainer';
import { apiCreateVoucher } from '../../services/api/dataApi';
import { middlewareSync } from '../../services/sync/middlewareSync';

type Props = {
  title: string;
  voucherType: string;
  partyLabel: string;
  navigation: StackScreenProps<Record<string, object | undefined>>['navigation'];
};

export default function VoucherFormScreen({ title, voucherType, partyLabel, navigation }: Props) {
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!partyName.trim() || !amount.trim()) {
      setError('Party and amount are required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        voucherType,
        partyName: partyName.trim(),
        amount: Number(amount),
        grandTotal: Number(amount),
        notes,
        date: new Date().toISOString().slice(0, 10),
        status: 'open',
      };
      await apiCreateVoucher(payload);
      await middlewareSync.enqueueCreate('invoice', payload);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text variant="headlineSmall" style={styles.title}>{title}</Text>
      <TextInput label={partyLabel} value={partyName} onChangeText={setPartyName} mode="outlined" style={styles.input} />
      <TextInput label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" mode="outlined" style={styles.input} />
      <TextInput label="Notes" value={notes} onChangeText={setNotes} mode="outlined" multiline style={styles.input} />
      <Button mode="contained" onPress={() => void save()} loading={loading}>Save</Button>
      {!!error && <HelperText type="error">{error}</HelperText>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 12 },
  input: { marginBottom: 12 },
});
