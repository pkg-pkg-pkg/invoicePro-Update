import { Box, Tab, Tabs } from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { WrapTabScrollButton } from '../mui/WrapTabScrollButton';

export type ErpModuleTab = {
  id: string;
  label: string;
};

type Props = {
  tabs: ErpModuleTab[];
  value: string;
  onChange: (id: string) => void;
};

export function ErpModuleTabs({ tabs, value, onChange }: Props) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        mb: 2,
        mx: { xs: -1, sm: 0 },
        borderBottom: `1px solid ${theme.palette.divider}`,
        bgcolor: 'background.paper',
      }}
    >
      <Tabs
        value={value}
        onChange={(_, next) => onChange(next)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        ScrollButtonComponent={WrapTabScrollButton}
        sx={{
          minHeight: 44,
          '& .MuiTabs-indicator': {
            height: 3,
            bgcolor: theme.palette.primary.main,
          },
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.875rem',
            minHeight: 44,
            px: 2,
            color: theme.palette.text.secondary,
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              color: theme.palette.text.primary,
            },
            '&.Mui-selected': {
              color: theme.palette.primary.main,
              fontWeight: 700,
            },
          },
        }}
      >
        {tabs.map((tab) => (
          <Tab key={tab.id} label={tab.label} value={tab.id} />
        ))}
      </Tabs>
    </Box>
  );
}
