import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, SegmentedButtons, TextInput } from 'react-native-paper';
import type { StackScreenProps } from '@react-navigation/stack';
import ScreenContainer from '../../components/common/ScreenContainer';
import { apiCreateVoucher } from '../../services/api/dataApi';
import { middlewareSync } from '../../services/sync/middlewareSync';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'PaymentReceiptDesk'>;

export default function PaymentReceiptDeskScreen({ navigation }: Props) {
  const [mode, setMode] = useState('receipt');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [payMode, setPayMode] = useState('cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!party.trim() || !amount.trim()) {
      setError('Party and amount required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = {
        voucherType: mode,
        partyName: party.trim(),
        amount: Number(amount),
        paymentMode: payMode,
        notes,
        date: new Date().toISOString().slice(0, 10),
      };
      await apiCreateVoucher(payload);
      await middlewareSync.enqueueCreate(mode === 'receipt' ? 'receipt' : 'payment', payload);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <SegmentedButtons
        value={mode}
        onValueChange={setMode}
        buttons={[
          { value: 'receipt', label: 'Receipt' },
          { value: 'payment', label: 'Payment' },
        ]}
        style={styles.segment}
      />
      <TextInput label="Party" value={party} onChangeText={setParty} mode="outlined" style={styles.input} />
      <TextInput label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" mode="outlined" style={styles.input} />
      <SegmentedButtons
        value={payMode}
        onValueChange={setPayMode}
        buttons={[
          { value: 'cash', label: 'Cash' },
          { value: 'upi', label: 'UPI' },
          { value: 'bank', label: 'Bank' },
        ]}
        style={styles.segment}
      />
      <TextInput label="Notes" value={notes} onChangeText={setNotes} mode="outlined" style={styles.input} />
      <Button mode="contained" onPress={() => void save()} loading={loading}>Create</Button>
      {!!error && <HelperText type="error">{error}</HelperText>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ segment: { marginBottom: 12 }, input: { marginBottom: 12 } });
