import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';
import type { StackScreenProps } from '@react-navigation/stack';
import ScreenContainer from '../../components/common/ScreenContainer';
import { apiCreateItem } from '../../services/api/dataApi';
import { middlewareSync } from '../../services/sync/middlewareSync';
import type { MoreStackParamList } from '../../navigation/types';

type Props = StackScreenProps<MoreStackParamList, 'ItemForm'>;

export default function ItemFormScreen({ navigation }: Props) {
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [hsn, setHsn] = useState('');
  const [saleRate, setSaleRate] = useState('');
  const [purchaseRate, setPurchaseRate] = useState('');
  const [stock, setStock] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [taxPct, setTaxPct] = useState('18');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const body = {
        name: name.trim(),
        hsn_code: hsn.trim(),
        unit: unit.trim(),
        sale_rate: Number(saleRate || 0),
        tax_pct: Number(taxPct || 0),
        extra_data: JSON.stringify({ sku, purchase_rate: Number(purchaseRate || 0), stock: Number(stock || 0) }),
      };
      await apiCreateItem(body);
      await middlewareSync.enqueueCreate('item', body);
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
      <TextInput label="SKU" value={sku} onChangeText={setSku} mode="outlined" style={styles.input} />
      <TextInput label="HSN Code" value={hsn} onChangeText={setHsn} mode="outlined" style={styles.input} />
      <TextInput label="Unit" value={unit} onChangeText={setUnit} mode="outlined" style={styles.input} />
      <TextInput label="Purchase Price" value={purchaseRate} onChangeText={setPurchaseRate} keyboardType="decimal-pad" mode="outlined" style={styles.input} />
      <TextInput label="Sale Price" value={saleRate} onChangeText={setSaleRate} keyboardType="decimal-pad" mode="outlined" style={styles.input} />
      <TextInput label="GST %" value={taxPct} onChangeText={setTaxPct} keyboardType="decimal-pad" mode="outlined" style={styles.input} />
      <TextInput label="Opening Stock" value={stock} onChangeText={setStock} keyboardType="number-pad" mode="outlined" style={styles.input} />
      <Button mode="contained" onPress={() => void save()} loading={loading}>Save</Button>
      {!!error && <HelperText type="error">{error}</HelperText>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ input: { marginBottom: 12 } });
