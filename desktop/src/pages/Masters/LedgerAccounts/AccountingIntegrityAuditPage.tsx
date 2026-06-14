import { Fragment, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

import {
  accountingIntegrityAuditService,
  type AccountingIntegrityAudit,
} from '../../../services/audit/accountingIntegrityAuditService';

function exportCsv(audit: AccountingIntegrityAudit) {
  const summaryHeader = ['Voucher Type', 'Posting Logic', 'Valid', 'Total', 'Valid Count', 'Invalid Count', 'Issues Found'];
  const summaryLines = audit.typeSummaries.map((s) =>
    [
      s.label,
      s.postingLogic.replace(/\n/g, ' | '),
      s.valid ? 'Yes' : 'No',
      s.totalVouchers,
      s.validCount,
      s.invalidCount,
      s.issuesFound.join('; '),
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(',')
  );

  const detailHeader = ['Voucher Number', 'Date', 'Type', 'Valid', 'Total Dr', 'Total Cr', 'Posting', 'Issues'];
  const detailLines = audit.voucherRows.map((r) =>
    [
      r.voucherNumber,
      r.date,
      r.voucherType,
      r.valid ? 'Yes' : 'No',
      r.totalDebit,
      r.totalCredit,
      r.postingSummary.replace(/\n/g, ' | '),
      r.issues.join('; '),
    ]
      .map((c) => `"${String(c).replace(/"/g, '""')}"`)
      .join(',')
  );

  const blob = new Blob(
    [
      [
        '=== Voucher Type Summary ===',
        summaryHeader.join(','),
        ...summaryLines,
        '',
        '=== Voucher Detail ===',
        detailHeader.join(','),
        ...detailLines,
      ].join('\n'),
    ],
    { type: 'text/csv' }
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `accounting-integrity-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AccountingIntegrityAuditPage() {
  const navigate = useNavigate();
  const [audit, setAudit] = useState<AccountingIntegrityAudit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInvalidOnly, setShowInvalidOnly] = useState(false);
  const [expandedType, setExpandedType] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAudit(await accountingIntegrityAuditService.runAudit());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const voucherRows =
    audit?.voucherRows.filter((r) => !showInvalidOnly || !r.valid) ?? [];

  return (
    <Box sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={800}>
          Accounting Integrity Audit
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="outlined" onClick={() => navigate('/masters/financial-readiness')}>
            Statement Readiness
          </Button>
          <Button variant="outlined" onClick={() => navigate('/masters/ledger-audit')}>
            Ledger Structure Audit
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
        </Stack>
      </Stack>

      <Alert severity="info" sx={{ mb: 2 }}>
        Verifies every voucher posts balanced Dr/Cr entries to valid ledger groups. Compares voucher lines with stored
        ledger transactions. Validates Trial Balance, P&L, and Balance Sheet can be derived from postings.
      </Alert>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      {loading ? (
        <Stack alignItems="center" py={6}>
          <CircularProgress />
        </Stack>
      ) : audit ? (
        <>
          <Alert
            severity={audit.overallValid ? 'success' : 'warning'}
            icon={audit.overallValid ? <CheckCircleIcon /> : <ErrorIcon />}
            sx={{ mb: 2 }}
          >
            {audit.overallValid
              ? 'All voucher types pass integrity checks.'
              : 'One or more voucher types or financial derivations have issues — review below.'}
            {' '}
            Generated {new Date(audit.generatedAt).toLocaleString('en-IN')}.
          </Alert>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Financial Derivation Checks
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {audit.financialChecks.map((check) => (
              <Grid item xs={12} md={6} key={check.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      {check.valid ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <ErrorIcon color="warning" fontSize="small" />
                      )}
                      <Typography variant="subtitle2" fontWeight={700}>
                        {check.label}
                      </Typography>
                      <Chip size="small" label={check.valid ? 'Valid' : 'Issue'} color={check.valid ? 'success' : 'warning'} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {check.detail}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Bill-Wise Settlement Audit
          </Typography>
          <Alert severity={audit.settlementAudit.valid ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {audit.settlementAudit.valid
              ? `${audit.settlementAudit.totalReferences} reference(s) — all settlement rules pass.`
              : `${audit.settlementAudit.invalidReferences} invalid reference(s), ${audit.settlementAudit.orphanReferences} orphan(s).`}
          </Alert>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {audit.settlementAudit.checks.map((check) => (
              <Grid item xs={12} md={6} key={check.id}>
                <Card variant="outlined">
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      {check.valid ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <ErrorIcon color="warning" fontSize="small" />
                      )}
                      <Typography variant="subtitle2" fontWeight={700}>
                        {check.label}
                      </Typography>
                      <Chip size="small" label={check.valid ? 'Valid' : 'Issue'} color={check.valid ? 'success' : 'warning'} />
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      {check.detail}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Voucher Type Report
          </Typography>
          <Table size="small" sx={{ mb: 3 }}>
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Voucher Type</TableCell>
                <TableCell>Posting Logic</TableCell>
                <TableCell>Valid</TableCell>
                <TableCell>Issues Found</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {audit.typeSummaries.map((s) => {
                const isExpanded = expandedType === s.voucherType;
                const typeRows = voucherRows.filter((r) => r.voucherType === s.voucherType);
                return (
                  <Fragment key={s.voucherType}>
                    <TableRow
                      sx={!s.valid && s.totalVouchers > 0 ? { bgcolor: 'warning.50' } : undefined}
                    >
                      <TableCell>
                        {s.totalVouchers > 0 ? (
                          <IconButton
                            size="small"
                            onClick={() => setExpandedType(isExpanded ? null : s.voucherType)}
                            aria-label={isExpanded ? 'Collapse' : 'Expand'}
                          >
                            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={600}>{s.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {s.validCount}/{s.totalVouchers} valid
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontFamily: 'inherit' }}>
                          {s.postingLogic}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {s.totalVouchers === 0 ? (
                          <Chip size="small" label="No vouchers" variant="outlined" />
                        ) : s.valid ? (
                          <Chip size="small" color="success" label="Yes" />
                        ) : (
                          <Chip size="small" color="warning" label={`No (${s.invalidCount})`} />
                        )}
                      </TableCell>
                      <TableCell>
                        {s.issuesFound.length === 0 ? (
                          '—'
                        ) : (
                          <Stack spacing={0.5}>
                            {s.issuesFound.map((issue) => (
                              <Typography key={issue} variant="caption" display="block">
                                • {issue}
                              </Typography>
                            ))}
                            {s.invalidCount > s.issuesFound.length ? (
                              <Typography variant="caption" color="text.secondary">
                                + more across vouchers
                              </Typography>
                            ) : null}
                          </Stack>
                        )}
                      </TableCell>
                    </TableRow>
                    {s.totalVouchers > 0 ? (
                      <TableRow key={`${s.voucherType}-detail`}>
                        <TableCell colSpan={5} sx={{ py: 0, borderBottom: isExpanded ? undefined : 0 }}>
                          <Collapse in={isExpanded}>
                            <Box sx={{ py: 2, pl: 2 }}>
                              <Table size="small">
                                <TableHead>
                                  <TableRow>
                                    <TableCell>Voucher #</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell>Posting</TableCell>
                                    <TableCell align="right">Dr</TableCell>
                                    <TableCell align="right">Cr</TableCell>
                                    <TableCell>Valid</TableCell>
                                    <TableCell>Issues</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {typeRows.map((r) => (
                                    <TableRow key={r.voucherId} sx={!r.valid ? { bgcolor: 'error.50' } : undefined}>
                                      <TableCell>{r.voucherNumber}</TableCell>
                                      <TableCell>{r.date}</TableCell>
                                      <TableCell>
                                        <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', m: 0, fontFamily: 'inherit' }}>
                                          {r.postingSummary || '—'}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="right">₹{r.totalDebit.toLocaleString('en-IN')}</TableCell>
                                      <TableCell align="right">₹{r.totalCredit.toLocaleString('en-IN')}</TableCell>
                                      <TableCell>
                                        {r.valid ? (
                                          <Chip size="small" color="success" label="Yes" />
                                        ) : (
                                          <Chip size="small" color="error" label="No" />
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        {r.issues.length === 0 ? (
                                          '—'
                                        ) : (
                                          r.issues.map((i) => (
                                            <Typography key={i} variant="caption" display="block">
                                              • {i}
                                            </Typography>
                                          ))
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant={showInvalidOnly ? 'contained' : 'outlined'}
              onClick={() => setShowInvalidOnly((v) => !v)}
            >
              {showInvalidOnly ? 'Show all vouchers' : 'Invalid vouchers only'}
            </Button>
          </Stack>
        </>
      ) : null}
    </Box>
  );
}
