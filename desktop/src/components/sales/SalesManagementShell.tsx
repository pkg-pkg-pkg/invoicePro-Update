import { Box } from '@mui/material';
import { Outlet } from 'react-router-dom';

export function SalesManagementShell() {
  return (
    <Box sx={{ minHeight: '100%', width: '100%' }}>
      <Outlet />
    </Box>
  );
}
