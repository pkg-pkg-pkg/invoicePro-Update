import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import {
  DASHBOARD_THEME,
  financialYearLabel,
  glassDateCardSx,
} from './dashboardTheme';

export interface DashboardWelcomeProps {
  greeting: string;
  userName: string;
  now: Date;
}

export function DashboardWelcome({ greeting, userName, now }: DashboardWelcomeProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const fy = financialYearLabel(now);

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      justifyContent="space-between"
      alignItems={{ xs: 'flex-start', sm: 'center' }}
      gap={2}
      sx={{ mb: 3 }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography
          sx={{
            fontFamily: DASHBOARD_THEME.fontFamily,
            fontSize: { xs: '1.5rem', sm: '1.75rem' },
            fontWeight: 800,
            letterSpacing: '-0.035em',
            lineHeight: 1.15,
            color: isDark ? '#F8FAFC' : DASHBOARD_THEME.text.primary,
          }}
        >
          {greeting}, {userName} 👋
        </Typography>
        <Typography
          sx={{
            mt: 0.75,
            fontSize: '0.9375rem',
            fontWeight: 500,
            color: DASHBOARD_THEME.text.secondary,
            fontFamily: DASHBOARD_THEME.fontFamily,
            maxWidth: 480,
            lineHeight: 1.5,
          }}
        >
          Here&apos;s what&apos;s happening in your business today.
        </Typography>
      </Box>

      <Paper elevation={0} sx={{ ...glassDateCardSx(isDark), px: 2, py: 1.25 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          divider={
            <Divider
              orientation="vertical"
              flexItem
              sx={{
                borderColor: alpha(DASHBOARD_THEME.primary, 0.15),
                my: 0.25,
                display: { xs: 'none', sm: 'block' },
              }}
            />
          }
          spacing={1.5}
        >
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <CalendarMonthOutlinedIcon sx={{ fontSize: 18, color: DASHBOARD_THEME.primary }} />
            <Typography
              fontWeight={700}
              sx={{
                whiteSpace: 'nowrap',
                fontSize: '0.8125rem',
                color: DASHBOARD_THEME.text.primary,
                fontFamily: DASHBOARD_THEME.fontFamily,
              }}
            >
              {dateStr}
            </Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <ScheduleOutlinedIcon sx={{ fontSize: 18, color: DASHBOARD_THEME.text.secondary }} />
            <Typography
              fontWeight={600}
              sx={{
                whiteSpace: 'nowrap',
                fontSize: '0.8125rem',
                color: DASHBOARD_THEME.text.secondary,
                fontFamily: DASHBOARD_THEME.fontFamily,
              }}
            >
              {timeStr}
            </Typography>
          </Stack>
          <Chip
            label={`FY ${fy}`}
            size="small"
            sx={{
              height: 26,
              fontSize: '0.6875rem',
              fontWeight: 700,
              fontFamily: DASHBOARD_THEME.fontFamily,
              bgcolor: alpha(DASHBOARD_THEME.primary, 0.1),
              color: DASHBOARD_THEME.primary,
              border: `1px solid ${alpha(DASHBOARD_THEME.primary, 0.2)}`,
              '& .MuiChip-label': { px: 1.1 },
            }}
          />
        </Stack>
      </Paper>
    </Stack>
  );
}
