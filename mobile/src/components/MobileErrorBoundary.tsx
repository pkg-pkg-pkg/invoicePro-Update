import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from 'react-native-paper';

type Props = { children: ReactNode };
type State = { error: Error | null };

export default class MobileErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('MobileErrorBoundary', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>App error</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.message}>{this.state.error.message}</Text>
          </ScrollView>
          <Button mode="contained" onPress={() => this.setState({ error: null })}>
            Try again
          </Button>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff5f5',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#b71c1c',
  },
  scroll: {
    maxHeight: 240,
    marginBottom: 16,
  },
  message: {
    fontSize: 14,
    color: '#333',
  },
});
