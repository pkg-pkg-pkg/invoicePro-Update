import React from 'react';
import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { normalizeStatus } from '../../utils/format';

const COLORS: Record<string, string> = {
  paid: '#2e7d32',
  overdue: '#c62828',
  partial: '#ef6c00',
  draft: '#757575',
  open: '#1976d2',
};

type Props = { status?: string };

export default function StatusBadge({ status }: Props) {
  const key = normalizeStatus(status);
  return (
    <Chip compact textStyle={styles.text} style={[styles.chip, { backgroundColor: `${COLORS[key]}22` }]}>
      {key.toUpperCase()}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start' },
  text: { fontSize: 10, color: '#333' },
});
