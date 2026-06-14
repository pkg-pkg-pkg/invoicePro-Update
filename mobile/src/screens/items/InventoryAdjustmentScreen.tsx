import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Text, TextInput } from 'react-native-paper';
import ScreenContainer from '../../components/common/ScreenContainer';
import { middlewareSync } from '../../services/sync/middlewareSync';

export default function InventoryAdjustmentScreen() {
  const [itemName, setItemName] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');

  const save = async () => {
    await middlewareSync.enqueueCreate('item', {
      type: 'inventory_adjustment',
      itemName,
      qty: Number(qty),
      reason,
      date: new Date().toISOString(),
    });
    setItemName('');
    setQty('');
    setReason('');
  };

  return (
    <ScreenContainer>
      <Text variant="headlineSmall" style={styles.title}>Inventory Adjustment</Text>
      <TextInput label="Item name" value={itemName} onChangeText={setItemName} mode="outlined" style={styles.input} />
      <TextInput label="Qty (+/-)" value={qty} onChangeText={setQty} keyboardType="numbers-and-punctuation" mode="outlined" style={styles.input} />
      <TextInput label="Reason" value={reason} onChangeText={setReason} mode="outlined" style={styles.input} />
      <Button mode="contained" onPress={() => void save()}>Queue adjustment</Button>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ title: { marginBottom: 12 }, input: { marginBottom: 12 } });
