import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

export default function ProductsScreen() {
  return (
    <View style={styles.container}>
      <Text variant="headlineSmall">Products</Text>
      <Text>Product management - Coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
});

