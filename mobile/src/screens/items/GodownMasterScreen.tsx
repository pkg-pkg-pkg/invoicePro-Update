import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import ScreenContainer from '../../components/common/ScreenContainer';

export default function GodownMasterScreen() {
  return (
    <ScreenContainer>
      <Text variant="headlineSmall" style={styles.title}>Godown Master</Text>
      <Text variant="bodyMedium">Warehouse/godown list syncs from desktop via middleware. Create godowns on desktop for full parity.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ title: { marginBottom: 12 } });
