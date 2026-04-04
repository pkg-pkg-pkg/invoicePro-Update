import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function ReportsScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">Reports</Text>
      <Text>Reports - Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});

