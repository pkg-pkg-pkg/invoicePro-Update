import { Box } from '@mui/material';
import DayReport from './Reports/DayReport';
import { PREMIUM_ERP } from '../theme/premiumErpTheme';

export default function DayBookPage() {
  return (
    <Box
      sx={{
        fontFamily: PREMIUM_ERP.fontFamily,
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
        minHeight: '100%',
        bgcolor: PREMIUM_ERP.bg,
      }}
    >
      <DayReport />
    </Box>
  );
}
