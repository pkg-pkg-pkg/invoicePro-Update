import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { PREMIUM_ERP } from '../../theme/premiumErpTheme';

export type ReportCardDef = {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  accent?: string;
};

export type ReportKpi = {
  label: string;
  value: string;
  accent?: string;
};

const FAV_KEY = 'pve_report_favorites_v1';
const RECENT_KEY = 'pve_report_recent_v1';

function readJsonArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, values: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(values.slice(0, 12)));
  } catch {
    // ignore
  }
}

export function pushRecentReport(reportId: string) {
  const prev = readJsonArray(RECENT_KEY).filter((id) => id !== reportId);
  writeJsonArray(RECENT_KEY, [reportId, ...prev]);
}

type Props = {
  categoryLabel: string;
  categoryAccent?: string;
  reports: ReportCardDef[];
  kpis?: ReportKpi[];
  canExport?: boolean;
  onSelect: (reportId: string) => void;
  onExport?: (format: 'pdf' | 'excel' | 'print') => void;
};

export function ReportHubShell({
  categoryLabel,
  categoryAccent = PREMIUM_ERP.blue,
  reports,
  kpis = [],
  canExport,
  onSelect,
  onExport,
}: Props) {
  const [favorites, setFavorites] = useState<string[]>(() => readJsonArray(FAV_KEY));
  const [recent, setRecent] = useState<string[]>(() => readJsonArray(RECENT_KEY));
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customerQ, setCustomerQ] = useState('');

  useEffect(() => {
    setRecent(readJsonArray(RECENT_KEY));
  }, [categoryLabel]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      writeJsonArray(FAV_KEY, next);
      return next;
    });
  }, []);

  const handleSelect = (id: string) => {
    pushRecentReport(id);
    setRecent(readJsonArray(RECENT_KEY));
    onSelect(id);
  };

  const favoriteReports = useMemo(
    () => reports.filter((r) => favorites.includes(r.id)),
    [reports, favorites]
  );
  const recentReports = useMemo(
    () =>
      recent
        .map((id) => reports.find((r) => r.id === id))
        .filter(Boolean) as ReportCardDef[],
    [recent, reports]
  );

  return (
    <Box sx={{ fontFamily: PREMIUM_ERP.fontFamily }}>
      {kpis.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {kpis.map((kpi) => (
            <Grid item xs={12} sm={6} md={3} key={kpi.label}>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: `${PREMIUM_ERP.radius.md}px`,
                  border: `1px solid ${PREMIUM_ERP.border}`,
                  boxShadow: PREMIUM_ERP.shadow,
                  background: `linear-gradient(145deg, ${alpha(kpi.accent || categoryAccent, 0.06)} 0%, #fff 70%)`,
                }}
              >
                <Typography variant="caption" color="text.secondary" fontWeight={600}>
                  {kpi.label}
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ mt: 0.5, color: PREMIUM_ERP.navy }}>
                  {kpi.value}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: `${PREMIUM_ERP.radius.lg}px`,
          border: `1px solid ${PREMIUM_ERP.border}`,
          boxShadow: PREMIUM_ERP.shadow,
          backdropFilter: 'blur(8px)',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <FilterAltOutlinedIcon sx={{ fontSize: 18, color: PREMIUM_ERP.blue }} />
          <Typography variant="subtitle2" fontWeight={700}>
            Quick filters
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField
            size="small"
            label="From date"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label="To date"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            label="Customer / Product"
            placeholder="Search…"
            value={customerQ}
            onChange={(e) => setCustomerQ(e.target.value)}
            sx={{ flex: 1, minWidth: 180 }}
          />
          {canExport && onExport ? (
            <Stack direction="row" spacing={0.75} flexShrink={0}>
              <Tooltip title="Export PDF">
                <IconButton size="small" onClick={() => onExport('pdf')}>
                  <PictureAsPdfOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Export Excel">
                <IconButton size="small" onClick={() => onExport('excel')}>
                  <TableChartOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Print">
                <IconButton size="small" onClick={() => onExport('print')}>
                  <PrintOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      {favoriteReports.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <StarIcon sx={{ fontSize: 18, color: '#CA8A04' }} />
            <Typography variant="subtitle2" fontWeight={700}>
              Favorites
            </Typography>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {favoriteReports.map((r) => (
              <Chip
                key={r.id}
                label={r.title}
                onClick={() => handleSelect(r.id)}
                sx={{ fontWeight: 600 }}
              />
            ))}
          </Stack>
        </Box>
      )}

      {recentReports.length > 0 && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <HistoryOutlinedIcon sx={{ fontSize: 18, color: PREMIUM_ERP.text.secondary }} />
            <Typography variant="subtitle2" fontWeight={700}>
              Recent reports
            </Typography>
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {recentReports.slice(0, 6).map((r) => (
              <Chip
                key={r.id}
                variant="outlined"
                label={r.title}
                onClick={() => handleSelect(r.id)}
              />
            ))}
          </Stack>
        </Box>
      )}

      <Typography variant="h6" fontWeight={800} sx={{ mb: 2, color: PREMIUM_ERP.navy }}>
        {categoryLabel}
      </Typography>

      <Grid container spacing={2}>
        {reports.map((report) => {
          const accent = report.accent || categoryAccent;
          const isFav = favorites.includes(report.id);
          return (
            <Grid item xs={12} sm={6} md={4} lg={3} key={report.id}>
              <Paper
                elevation={0}
                onClick={() => handleSelect(report.id)}
                sx={{
                  p: 2,
                  height: '100%',
                  cursor: 'pointer',
                  borderRadius: `${PREMIUM_ERP.radius.lg}px`,
                  border: `1px solid ${PREMIUM_ERP.border}`,
                  boxShadow: PREMIUM_ERP.shadow,
                  transition: PREMIUM_ERP.transition,
                  position: 'relative',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: PREMIUM_ERP.shadowHover,
                    borderColor: PREMIUM_ERP.borderHover,
                  },
                }}
              >
                <IconButton
                  size="small"
                  aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavorite(report.id);
                  }}
                  sx={{ position: 'absolute', top: 8, right: 8 }}
                >
                  {isFav ? (
                    <StarIcon sx={{ fontSize: 18, color: '#CA8A04' }} />
                  ) : (
                    <StarBorderIcon sx={{ fontSize: 18, color: PREMIUM_ERP.text.muted }} />
                  )}
                </IconButton>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: `${PREMIUM_ERP.radius.sm}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(accent, 0.12),
                    color: accent,
                    mb: 1.5,
                  }}
                >
                  {report.icon}
                </Box>
                <Typography variant="subtitle1" fontWeight={800} sx={{ color: PREMIUM_ERP.navy, pr: 3 }}>
                  {report.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.5 }}>
                  {report.description}
                </Typography>
              </Paper>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
