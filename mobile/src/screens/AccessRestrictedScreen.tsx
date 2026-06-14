import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialIcons';

type Props = {
  module?: string;
};

export default function AccessRestrictedScreen({ module }: Props) {
  return (
    <View style={styles.container}>
      <Surface style={styles.surface}>
        <Icon name="lock" size={48} color="#b00020" style={styles.icon} />
        <Text variant="headlineSmall" style={styles.title}>
          Access Restricted
        </Text>
        <Text variant="bodyMedium" style={styles.message}>
          You do not have permission to access
          {module ? ` the ${module} module` : ' this section'}.
        </Text>
        <Text variant="bodySmall" style={styles.hint}>
          Contact your administrator to request access.
        </Text>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f5f5',
  },
  surface: {
    padding: 24,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#444',
  },
  hint: {
    textAlign: 'center',
    color: '#666',
  },
});
