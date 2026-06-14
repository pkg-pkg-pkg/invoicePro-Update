import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DownloadIcon from '@mui/icons-material/Download';

import {
  ledgerClassificationService,
  type AccountingStructureAudit,
} from '../../../services/masters/ledgerClassificationService';

function exportCsv(audit: AccountingStructureAudit) {
  const header = ['Ledger Name', 'Current Group', 'Expected Group', 'Mismatch', 'Role', 'Auto Created', 'Unused'];
  const lines = audit.rows.map((r) =>
    [
      r.ledgerName,
      r.currentGroupName,
      r.expectedGroupName,
      r.mismatch ? 'Yes' : 'No',
      r.role,
      r.autoCreated ? 'Yes' : 'No',
      r.unused ? 'Yes' : 'No',
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(',')
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ledger-structure-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountingStructureAuditPage() {
  const navigate = useNavigate();
  const [audit, setAudit] = useState<AccountingStructureAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showMismatchesOnly, setShowMismatchesOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAudit(await ledgerClassificationService.runAudit());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleMigrate = async (dryRun: boolean) => {
    setMigrating(true);
    setMessage(null);
    setError(null);
    try {
      const result = await ledgerClassificationService.applyMigration({ dryRun });
      setMessage(
        dryRun
          ? `Preview: ${result.applied} ledger(s) would be reclassified.`
          : `Reclassified ${result.applied} ledger(s). Skipped ${result.skipped}.`
      );
      if (!dryRun) await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMigrating(false);
    }
  };

  const rows = audit?.rows.filter((r) => !showMismatchesOnly || r.mismatch) ?? [];
  const s = audit?.summary;

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={800}>
          Accounting Structure Audit
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="outlined" onClick={() => navigate('/masters/accounting-integrity')}>
            Voucher Integrity Audit
          </Button>
          <Button variant="outlined" onClick={() => navigate('/masters/chart-of-accounts')}>
            Chart of Accounts
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
          {audit ? (
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportCsv(audit)}>
              Export CSV
            </Button>
          ) : null}
          <Button
            variant="outlined"
            startIcon={<AutoFixHighIcon />}
            disabled={migrating || !audit?.summary.misclassified}
            onClick={() => void handleMigrate(true)}
          >
            Preview Migration
          </Button>
          <Button
            variant="contained"
            color="warning"
            startIcon={<AutoFixHighIcon />}
            disabled={migrating || !audit?.summary.misclassified}
            onClick={() => void handleMigrate(false)}
          >
            Apply Safe Reclassification
          </Button>
        </Stack>
      </Stack>

      {message ? <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert> : null}
      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {loading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : s ? (
        <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            {[
              { label: 'Total Ledgers', value: s.totalLedgers },
              { label: 'Correctly Classified', value: s.correctlyClassified, color: 'success.main' },
              { label: 'Misclassified', value: s.misclassified, color: 'warning.main' },
              { label: 'Unused', value: s.unused },
              { label: 'Duplicates', value: s.duplicates, color: 'error.main' },
              { label: 'Legacy Cash/Bank Group', value: s.legacyGroupLedgers },
            ].map((item) => (
              <Grid item xs={6} md={4} lg={2} key={item.label}>
                <Card>
                  <CardContent>
                    <Typography variant="caption" color="text.secondary">
                      {item.label}
                    </Typography>
                    <Typography variant="h5" fontWeight={800} color={item.color}>
                      {item.value}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Alert severity="info" sx={{ mb: 2 }}>
            Migration plan: reclassifies ledgers to expected groups without deleting data. System ledgers in legacy
            cash/bank group are moved to Cash-in-Hand or Bank Accounts. Review preview before applying.
          </Alert>

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button
              size="small"
              variant={showMismatchesOnly ? 'contained' : 'outlined'}
              onClick={() => setShowMismatchesOnly((v) => !v)}
            >
              {showMismatchesOnly ? 'Show all' : 'Mismatches only'}
            </Button>
          </Stack>

          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Ledger Name</TableCell>
                <TableCell>Current Group</TableCell>
                <TableCell>Expected Group</TableCell>
                <TableCell>Mismatch</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Flags</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.ledgerId} sx={r.mismatch ? { bgcolor: 'warning.50' } : undefined}>
                  <TableCell>{r.ledgerName}</TableCell>
                  <TableCell>{r.currentGroupName}</TableCell>
                  <TableCell>{r.expectedGroupName}</TableCell>
                  <TableCell>
                    {r.mismatch ? <Chip size="small" color="warning" label="Yes" /> : '—'}
                  </TableCell>
                  <TableCell>{r.role}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {r.autoCreated ? <Chip size="small" label="Auto" variant="outlined" /> : null}
                      {r.unused ? <Chip size="small" label="Unused" variant="outlined" /> : null}
                      {r.duplicateOf ? <Chip size="small" label="Duplicate" color="error" variant="outlined" /> : null}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      ) : null}
    </Box>
  );
}
