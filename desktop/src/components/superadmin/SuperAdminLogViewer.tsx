import { useMemo, useState } from 'react';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import type { ErrorLogEntry } from '../../services/errorLogger';
import { clearLogs, exportLogs, getLogs } from '../../services/errorLogger';

type Props = {
  logs: ErrorLogEntry[];
  onRefresh: () => void;
};

function levelIcon(level: ErrorLogEntry['level']): string {
  if (level === 'error') return '🔴';
  if (level === 'warn') return '🟡';
  return '🟢';
}

export function SuperAdminLogViewer({ logs, onRefresh }: Props) {
  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return logs;
    return logs.filter((l) => l.message.toLowerCase().includes(q) || l.level.includes(q));
  }, [filter, logs]);

  const copyLogs = async () => {
    await navigator.clipboard.writeText(exportLogs());
  };

  const handleClear = () => {
    clearLogs();
    onRefresh();
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Filter logs…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ minWidth: 200, flex: 1 }}
        />
        <Button size="small" variant="outlined" onClick={() => void copyLogs()}>
          Copy
        </Button>
        <Button size="small" variant="outlined" onClick={() => void navigator.clipboard.writeText(exportLogs())}>
          Export
        </Button>
        <Button size="small" color="warning" variant="outlined" onClick={handleClear}>
          Clear
        </Button>
      </Stack>
      <Box
        sx={{
          maxHeight: 220,
          overflow: 'auto',
          bgcolor: '#0b1220',
          border: '1px solid #334155',
          borderRadius: 1,
          p: 1,
          fontFamily: 'monospace',
          fontSize: 12,
        }}
      >
        {filtered.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No logs
          </Typography>
        ) : (
          filtered.map((entry, idx) => (
            <Box key={`${entry.ts}-${idx}`} sx={{ color: '#e2e8f0', mb: 0.5 }}>
              {levelIcon(entry.level)} [{new Date(entry.ts).toLocaleTimeString()}] {entry.message}
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

export function refreshLogSnapshot(): ErrorLogEntry[] {
  return getLogs();
}
