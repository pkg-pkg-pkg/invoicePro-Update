import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, Card } from 'react-native-paper';
import type { StackNavigationProp } from '@react-navigation/stack';
import ScreenContainer from './ScreenContainer';

export type HubItem = {
  title: string;
  route: string;
  subtitle?: string;
};

type Props = {
  title: string;
  items: HubItem[];
  navigation: StackNavigationProp<Record<string, object | undefined>>;
};

export default function ModuleHubScreen({ title, items, navigation }: Props) {
  return (
    <ScreenContainer>
      <Text variant="headlineSmall" style={styles.title}>
        {title}
      </Text>
      {items.map((item) => (
        <TouchableOpacity key={item.route} onPress={() => navigation.navigate(item.route)}>
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleMedium">{item.title}</Text>
              {item.subtitle ? (
                <Text variant="bodySmall" style={styles.sub}>
                  {item.subtitle}
                </Text>
              ) : null}
            </Card.Content>
          </Card>
        </TouchableOpacity>
      ))}
      <View style={styles.spacer} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 12 },
  card: { marginBottom: 10 },
  sub: { color: '#666', marginTop: 4 },
  spacer: { height: 24 },
});
