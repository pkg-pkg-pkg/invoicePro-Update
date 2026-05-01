import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, HelperText, Text, TextInput } from 'react-native-paper';
import { listParties, PartyRecord } from '../services/partyService';

export default function PartiesScreen() {
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parties, setParties] = useState<PartyRecord[]>([]);

  const load = async (query: string) => {
    try {
      setLoading(true);
      setError('');
      const result = await listParties(query);
      setParties(result);
    } catch (e: any) {
      setError(String(e?.response?.data?.error || e?.message || 'Failed to load parties'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const query = search.trim();
    const timer = setTimeout(() => {
      void load(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall">Party Master</Text>
      <Text style={styles.hint}>View Customers and Suppliers</Text>

      <TextInput
        label="Search name/phone"
        mode="outlined"
        value={search}
        onChangeText={setSearch}
        style={styles.input}
      />
      {loading && <HelperText type="info">Searching parties...</HelperText>}
      {!!error && <HelperText type="error">{error}</HelperText>}

      <View style={styles.list}>
        {parties.map((party) => (
          <Card key={party.id} style={styles.card}>
            <Card.Content>
              <Text variant="titleSmall">{party.name}</Text>
              <Text variant="bodySmall">{party.kind}</Text>
              {!!party.phone && <Text variant="bodySmall">Phone: {party.phone}</Text>}
            </Card.Content>
          </Card>
        ))}
      </View>
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
  hint: {
    color: '#475569',
    marginTop: 4,
  },
  input: {
    marginTop: 12,
    marginBottom: 10,
  },
  list: {
    marginTop: 12,
  },
  card: {
    marginBottom: 8,
  },
});

