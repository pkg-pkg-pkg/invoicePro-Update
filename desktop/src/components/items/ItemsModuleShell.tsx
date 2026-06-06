import { Box, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PriceChangeOutlinedIcon from '@mui/icons-material/PriceChangeOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import { getItemsModuleTokens } from '../../theme/itemsModuleTheme';

const SUB_NAV = [
  { id: 'list', label: 'Items', path: '/items', icon: Inventory2OutlinedIcon },
  { id: 'price-lists', label: 'Price Lists', path: '/items/price-lists', icon: PriceChangeOutlinedIcon },
  { id: 'adjustments', label: 'Inventory Adjustments', path: '/items/adjustments', icon: TuneOutlinedIcon },
  { id: 'godowns', label: 'Godown Master', path: '/masters/godowns', icon: WarehouseOutlinedIcon },
] as const;

export function ItemsModuleShell() {
  const theme = useTheme();
  const tok = getItemsModuleTokens(theme);
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/items') return location.pathname === '/items' || location.pathname === '/items/';
    return location.pathname.startsWith(path);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 2, minHeight: '100%' }}>
      <Box
        component="nav"
        sx={{
          width: { xs: '100%', md: 200 },
          flexShrink: 0,
          bgcolor: tok.surface,
          border: `1px solid ${tok.border}`,
          borderRadius: `${tok.radius}px`,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ px: 2, py: 1.5, bgcolor: tok.navyMid }}>
          <Typography variant="caption" sx={{ color: tok.gold, fontWeight: 800, letterSpacing: '0.1em' }}>
            INVENTORY
          </Typography>
          <Typography variant="subtitle2" sx={{ color: '#F8FAFC', fontWeight: 800 }}>
            Items Desk
          </Typography>
        </Box>
        {SUB_NAV.map(({ label, path, icon: Icon }) => {
          const active = isActive(path);
          return (
            <Box
              key={path}
              component="button"
              type="button"
              onClick={() => navigate(path)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.25,
                width: '100%',
                border: 'none',
                cursor: 'pointer',
                px: 2,
                py: 1.25,
                textAlign: 'left',
                bgcolor: active ? tok.listActive : 'transparent',
                borderLeft: active ? `3px solid ${tok.listActiveBorder}` : '3px solid transparent',
                color: tok.text,
                '&:hover': { bgcolor: active ? tok.listActive : tok.surfaceMuted },
              }}
            >
              <Icon sx={{ fontSize: 20, color: active ? tok.accent : tok.textMuted }} />
              <Typography variant="body2" fontWeight={active ? 700 : 500}>
                {label}
              </Typography>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
