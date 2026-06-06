import { Box, Chip, Divider, Paper, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import {
  financialYearLabel,
  glassDateCardSx,
  useDashboardTheme,
  welcomeCardSx,
} from './dashboardTheme';

export interface DashboardWelcomeProps {
  greeting: string;
  userName: string;
  now: Date;
}

export function DashboardWelcome({ greeting, userName, now }: DashboardWelcomeProps) {
  const dt = useDashboardTheme();
  const dateStr = now.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const fy = financialYearLabel(now);

  return (
    <Paper elevation={0} sx={welcomeCardSx(dt)}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        gap={2}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: dt.fontFamily,
              fontSize: { xs: '1.375rem', sm: '1.625rem' },
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.2,
              color: dt.text.primary,
            }}
          >
            {greeting},{' '}
            <Box component="span" sx={{ color: dt.primary }}>
              {userName}
            </Box>{' '}
            👋
          </Typography>
          <Typography
            sx={{
              mt: 0.75,
              fontSize: '0.9375rem',
              fontWeight: 500,
              color: dt.text.secondary,
              fontFamily: dt.fontFamily,
              maxWidth: 520,
              lineHeight: 1.55,
            }}
          >
            Here&apos;s what&apos;s happening in your business today.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ ...glassDateCardSx(dt), flexShrink: 0 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'center' }}
            divider={
              <Divider
                orientation="vertical"
                flexItem
                sx={{
                  borderColor: dt.border,
                  my: 0.25,
                  display: { xs: 'none', sm: 'block' },
                }}
              />
            }
            spacing={1.5}
          >
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <CalendarMonthOutlinedIcon sx={{ fontSize: 18, color: dt.primary }} />
              <Typography
                fontWeight={700}
                sx={{
                  whiteSpace: 'nowrap',
                  fontSize: '0.8125rem',
                  color: dt.text.primary,
                  fontFamily: dt.fontFamily,
                }}
              >
                {dateStr}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              <ScheduleOutlinedIcon sx={{ fontSize: 18, color: dt.text.secondary }} />
              <Typography
                fontWeight={600}
                sx={{
                  whiteSpace: 'nowrap',
                  fontSize: '0.8125rem',
                  color: dt.text.secondary,
                  fontFamily: dt.fontFamily,
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
                fontFamily: dt.fontFamily,
                bgcolor: alpha(dt.accent, 0.12),
                color: dt.accent,
                border: `1px solid ${alpha(dt.accent, 0.28)}`,
                '& .MuiChip-label': { px: 1.1 },
              }}
            />
          </Stack>
        </Paper>
      </Stack>
    </Paper>
  );
}
