import type { ReactNode } from 'react';
import { Box, Divider, Typography } from '@mui/material';
import type { SuperAdminDiagnosticReport } from '../../services/superAdminDiagnostics';
import { formatBytes } from '../../services/superAdminDiagnostics';
import { SuperAdminActions } from './SuperAdminActions';
import { SuperAdminLogViewer } from './SuperAdminLogViewer';
import type { ErrorLogEntry } from '../../services/errorLogger';

type Props = {
  report: SuperAdminDiagnosticReport;
  ipaDiagnostic: Record<string, unknown> | null;
  logs: ErrorLogEntry[];
  onRefresh: () => void;
  onCopyReport: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Typography variant="body2" sx={{ color: '#cbd5e1', mb: 0.5 }}>
      <Box component="span" sx={{ color: '#94a3b8', minWidth: 180, display: 'inline-block' }}>
        {label}:
      </Box>{' '}
      {value || '—'}
    </Typography>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="subtitle1" sx={{ color: '#f8fafc', fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {children}
      <Divider sx={{ borderColor: '#334155', mt: 1.5 }} />
    </Box>
  );
}

export function SuperAdminSections({ report, ipaDiagnostic, logs, onRefresh, onCopyReport }: Props) {
  const system = (report.system || {}) as Record<string, unknown>;
  const database = (report.database || {}) as Record<string, unknown>;
  const dbCounts = (database.counts || {}) as Record<string, number>;
  const sync = (report.sync || {}) as Record<string, unknown>;
  const firebase = (report.firebase || {}) as Record<string, unknown>;
  const network = (report.network || {}) as { addresses?: Array<{ name: string; address: string }> };
  const session = (report.session || {}) as Record<string, unknown>;
  const backup = (report.backup || {}) as Record<string, unknown>;

  return (
    <Box>
      <Section title="🖥️ SYSTEM STATUS">
        <Row label="App version" value={`v${String(system.appVersion || '')}`} />
        <Row label="Electron" value={String(system.electronVersion || '')} />
        <Row label="Node" value={String(system.nodeVersion || '')} />
        <Row label="OS" value={String(system.osVersion || '')} />
        <Row label="RAM usage" value={`${String(system.ramMb || 0)} MB`} />
        <Row label="Uptime" value={`${String(system.uptimeSec || 0)}s`} />
      </Section>

      <Section title="🗄️ DATABASE STATUS">
        <Row label="DB path" value={String(database.dbPath || '')} />
        <Row label="DB size" value={formatBytes(Number(database.sizeBytes || 0))} />
        <Row label="Last backup" value={String(backup.lastBackup || '—')} />
        <Row label="Customers (kv)" value={String(dbCounts.customers ?? 0)} />
        <Row label="Items (kv)" value={String(dbCounts.items ?? 0)} />
        <Row label="Vouchers (kv)" value={String(dbCounts.vouchers ?? 0)} />
        <Row label="Parties (kv)" value={String(dbCounts.parties ?? 0)} />
        <Row label="Integrity" value={String(database.integrity || '')} />
        <Row label="Connection" value={database.connected ? '✅ OK' : '❌ Error'} />
      </Section>

      <Section title="🔄 SYNC STATUS">
        <Row label="IPA server" value={sync.ipaOnline ? '✅ Online' : '❌ Offline'} />
        <Row label="Ping latency" value={`${String(sync.ipaLatencyMs || 0)} ms`} />
        <Row label="Last sync" value={String(sync.lastSyncedAt || '—')} />
        <Row label="Pending queue" value={String(sync.pendingQueue ?? 0)} />
        <Row label="syncEnabled" value={String(sync.syncEnabled)} />
        <Row label="middlewareUrl" value={String(sync.middlewareUrl || '')} />
        <Row label="syncJwtToken" value={String(sync.syncJwtToken || '')} />
      </Section>

      <Section title="🔥 FIREBASE STATUS">
        <Row label="Firebase Auth" value={firebase.authConnected ? '✅ Connected' : '❌ Error'} />
        <Row label="Firestore" value={firebase.firestoreConnected ? '✅ Connected' : '❌ Error'} />
        <Row label="UID" value={String(firebase.uid || '')} />
        <Row label="Project ID" value={String(firebase.projectId || '')} />
        <Row label="Firebase reachable" value={firebase.firebaseReachable ? 'yes' : 'no'} />
      </Section>

      <Section title="🌐 NETWORK INFO">
        <Row
          label="Local IPs"
          value={(network.addresses || []).map((a) => `${a.name}: ${a.address}`).join(', ') || '—'}
        />
        <Row label="Internet" value={typeof navigator !== 'undefined' && navigator.onLine ? 'yes' : 'no'} />
        <Row label="IPA reachable" value={sync.ipaOnline ? 'yes' : 'no'} />
        <Row label="Firebase reachable" value={firebase.firebaseReachable ? 'yes' : 'no'} />
      </Section>

      <Section title="👤 CURRENT SESSION">
        <Row label="User" value={String(session.user || '')} />
        <Row label="Role" value={String(session.role || '')} />
        <Row label="Firebase UID" value={String(session.uid || '')} />
        <Row label="Session start" value={String(session.sessionStart || '—')} />
      </Section>

      <Section title="📋 LIVE ERROR LOGS">
        <SuperAdminLogViewer logs={logs} onRefresh={onRefresh} />
      </Section>

      <Section title="⚡ QUICK ACTIONS">
        <SuperAdminActions onRefresh={onRefresh} onCopyReport={onCopyReport} />
      </Section>

      <Section title="🔧 IPA SERVER DIAGNOSTIC">
        {ipaDiagnostic ? (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1,
              bgcolor: '#0b1220',
              borderRadius: 1,
              color: '#e2e8f0',
              fontSize: 11,
              overflow: 'auto',
              maxHeight: 200,
            }}
          >
            {JSON.stringify(ipaDiagnostic, null, 2)}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
            IPA diagnostic not available (offline or missing Firebase token).
          </Typography>
        )}
      </Section>
    </Box>
  );
}
