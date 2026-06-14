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
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';

import {
  financialStatementReadinessAuditService,
  type FinancialStatementReadinessAudit,
  type MissingFeature,
} from '../../../services/audit/financialStatementReadinessAuditService';

const severityColor: Record<MissingFeature['severity'], 'error' | 'warning' | 'info' | 'default'> = {
  Critical: 'error',
  High: 'warning',
  Medium: 'info',
  Low: 'default',
};

export default function FinancialStatementReadinessAuditPage() {
  const navigate = useNavigate();
  const [audit, setAudit] = useState<FinancialStatementReadinessAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAudit(await financialStatementReadinessAuditService.runAudit());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = audit
    ? [...new Set(audit.checks.map((c) => c.section))]
    : [];

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={800}>
          Financial Statement Readiness Audit
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="outlined" onClick={() => navigate('/masters/accounting-integrity')}>
            Integrity Audit
          </Button>
          <Button variant="outlined" onClick={() => navigate('/reports?view=financial')}>
            Financial Reports
          </Button>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Verifies readiness for Cash Book, Bank Book, Journal Register, Trial Balance, Profit &amp; Loss, and Balance Sheet
        from voucher postings and ledger transactions.
      </Alert>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {loading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : audit ? (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Typography variant="caption" color="text.secondary">
                    Readiness Score
                  </Typography>
                  <Typography variant="h3" fontWeight={800} color={audit.readinessScore >= 85 ? 'success.main' : audit.readinessScore >= 60 ? 'warning.main' : 'error.main'}>
                    {audit.readinessScore}%
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={audit.readinessScore}
                    color={audit.readinessScore >= 85 ? 'success' : audit.readinessScore >= 60 ? 'warning' : 'error'}
                    sx={{ mt: 1, height: 8, borderRadius: 1 }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Generated {new Date(audit.generatedAt).toLocaleString('en-IN')}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={8}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                    Blocking Issues ({audit.blockingIssues.length})
                  </Typography>
                  {audit.blockingIssues.length === 0 ? (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <CheckCircleIcon color="success" fontSize="small" />
                      <Typography variant="body2">No blocking issues — statements can be generated.</Typography>
                    </Stack>
                  ) : (
                    <Stack spacing={0.5}>
                      {audit.blockingIssues.map((issue) => (
                        <Typography key={issue} variant="body2" color="error.main">
                          • {issue}
                        </Typography>
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Statement Readiness
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {audit.statements.map((s) => (
              <Grid item xs={12} sm={6} md={4} key={s.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      {s.ready ? <CheckCircleIcon color="success" fontSize="small" /> : <WarningIcon color="warning" fontSize="small" />}
                      <Typography fontWeight={700}>{s.label}</Typography>
                      <Chip size="small" label={s.ready ? 'Ready' : 'Not Ready'} color={s.ready ? 'success' : 'warning'} />
                    </Stack>
                    {s.blockers.length > 0 ? (
                      s.blockers.map((b) => (
                        <Typography key={b} variant="caption" display="block" color="error.main">
                          • {b}
                        </Typography>
                      ))
                    ) : (
                      <Typography variant="caption" color="text.secondary">
                        {s.notes[0]}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {sections.map((section) => (
            <Box key={section} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                {section}
              </Typography>
              <Grid container spacing={2}>
                {audit.checks
                  .filter((c) => c.section === section)
                  .map((check) => (
                    <Grid item xs={12} md={6} key={check.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                            {check.valid ? <CheckCircleIcon color="success" fontSize="small" /> : <ErrorIcon color="warning" fontSize="small" />}
                            <Typography variant="subtitle2" fontWeight={700}>
                              {check.label}
                            </Typography>
                            <Chip size="small" label={check.valid ? 'Pass' : 'Fail'} color={check.valid ? 'success' : 'warning'} />
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {check.detail}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
              </Grid>
            </Box>
          ))}

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Voucher Coverage
          </Typography>
          <Table size="small" sx={{ mb: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Posted</TableCell>
                <TableCell align="right">Issues</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {audit.voucherCoverage.byType.map((row) => (
                <TableRow key={row.type}>
                  <TableCell>{row.type.replace('_', ' ')}</TableCell>
                  <TableCell align="right">{row.total}</TableCell>
                  <TableCell align="right">{row.posted}</TableCell>
                  <TableCell align="right">
                    {row.issues > 0 ? <Chip size="small" color="warning" label={row.issues} /> : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Missing Features (before TB / BS release)
          </Typography>
          <Table size="small" sx={{ mb: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell>Severity</TableCell>
                <TableCell>Feature</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Partial</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {audit.missingFeatures.map((f) => (
                <TableRow key={f.id}>
                  <TableCell>
                    <Chip size="small" color={severityColor[f.severity]} label={f.severity} />
                  </TableCell>
                  <TableCell>{f.title}</TableCell>
                  <TableCell>{f.description}</TableCell>
                  <TableCell>{f.existsPartially ? 'Yes' : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Suggested Architecture
          </Typography>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={1}>
                {audit.suggestedArchitecture.map((line) => (
                  <Typography key={line} variant="body2">
                    • {line}
                  </Typography>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </>
      ) : null}
    </Box>
  );
}
