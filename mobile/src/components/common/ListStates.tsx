import React from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';

export function ListLoading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
      <Text style={styles.msg}>Loading…</Text>
    </View>
  );
}

export function ListEmpty({ message }: { message: string }) {
  return (
    <View style={styles.center}>
      <Text variant="bodyMedium">{message}</Text>
    </View>
  );
}

export function ListError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={styles.center}>
      <Text variant="bodyMedium" style={styles.error}>
        {message}
      </Text>
      <Button mode="outlined" onPress={onRetry} style={styles.btn}>
        Retry
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: 32, alignItems: 'center' },
  msg: { marginTop: 8, color: '#666' },
  error: { color: '#c62828', textAlign: 'center' },
  btn: { marginTop: 12 },
});
