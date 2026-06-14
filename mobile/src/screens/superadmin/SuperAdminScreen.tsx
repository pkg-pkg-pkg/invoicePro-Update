import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Snackbar, Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDispatch } from 'react-redux';
import { auth, db } from '../../firebase/firebase';
import { getLogs, clearLogs } from '../../services/errorLogger';
import { CACHE_KEYS } from '../../services/cache/offlineCache';
import { getMiddlewareOrigin, setMiddlewareUrl } from '../../services/middlewareUrl';
import { middlewareSync } from '../../services/sync/middlewareSync';
import { clearAuthSession } from '../../services/authStorage';
import { logout, clearSuperAdminMode } from '../../store/slices/authSlice';
import { setMobileAuthToken } from '../../services/api';
import { signOut } from 'firebase/auth';

type CacheRow = { key: string; size: number };

async function listCacheRows(): Promise<CacheRow[]> {
  const rows: CacheRow[] = [];
  for (const key of Object.values(CACHE_KEYS)) {
    const raw = await AsyncStorage.getItem(key);
    rows.push({ key, size: raw ? raw.length : 0 });
  }
  return rows;
}

async function pingMiddleware(): Promise<{ ok: boolean; ms: number }> {
  const origin = getMiddlewareOrigin();
  const start = Date.now();
  try {
    const res = await fetch(`${origin}/health`, { method: 'GET' });
    return { ok: res.ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: Date.now() - start };
  }
}

export default function SuperAdminScreen() {
  const dispatch = useDispatch();
  const [ping, setPing] = useState({ ok: false, ms: 0 });
  const [cacheRows, setCacheRows] = useState<CacheRow[]>([]);
  const [logs, setLogs] = useState(getLogs());
  const [toast, setToast] = useState('');

  const refresh = useCallback(async () => {
    setPing(await pingMiddleware());
    setCacheRows(await listCacheRows());
    setLogs(getLogs());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exit = async () => {
    await signOut(auth!).catch(() => undefined);
    dispatch(clearSuperAdminMode());
  };

  const resetAuth = async () => {
    await clearAuthSession();
    setMobileAuthToken(null);
    dispatch(logout());
    dispatch(clearSuperAdminMode());
  };

  const clearAllCache = async () => {
    await AsyncStorage.multiRemove(Object.values(CACHE_KEYS));
    setToast('Cache cleared');
    await refresh();
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>
          Super Admin Diagnostics
        </Text>

        <Text style={styles.section}>SERVER CONNECTION</Text>
        <Text style={styles.row}>IPA URL: {getMiddlewareOrigin()}</Text>
        <Text style={styles.row}>Ping: {ping.ok ? `✅ ${ping.ms}ms` : '❌ offline'}</Text>
        <Text style={styles.row}>Auth token: {auth?.currentUser ? 'Firebase present' : 'none'}</Text>
        <Button mode="outlined" onPress={() => void refresh()} style={styles.btn}>
          Test connection
        </Button>

        <Text style={styles.section}>FIREBASE STATUS</Text>
        <Text style={styles.row}>Auth: {auth?.currentUser ? '✅ connected' : '❌ error'}</Text>
        <Text style={styles.row}>Firestore: {db ? '✅ connected' : '❌ error'}</Text>
        <Text style={styles.row}>UID: {auth?.currentUser?.uid || '—'}</Text>

        <Text style={styles.section}>SYNC STATUS</Text>
        <Text style={styles.row}>Force sync via middleware worker</Text>
        <Button mode="contained" onPress={() => void middlewareSync.syncNow()} style={styles.btn}>
          Force sync now
        </Button>

        <Text style={styles.section}>DEVICE INFO</Text>
        <Text style={styles.row}>App: PVE InvoicePro Mobile 1.0.0</Text>
        <Text style={styles.row}>React Native: 0.73.0</Text>

        <Text style={styles.section}>CACHE STATUS</Text>
        {cacheRows.map((row) => (
          <Text key={row.key} style={styles.row}>
            {row.key}: {row.size} bytes
          </Text>
        ))}
        <Button mode="outlined" onPress={() => void clearAllCache()} style={styles.btn}>
          Clear all cache
        </Button>

        <Text style={styles.section}>ERROR LOGS</Text>
        {logs.slice(-20).map((entry, idx) => (
          <Text key={`${entry.ts}-${idx}`} style={styles.log}>
            {entry.level === 'error' ? '🔴' : '🟡'} {entry.message}
          </Text>
        ))}
        <Button mode="outlined" onPress={() => void clearLogs().then(refresh)} style={styles.btn}>
          Clear logs
        </Button>

        <Text style={styles.section}>QUICK ACTIONS</Text>
        <Button mode="outlined" onPress={() => void setMiddlewareUrl(getMiddlewareOrigin())} style={styles.btn}>
          Reset server URL to env
        </Button>
        <Button mode="outlined" color="error" onPress={() => void resetAuth()} style={styles.btn}>
          Reset auth
        </Button>
        <Button mode="contained" onPress={() => void exit()} style={styles.btn}>
          Back / Exit super admin
        </Button>
      </ScrollView>
      <Snackbar visible={Boolean(toast)} onDismiss={() => setToast('')} duration={3000}>
        {toast}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  content: { padding: 16, paddingBottom: 40 },
  title: { color: '#f8fafc', marginBottom: 12 },
  section: { color: '#93c5fd', fontWeight: '700', marginTop: 16, marginBottom: 6 },
  row: { color: '#e2e8f0', marginBottom: 4, fontSize: 13 },
  log: { color: '#cbd5e1', fontSize: 12, marginBottom: 2 },
  btn: { marginTop: 8, alignSelf: 'flex-start' },
});
