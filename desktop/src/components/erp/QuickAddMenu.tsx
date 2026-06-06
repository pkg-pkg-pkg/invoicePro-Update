import { useMemo, useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemText, Divider, Typography, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { QUICK_ADD_ACTIONS } from '../../config/erpModuleNav';
import { erpNavigateTo } from './DesktopErpChrome';

type Props = {
  canAccessFeature: (feature: string) => boolean;
};

export function QuickAddMenu({ canAccessFeature }: Props) {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);

  const actions = useMemo(
    () => QUICK_ADD_ACTIONS.filter((a) => !a.perm || canAccessFeature(a.perm)),
    [canAccessFeature]
  );

  return (
    <>
      <IconButton
        aria-label="Quick add"
        title="Quick add"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1,
          bgcolor: 'primary.main',
          color: '#fff',
          '&:hover': { bgcolor: 'primary.dark' },
        }}
      >
        <AddIcon />
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 260, mt: 0.75 } } }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>
            Quick Add
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Same vouchers & masters — faster access
          </Typography>
        </Box>
        <Divider />
        {actions.map((action) => (
          <MenuItem
            key={action.id}
            onClick={() => {
              erpNavigateTo(navigate, action.path);
              setAnchor(null);
            }}
          >
            <ListItemText
              primary={action.label}
              secondary={action.hint}
              primaryTypographyProps={{ fontWeight: 600, fontSize: '0.875rem' }}
              secondaryTypographyProps={{ fontSize: '0.75rem' }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
