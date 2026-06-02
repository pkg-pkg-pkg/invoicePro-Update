import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import MobileErrorBoundary from './src/components/MobileErrorBoundary';
import { restoreAuthSession } from './src/services/authStorage';
import { setCredentials } from './src/store/slices/authSlice';
import { setMobileApiBaseUrl, setMobileAuthToken } from './src/services/api';
import { readSyncConfig } from './src/services/sync/storage';
import { setSyncStatus } from './src/store/slices/syncSlice';
import { mobileSyncWorker } from './src/services/sync/mobileSyncWorker';

export default function App() {
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        const session = await restoreAuthSession();
        if (session?.token && session.user) {
          setMobileAuthToken(session.token);
          store.dispatch(
            setCredentials({
              user: session.user,
              token: session.token,
            })
          );
        }
        const syncConfig = await readSyncConfig();
        store.dispatch(
          setSyncStatus({
            endpointBase: syncConfig.endpointBase,
          })
        );
        if (syncConfig.endpointBase) {
          setMobileApiBaseUrl(syncConfig.endpointBase.replace(/\/mobile-sync\/?$/, '/api'));
        }
      } catch (e) {
        console.warn('Mobile bootstrap failed', e);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    };
    bootstrap();
    mobileSyncWorker.start();
    return () => {
      cancelled = true;
      mobileSyncWorker.stop();
    };
  }, []);

  if (!bootstrapped) {
    return (
      <View style={styles.boot}>
        <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
        <ActivityIndicator size="large" color="#1976d2" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <Provider store={store}>
          <PaperProvider>
            <MobileErrorBoundary>
              <NavigationContainer>
                <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
                <AppNavigator />
              </NavigationContainer>
            </MobileErrorBoundary>
          </PaperProvider>
        </Provider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
