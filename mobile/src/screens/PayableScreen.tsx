import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';

export default function PayableScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall">Payable (Supplier Dues)</Text>
      <Text style={styles.hint}>Desktop parity in progress. This screen is added for module visibility.</Text>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Current Status</Text>
          <Text>Supplier payable summary and due aging will be synced from desktop middleware.</Text>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  content: { paddingBottom: 24 },
  hint: { color: '#475569', marginTop: 4, marginBottom: 12 },
  card: { marginTop: 8 },
});

