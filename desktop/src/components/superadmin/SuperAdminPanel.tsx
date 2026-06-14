import { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useAuth } from '../../pages/contexts/auth';
import { auth } from '../../firebase/firebase';
import { clearSuperAdminPanelOpen } from '../../services/superAdminService';
import {
  buildSuperAdminDiagnosticReport,
  fetchIpaSuperAdminDiagnostic,
} from '../../services/superAdminDiagnostics';
import { getLogs } from '../../services/errorLogger';
import { SuperAdminSections } from './SuperAdminSections';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SuperAdminPanel({ open, onClose }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Record<string, unknown>>({});
  const [ipaDiagnostic, setIpaDiagnostic] = useState<Record<string, unknown> | null>(null);
  const [logs, setLogs] = useState(getLogs());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await buildSuperAdminDiagnosticReport(user);
      setReport(next);
      setLogs(getLogs());
      const sync = (next.sync || {}) as { middlewareUrl?: string };
      const token = await auth?.currentUser?.getIdToken().catch(() => '');
      if (token && sync.middlewareUrl) {
        setIpaDiagnostic(await fetchIpaSuperAdminDiagnostic(sync.middlewareUrl, token));
      } else {
        setIpaDiagnostic(null);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!open) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        clearSuperAdminPanelOpen();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copyReport = async () => {
    const payload = { ...report, ipaDiagnostic, logs };
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 20000,
        bgcolor: 'rgba(2, 6, 23, 0.96)',
        color: '#e2e8f0',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          borderBottom: '1px solid #334155',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          Super Admin Diagnostics
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {loading ? <CircularProgress size={18} sx={{ color: '#94a3b8' }} /> : null}
          <IconButton
            aria-label="Close"
            onClick={() => {
              clearSuperAdminPanelOpen();
              onClose();
            }}
            sx={{ color: '#e2e8f0' }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        <SuperAdminSections
          report={report}
          ipaDiagnostic={ipaDiagnostic}
          logs={logs}
          onRefresh={() => void refresh()}
          onCopyReport={() => void copyReport()}
        />
      </Box>
      <Typography variant="caption" sx={{ px: 2, py: 1, color: '#64748b' }}>
        Press ESC to close. Normal users never see this panel.
      </Typography>
    </Box>
  );
}
