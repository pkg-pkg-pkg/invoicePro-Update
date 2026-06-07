import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

/** Items module content shell — sub-navigation lives in the main left sidebar. */
export function ItemsModuleShell() {
  return (
    <Box sx={{ minHeight: '100%', minWidth: 0 }}>
      <Outlet />
    </Box>
  );
}
