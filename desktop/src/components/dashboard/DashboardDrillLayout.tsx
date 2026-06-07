import { Box, Breadcrumbs, Link, Stack, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useNavigate } from 'react-router-dom';
import { useDashboardTheme } from './dashboardTheme';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

export function DashboardDrillLayout({ title, subtitle, children }: Props) {
  const navigate = useNavigate();
  const dt = useDashboardTheme();

  return (
    <Box sx={{ fontFamily: dt.fontFamily, px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 }, minHeight: '100%', bgcolor: dt.bg }}>
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 1.5 }}>
        <Link
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => navigate('/dashboard')}
          sx={{ fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
        >
          Dashboard
        </Link>
        <Typography color="text.primary" fontWeight={700} fontSize="0.875rem">
          {title}
        </Typography>
      </Breadcrumbs>
      <Stack spacing={0.5} sx={{ mb: 2.5 }}>
        <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      {children}
    </Box>
  );
}
