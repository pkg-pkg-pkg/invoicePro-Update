import React from 'react';
import { StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import ScreenContainer from '../../components/common/ScreenContainer';

export default function PriceListScreen() {
  return (
    <ScreenContainer>
      <Text variant="headlineSmall" style={styles.title}>Price Lists</Text>
      <Text variant="bodyMedium">Price list management — synced from desktop. Pull to refresh on Items list for latest rates.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ title: { marginBottom: 12 } });
