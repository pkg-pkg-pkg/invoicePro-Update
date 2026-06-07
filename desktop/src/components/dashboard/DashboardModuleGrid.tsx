import { Box, Grid, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import { alpha, useTheme } from '@mui/material/styles';
import { useDashboardTheme } from './dashboardTheme';

const MODULES = [
  {
    id: 'items',
    label: 'Items',
    hint: 'Products, price lists, stock',
    path: '/items',
    icon: Inventory2OutlinedIcon,
    color: '#2563EB',
  },
  {
    id: 'sales',
    label: 'Sales',
    hint: 'Invoices & customers',
    path: '/sales',
    icon: PointOfSaleOutlinedIcon,
    color: '#16A34A',
  },
  {
    id: 'purchase',
    label: 'Purchase',
    hint: 'Bills & suppliers',
    path: '/purchase',
    icon: ShoppingCartOutlinedIcon,
    color: '#D97706',
  },
  {
    id: 'banking',
    label: 'Banking',
    hint: 'Banks, receipts, payments',
    path: '/banking',
    icon: AccountBalanceOutlinedIcon,
    color: '#0EA5E9',
  },
  {
    id: 'parties',
    label: 'Parties',
    hint: 'Customers & suppliers',
    path: '/parties',
    icon: PeopleOutlineIcon,
    color: '#7C3AED',
  },
  {
    id: 'reports',
    label: 'Reports',
    hint: 'P&L, stock, GST',
    path: '/reports',
    icon: AssessmentOutlinedIcon,
    color: '#64748B',
  },
] as const;

export function DashboardModuleGrid() {
  const navigate = useNavigate();
  const theme = useTheme();
  const dt = useDashboardTheme();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box sx={{ mb: dt.gridGap }}>
      <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.25 }}>
        Business modules
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Same auto-accounting — clean modern menus. Pick a module to start.
      </Typography>
      <Grid container spacing={1.5}>
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <Grid item xs={6} sm={4} md={2} key={mod.id}>
              <Box
                component="button"
                type="button"
                onClick={() => navigate(mod.path)}
                sx={{
                  width: '100%',
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: dt.innerRadius,
                  bgcolor: isDark ? alpha('#263445', 0.6) : '#FFFFFF',
                  p: 1.5,
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: theme.transitions.create(['border-color', 'transform'], { duration: 200 }),
                  '&:hover': {
                    borderColor: mod.color,
                    transform: 'translateY(-1px)',
                  },
                }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: alpha(mod.color, isDark ? 0.2 : 0.1),
                    color: mod.color,
                    mb: 1,
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
                <Typography variant="body2" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  {mod.label}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                  {mod.hint}
                </Typography>
              </Box>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}
