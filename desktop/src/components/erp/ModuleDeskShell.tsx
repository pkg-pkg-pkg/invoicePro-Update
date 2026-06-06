import { type ReactNode } from 'react';
import {
  Box,
  Grid,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  TextField,
  Typography,
  InputAdornment,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useTheme, alpha } from '@mui/material/styles';

export type ModuleDeskCategory = {
  id: string;
  label: string;
  icon?: ReactNode;
};

export type ModuleDeskLink = {
  id: string;
  label: string;
  description?: string;
  path: string;
  categoryId: string;
  badge?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  categories: ModuleDeskCategory[];
  links: ModuleDeskLink[];
  selectedCategoryId: string;
  onCategoryChange: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
  onNavigate: (path: string) => void;
};

export function ModuleDeskShell({
  title,
  subtitle,
  categories,
  links,
  selectedCategoryId,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search…',
  onNavigate,
}: Props) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const filtered = links.filter((link) => {
    if (link.categoryId !== selectedCategoryId && selectedCategoryId !== 'all') return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return `${link.label} ${link.description ?? ''}`.toLowerCase().includes(q);
  });

  const groupedLabel =
    categories.find((c) => c.id === selectedCategoryId)?.label ??
    categories.find((c) => c.id === 'all')?.label ??
    title;

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          py: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 2,
          justifyContent: 'space-between',
        }}
      >
        <Box>
          <Typography variant="h5" fontWeight={800}>
            {title}
          </Typography>
          {subtitle ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          ) : null}
        </Box>
        <TextField
          size="small"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: { xs: '100%', sm: 280 } }}
        />
      </Box>

      <Grid container>
        <Grid
          item
          xs={12}
          md={3}
          sx={{
            borderRight: { md: `1px solid ${theme.palette.divider}` },
            borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: 'none' },
            bgcolor: isDark ? alpha(theme.palette.background.default, 0.4) : '#F8FAFC',
          }}
        >
          <List dense disablePadding sx={{ py: 1 }}>
            {categories.map((cat) => {
              const selected = cat.id === selectedCategoryId;
              return (
                <ListItemButton
                  key={cat.id}
                  selected={selected}
                  onClick={() => onCategoryChange(cat.id)}
                  sx={{
                    py: 1.1,
                    px: 2,
                    borderLeft: selected ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                    '&.Mui-selected': {
                      bgcolor: isDark ? alpha(theme.palette.primary.main, 0.12) : alpha(theme.palette.primary.main, 0.08),
                    },
                  }}
                >
                  {cat.icon ? <ListItemIcon sx={{ minWidth: 36 }}>{cat.icon}</ListItemIcon> : null}
                  <ListItemText
                    primary={cat.label}
                    primaryTypographyProps={{ fontWeight: selected ? 700 : 500, fontSize: '0.875rem' }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Grid>

        <Grid item xs={12} md={9}>
          <Box sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>
              {groupedLabel}{' '}
              <Typography component="span" variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                {filtered.length}
              </Typography>
            </Typography>

            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
              <Box component="thead">
                <Box component="tr">
                  {['Name', 'Description'].map((h) => (
                    <Box
                      component="th"
                      key={h}
                      sx={{
                        textAlign: 'left',
                        py: 1,
                        px: 1,
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        letterSpacing: '0.06em',
                        color: 'text.secondary',
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        width: h === 'Name' ? '40%' : undefined,
                      }}
                    >
                      {h.toUpperCase()}
                    </Box>
                  ))}
                </Box>
              </Box>
              <Box component="tbody">
                {filtered.map((link) => (
                  <Box
                    component="tr"
                    key={link.id}
                    onClick={() => onNavigate(link.path)}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { bgcolor: isDark ? alpha('#fff', 0.03) : alpha('#0F172A', 0.03) },
                    }}
                  >
                    <Box
                      component="td"
                      sx={{
                        py: 1.25,
                        px: 1,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        color: 'primary.main',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                      }}
                    >
                      {link.label}
                      {link.badge ? (
                        <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                          {link.badge}
                        </Typography>
                      ) : null}
                    </Box>
                    <Box
                      component="td"
                      sx={{
                        py: 1.25,
                        px: 1,
                        borderBottom: `1px solid ${theme.palette.divider}`,
                        color: 'text.secondary',
                        fontSize: '0.8125rem',
                      }}
                    >
                      {link.description ?? '—'}
                    </Box>
                  </Box>
                ))}
                {filtered.length === 0 ? (
                  <Box component="tr">
                    <Box component="td" colSpan={2} sx={{ py: 4, textAlign: 'center', color: 'text.secondary' }}>
                      No items match your search.
                    </Box>
                  </Box>
                ) : null}
              </Box>
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
