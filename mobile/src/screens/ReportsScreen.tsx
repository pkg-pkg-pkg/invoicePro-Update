import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  Button,
  Card,
  Chip,
  HelperText,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { canCreateInvoice } from '../utils/permissions';
import { listParties, PartyRecord } from '../services/partyService';
import { createSimpleInvoice, InvoiceLineInput } from '../services/invoiceService';
import { useRoute } from '@react-navigation/native';

export default function ReportsScreen() {
  const route = useRoute<any>();
  const user = useSelector((state: RootState) => state.auth.user);
  const createAllowed = canCreateInvoice(user?.permissions ?? user?.mobilePermissions);
  const initialType = route?.params?.defaultInvoiceType as 'SALES_INVOICE' | 'PURCHASE_INVOICE' | undefined;
  const [invoiceType, setInvoiceType] = useState<'SALES_INVOICE' | 'PURCHASE_INVOICE'>(
    initialType === 'PURCHASE_INVOICE' ? 'PURCHASE_INVOICE' : 'SALES_INVOICE'
  );
  const [partySearch, setPartySearch] = useState('');
  const [parties, setParties] = useState<PartyRecord[]>([]);
  const [partyId, setPartyId] = useState('');
  const [items, setItems] = useState<InvoiceLineInput[]>([
    { itemName: '', quantity: 1, rate: 0, gstRate: 18 },
  ]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedParty = useMemo(() => parties.find((p) => p.id === partyId) || null, [parties, partyId]);
  const canSubmit = useMemo(() => {
    if (!selectedParty || items.length === 0) return false;
    return items.every((line) => line.itemName.trim().length > 0 && line.quantity > 0 && line.rate > 0);
  }, [selectedParty, items]);

  const totals = useMemo(() => {
    const subtotal = items.reduce((sum, line) => sum + line.quantity * line.rate, 0);
    const totalTax = items.reduce(
      (sum, line) => sum + ((line.quantity * line.rate) * line.gstRate) / 100,
      0
    );
    const grandTotal = subtotal + totalTax;
    return { subtotal, totalTax, grandTotal };
  }, [items]);

  const loadParties = async (query: string) => {
    try {
      setError('');
      const result = await listParties(query);
      setParties(result);
    } catch (e: any) {
      setError(String(e?.response?.data?.error || e?.message || 'Failed to load parties'));
    }
  };

  useEffect(() => {
    const query = partySearch.trim();
    const timer = setTimeout(() => {
      void loadParties(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [partySearch]);

  const handleCreateInvoice = async () => {
    if (!canSubmit || !selectedParty) {
      setError('Select party and enter valid item, qty, and rate.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const invoice = await createSimpleInvoice({
        invoiceType,
        partyId: selectedParty.id,
        partyType: selectedParty.kind,
        items,
        notes: notes.trim() || undefined,
      });
      setMessage(`Invoice queued: ${String(invoice?.invoiceNumber || 'PENDING')}. It will sync to desktop.`);
      setItems([{ itemName: '', quantity: 1, rate: 0, gstRate: 18 }]);
      setNotes('');
    } catch (e: any) {
      setError(String(e?.response?.data?.error || e?.message || 'Invoice create failed'));
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    setItems((prev) => [...prev, { itemName: '', quantity: 1, rate: 0, gstRate: 18 }]);
  };

  const removeLine = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateLine = (index: number, patch: Partial<InvoiceLineInput>) => {
    setItems((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall">Invoice Create</Text>
      <Text style={styles.hint}>Mobile policy: Create allowed, Edit/Delete blocked.</Text>
      {!createAllowed && <HelperText type="error">Permission denied for invoice creation.</HelperText>}

      <Card style={styles.card}>
        <Card.Content>
          <SegmentedButtons
            value={invoiceType}
            onValueChange={(v) => setInvoiceType(v as 'SALES_INVOICE' | 'PURCHASE_INVOICE')}
            buttons={[
              { value: 'SALES_INVOICE', label: 'Sales' },
              { value: 'PURCHASE_INVOICE', label: 'Purchase' },
            ]}
          />

          <TextInput
            label="Search Party"
            mode="outlined"
            value={partySearch}
            onChangeText={setPartySearch}
            style={styles.input}
          />
          <View style={styles.partyList}>
            {parties.map((party) => {
              const selected = party.id === partyId;
              return (
                <Chip
                  key={party.id}
                  selected={selected}
                  onPress={() => setPartyId(party.id)}
                  style={[styles.partyChip, selected ? styles.partyChipSelected : undefined]}
                >
                  {party.name} ({party.kind})
                </Chip>
              );
            })}
          </View>

          <Text variant="titleSmall" style={styles.input}>Invoice Items</Text>
          {items.map((line, index) => (
            <Card key={`line-${index}`} style={styles.lineCard}>
              <Card.Content>
                <TextInput
                  label={`Item ${index + 1} Name`}
                  mode="outlined"
                  value={line.itemName}
                  onChangeText={(v) => updateLine(index, { itemName: v })}
                  style={styles.input}
                />
                <View style={styles.row}>
                  <TextInput
                    label="Qty"
                    mode="outlined"
                    value={String(line.quantity)}
                    onChangeText={(v) => updateLine(index, { quantity: Number(v || 0) })}
                    keyboardType="numeric"
                    style={[styles.input, styles.half, styles.rightGap]}
                  />
                  <TextInput
                    label="Rate"
                    mode="outlined"
                    value={String(line.rate)}
                    onChangeText={(v) => updateLine(index, { rate: Number(v || 0) })}
                    keyboardType="numeric"
                    style={[styles.input, styles.half]}
                  />
                </View>
                <View style={styles.row}>
                  <TextInput
                    label="GST %"
                    mode="outlined"
                    value={String(line.gstRate)}
                    onChangeText={(v) => updateLine(index, { gstRate: Number(v || 0) })}
                    keyboardType="numeric"
                    style={[styles.input, styles.half, styles.rightGap]}
                  />
                  <Button mode="outlined" onPress={() => removeLine(index)} style={[styles.input, styles.half]}>
                    Remove
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ))}
          <Button mode="outlined" onPress={addLine} style={styles.input}>
            + Add Item Row
          </Button>
          <Card style={styles.totalsCard}>
            <Card.Content>
              <Text variant="titleSmall">Bill Preview</Text>
              <Text>Subtotal: Rs. {totals.subtotal.toFixed(2)}</Text>
              <Text>GST: Rs. {totals.totalTax.toFixed(2)}</Text>
              <Text variant="titleMedium">Grand Total: Rs. {totals.grandTotal.toFixed(2)}</Text>
            </Card.Content>
          </Card>
          <TextInput label="Notes (optional)" mode="outlined" value={notes} onChangeText={setNotes} style={styles.input} multiline />
          <Button mode="contained" onPress={handleCreateInvoice} disabled={!createAllowed || !canSubmit || loading} loading={loading}>
            Create Invoice
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
    marginTop: 10,
  },
  partyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 8,
  },
  partyChip: {
    marginRight: 8,
    marginBottom: 8,
  },
  partyChipSelected: {
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  lineCard: {
    marginTop: 8,
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
  totalsCard: {
    marginTop: 10,
  },
});

