import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, SegmentedButtons, Text, TextInput, HelperText } from 'react-native-paper';
import { createCustomer, createSupplier } from '../services/partyService';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { canCreateLedger } from '../utils/permissions';

export default function ProductsScreen() {
  const user = useSelector((state: RootState) => state.auth.user);
  const createAllowed = canCreateLedger(user?.mobilePermissions);
  const [mode, setMode] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canSubmit = useMemo(() => name.trim().length >= 2 && phone.trim().length >= 10, [name, phone]);

  const handleCreate = async () => {
    if (!canSubmit) {
      setError('Name min 2 chars and valid phone required.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      setMessage('');
      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state: stateName.trim(),
        addressLine1: addressLine1.trim(),
      };
      if (mode === 'CUSTOMER') {
        await createCustomer(payload);
      } else {
        await createSupplier(payload);
      }
      setMessage(`${mode === 'CUSTOMER' ? 'Customer' : 'Supplier'} queued. It will sync to desktop automatically.`);
      setName('');
      setPhone('');
      setCity('');
      setStateName('');
      setAddressLine1('');
    } catch (e: any) {
      setError(String(e?.response?.data?.error || e?.message || 'Failed to create ledger.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall">Ledger Creation</Text>
      <Text style={styles.hint}>Mobile policy: Create allowed, Edit/Delete blocked.</Text>
      {!createAllowed && <HelperText type="error">Permission denied for ledger creation.</HelperText>}

      <Card style={styles.card}>
        <Card.Content>
          <SegmentedButtons
            value={mode}
            onValueChange={(value) => setMode(value as 'CUSTOMER' | 'SUPPLIER')}
            buttons={[
              { value: 'CUSTOMER', label: 'Customer Ledger' },
              { value: 'SUPPLIER', label: 'Supplier Ledger' },
            ]}
          />
          <TextInput label="Name" mode="outlined" value={name} onChangeText={setName} style={styles.input} />
          <TextInput label="Phone" mode="outlined" value={phone} onChangeText={setPhone} style={styles.input} keyboardType="phone-pad" />
          <TextInput label="Address Line 1" mode="outlined" value={addressLine1} onChangeText={setAddressLine1} style={styles.input} />
          <View style={styles.row}>
            <TextInput label="City" mode="outlined" value={city} onChangeText={setCity} style={[styles.input, styles.half, styles.rightGap]} />
            <TextInput label="State" mode="outlined" value={stateName} onChangeText={setStateName} style={[styles.input, styles.half]} />
          </View>
          <Button
            mode="contained"
            onPress={handleCreate}
            disabled={!createAllowed || !canSubmit || loading}
            loading={loading}
          >
            Create {mode === 'CUSTOMER' ? 'Customer' : 'Supplier'}
          </Button>
          {!!message && <HelperText type="info">{message}</HelperText>}
          {!!error && <HelperText type="error">{error}</HelperText>}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    paddingBottom: 24,
  },
  card: {
    marginTop: 12,
  },
  hint: {
    color: '#475569',
    marginTop: 4,
  },
  input: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
  },
  half: {
    flex: 1,
  },
  rightGap: {
    marginRight: 8,
  },
});

