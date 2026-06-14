import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { formatCurrency } from '../../utils/formatters';
import type { AgingBucket } from '../../utils/outstandingAging';
import { dashboardCardSx, sectionEyebrowSx, useDashboardTheme } from './dashboardTheme';

export interface OutstandingAgingCardProps {
  buckets: AgingBucket[];
  total: number;
  /** Tighter layout for dashboard sidebar */
  compact?: boolean;
  onViewReport?: () => void;
  /** Navigate to full report with this bucket pre-filtered */
  onViewBucketReport?: (bucket: AgingBucket) => void;
}

export function OutstandingAgingCard({
  buckets,
  total,
  compact = false,
  onViewReport,
  onViewBucketReport,
}: OutstandingAgingCardProps) {
  const dt = useDashboardTheme();
  const [selected, setSelected] = useState<AgingBucket | null>(null);

  const agingColor = (index: number) => dt.aging[index % dt.aging.length];

  const chartData = useMemo(
    () => buckets.map((b, i) => ({ ...b, fill: agingColor(i) })),
    [buckets, dt.aging]
  );

  const hasData = total > 0;

  return (
    <>
      <Paper elevation={0} sx={{ ...dashboardCardSx(dt), p: compact ? 1.5 : 2, minWidth: 0, overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography sx={{ ...sectionEyebrowSx(dt), fontSize: '0.75rem' }}>Outstanding aging</Typography>
          {onViewReport ? (
            <Button
              size="small"
              onClick={onViewReport}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                fontSize: '0.6875rem',
                minWidth: 0,
                p: 0,
              }}
            >
              Full report →
            </Button>
          ) : null}
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
          Total due amount:{' '}
          <Box
            component="span"
            sx={{
              fontWeight: 800,
              fontSize: '1.0625rem',
              color: 'text.primary',
              fontFeatureSettings: '"tnum"',
            }}
          >
            {formatCurrency(total)}
          </Box>
        </Typography>

        <Stack direction="row" sx={{ height: 12, borderRadius: 2, overflow: 'hidden', mb: 1.75 }}>
          {hasData ? (
            buckets.map((b, i) =>
              b.value > 0 ? (
                <Box
                  key={b.label}
                  title={`${b.label}: ${formatCurrency(b.value)}`}
                  sx={{
                    width: `${(b.value / total) * 100}%`,
                    minWidth: b.value > 0 ? 4 : 0,
                    bgcolor: agingColor(i),
                    cursor: 'pointer',
                    transition: 'opacity 0.2s',
                    '&:hover': { opacity: 0.85 },
                  }}
                  onClick={() => {
                  if (onViewBucketReport) onViewBucketReport(b);
                  else setSelected(b);
                }}
                />
              ) : null
            )
          ) : (
            <Box sx={{ flex: 1, bgcolor: alpha(dt.text.muted, 0.2) }} />
          )}
        </Stack>

        <Box
          sx={{
            width: '100%',
            height: compact ? 110 : 172,
            minHeight: compact ? 110 : 172,
            position: 'relative',
          }}
        >
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={compact ? 32 : 48}
                  outerRadius={compact ? 48 : 72}
                  paddingAngle={3}
                  onClick={(_entry, index) => {
                    const b = buckets[Number(index)];
                    if (b) setSelected(b);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  {chartData.map((d) => (
                    <Cell key={d.label} fill={d.fill} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(v: number | string) => formatCurrency(Number(v || 0))} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
              <Typography variant="caption" color="text.secondary" textAlign="center">
                No outstanding in aging buckets.
                <br />
                Check Party Ledger for balances.
              </Typography>
            </Stack>
          )}
        </Box>

        <Stack spacing={compact ? 0.35 : 0.5} sx={{ mt: 0.5 }}>
          {buckets.map((b, i) => {
            const pct = total > 0 ? Math.round((b.value / total) * 100) : 0;
            return (
              <ButtonBase
                key={b.label}
                onClick={() => {
                  if (onViewBucketReport) onViewBucketReport(b);
                  else setSelected(b);
                }}
                sx={{
                  width: '100%',
                  textAlign: 'left',
                  borderRadius: dt.innerRadius,
                  px: 0.75,
                  py: compact ? 0.45 : 0.75,
                  display: 'block',
                  border: '1px solid',
                  borderColor: selected?.label === b.label ? alpha(dt.primary, 0.35) : 'transparent',
                  bgcolor:
                    selected?.label === b.label
                      ? dt.primarySoft
                      : 'transparent',
                  '&:hover': { bgcolor: dt.primarySoft },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.35 }}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: agingColor(i),
                    }}
                  />
                  <Typography variant="caption" fontWeight={700} sx={{ flex: 1 }}>
                    {b.label}
                  </Typography>
                  <Typography variant="caption" fontWeight={800}>
                    {formatCurrency(b.value)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 28, textAlign: 'right' }}>
                    {pct}%
                  </Typography>
                </Stack>
                {!compact && total > 0 ? (
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: 4,
                      borderRadius: 2,
                      bgcolor: alpha(agingColor(i), 0.15),
                      '& .MuiLinearProgress-bar': {
                        bgcolor: agingColor(i),
                      },
                    }}
                  />
                ) : null}
                {!compact && b.items.length > 0 ? (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.35, display: 'block' }}>
                    {b.items.length} item(s) · tap for details
                  </Typography>
                ) : null}
              </ButtonBase>
            );
          })}
        </Stack>
      </Paper>

      <Dialog
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: dt.cardRadius } }}
      >
        {selected ? (
          <>
            <DialogTitle sx={{ fontWeight: 800, pb: 0.5 }}>{selected.label}</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Outstanding in this age slab:{' '}
                <strong>{formatCurrency(selected.value)}</strong>
              </Typography>
              {selected.items.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No line items in this bucket. Open the full ledger report for party-wise detail.
                </Typography>
              ) : (
                <Stack spacing={1}>
                  {selected.items.map((item) => (
                    <Paper
                      key={item.id}
                      variant="outlined"
                      sx={{ p: 1.25, borderRadius: dt.innerRadius }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box>
                          <Typography variant="body2" fontWeight={700}>
                            {item.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.subtitle}
                          </Typography>
                        </Box>
                        <Typography variant="body2" fontWeight={800}>
                          {formatCurrency(item.amount)}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 2, pb: 2 }}>
              <Button onClick={() => setSelected(null)}>Close</Button>
              {onViewReport ? (
                <Button
                  variant="contained"
                  onClick={() => {
                    setSelected(null);
                    onViewReport();
                  }}
                >
                  View full report
                </Button>
              ) : null}
            </DialogActions>
          </>
        ) : null}
      </Dialog>
    </>
  );
}
