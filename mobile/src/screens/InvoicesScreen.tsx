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
import { createEntry, EntryType } from '../services/paymentService';
import { listParties, PartyRecord } from '../services/partyService';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { canCreateEntry } from '../utils/permissions';
import { useRoute } from '@react-navigation/native';

export default function InvoicesScreen() {
  const route = useRoute<any>();
  const user = useSelector((state: RootState) => state.auth.user);
  const createAllowed = canCreateEntry(user?.mobilePermissions);
  const initialType = route?.params?.defaultEntryType as EntryType | undefined;
  const [entryType, setEntryType] = useState<EntryType>(initialType === 'PAYMENT' ? 'PAYMENT' : 'RECEIPT');
  const [partySearch, setPartySearch] = useState('');
  const [partyLoading, setPartyLoading] = useState(false);
  const [parties, setParties] = useState<PartyRecord[]>([]);
  const [partyId, setPartyId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK_TRANSFER'>('CASH');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedParty = useMemo(
    () => parties.find((p) => p.id === partyId) || null,
    [parties, partyId]
  );

  const canSubmit = useMemo(
    () => !!selectedParty && Number(amount) > 0,
    [selectedParty, amount]
  );

  const loadParties = async (query: string) => {
    try {
      setPartyLoading(true);
      setError('');
      const result = await listParties(query);
      setParties(result);
      if (result.length === 0) {
        setMessage('No parties found. Create ledger from Ledgers tab.');
      } else {
        setMessage('');
      }
    } catch (e: any) {
      setError(String(e?.response?.data?.error || e?.message || 'Failed to load parties'));
    } finally {
      setPartyLoading(false);
    }
  };

  useEffect(() => {
    const query = partySearch.trim();
    const timer = setTimeout(() => {
      void loadParties(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [partySearch]);

  const handleCreate = async () => {
    if (!canSubmit || !selectedParty) {
      setError('Select party and enter valid amount.');
      return;
    }
    try {
      setSaving(true);
      setError('');
      setMessage('');
      await createEntry({
        type: entryType,
        partyId: selectedParty.id,
        partyType: selectedParty.kind,
        amount: Number(amount),
        paymentMode,
        notes: notes.trim() || undefined,
        date: new Date().toISOString(),
      });
      setMessage(`${entryType === 'RECEIPT' ? 'Receipt' : 'Payment'} queued. It will sync when desktop endpoint is reachable.`);
      setAmount('');
      setNotes('');
    } catch (e: any) {
      setError(String(e?.response?.data?.error || e?.message || 'Failed to create entry'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall">Payments & Receipts</Text>
      <Text style={styles.hint}>Mobile policy: Create allowed, Edit/Delete blocked.</Text>
      {!createAllowed && <HelperText type="error">Permission denied for payment/receipt creation.</HelperText>}

      <Card style={styles.card}>
        <Card.Content>
          <SegmentedButtons
            value={entryType}
            onValueChange={(v) => setEntryType(v as EntryType)}
            buttons={[
              { value: 'RECEIPT', label: 'Receipt' },
              { value: 'PAYMENT', label: 'Payment' },
            ]}
          />

          <TextInput
            label="Search Party (name/phone)"
            mode="outlined"
            value={partySearch}
            onChangeText={setPartySearch}
            style={styles.input}
          />
          {partyLoading && <HelperText type="info">Searching parties...</HelperText>}

          <View style={styles.partyList}>
            {parties.map((party) => {
              const selected = party.id === partyId;
              return (
                <Chip
                  key={party.id}
                  selected={selected}
                  style={[styles.partyChip, selected ? styles.partyChipSelected : undefined]}
                  onPress={() => setPartyId(party.id)}
                >
                  {party.name} ({party.kind})
                </Chip>
              );
            })}
          </View>

          <TextInput
            label="Amount"
            mode="outlined"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            style={styles.input}
          />
          <SegmentedButtons
            value={paymentMode}
            onValueChange={(v) => setPaymentMode(v as 'CASH' | 'UPI' | 'BANK_TRANSFER')}
            buttons={[
              { value: 'CASH', label: 'Cash' },
              { value: 'UPI', label: 'UPI' },
              { value: 'BANK_TRANSFER', label: 'Bank' },
            ]}
          />
          <TextInput
            label="Notes (optional)"
            mode="outlined"
            value={notes}
            onChangeText={setNotes}
            style={styles.input}
            multiline
          />

          <Button
            mode="contained"
            onPress={handleCreate}
            disabled={!createAllowed || !canSubmit || saving}
            loading={saving}
          >
            Create {entryType === 'RECEIPT' ? 'Receipt' : 'Payment'}
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
    marginBottom: 10,
  },
  partyList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
});

