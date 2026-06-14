import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';
import type { StackScreenProps } from '@react-navigation/stack';
import ScreenContainer from '../../components/common/ScreenContainer';
import { apiCreateParty } from '../../services/api/dataApi';
import { middlewareSync } from '../../services/sync/middlewareSync';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'CustomerForm'>;

export default function CustomerFormScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [gstin, setGstin] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      setError('Name required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = { name, partyType: 'customer', company, gstin, mobile: phone, email, address };
      await apiCreateParty(body);
      await middlewareSync.enqueueCreate('ledger', body);
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <TextInput label="Name" value={name} onChangeText={setName} mode="outlined" style={styles.input} />
      <TextInput label="Company" value={company} onChangeText={setCompany} mode="outlined" style={styles.input} />
      <TextInput label="GSTIN" value={gstin} onChangeText={setGstin} mode="outlined" style={styles.input} />
      <TextInput label="Phone" value={phone} onChangeText={setPhone} mode="outlined" style={styles.input} />
      <TextInput label="Email" value={email} onChangeText={setEmail} mode="outlined" style={styles.input} />
      <TextInput label="Address" value={address} onChangeText={setAddress} mode="outlined" multiline style={styles.input} />
      <Button mode="contained" onPress={() => void save()} loading={loading}>Save</Button>
      {!!error && <HelperText type="error">{error}</HelperText>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ input: { marginBottom: 12 } });
