import React, { useEffect, useState } from 'react';
import { Provider } from 'react-redux';
import { NavigationContainer } from '@react-navigation/native';
import { ActivityIndicator, PaperProvider } from 'react-native-paper';
import { store } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import { readAuthSession } from './src/services/authStorage';
import { setCredentials } from './src/store/slices/authSlice';
import { setMobileAuthToken } from './src/services/api';

export default function App() {
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const saved = await readAuthSession();
        if (saved?.token && saved?.user) {
          setMobileAuthToken(saved.token);
          store.dispatch(
            setCredentials({
              token: saved.token,
              user: saved.user,
            })
          );
        }
      } finally {
        if (mounted) setBootstrapped(true);
      }
    };
    void bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  if (!bootstrapped) {
    return (
      <PaperProvider>
        <ActivityIndicator style={{ flex: 1 }} animating />
      </PaperProvider>
    );
  }

  return (
    <Provider store={store}>
      <PaperProvider>
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </PaperProvider>
    </Provider>
  );
}

