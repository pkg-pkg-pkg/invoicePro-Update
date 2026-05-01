import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';

export default function DashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Dashboard
      </Text>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Total Sales</Text>
          <Text variant="headlineMedium">₹1,25,000</Text>
        </Card.Content>
      </Card>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Total Purchase</Text>
          <Text variant="headlineMedium">₹85,000</Text>
        </Card.Content>
      </Card>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Outstanding</Text>
          <Text variant="headlineMedium">₹45,000</Text>
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
  title: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 16,
  },
});

