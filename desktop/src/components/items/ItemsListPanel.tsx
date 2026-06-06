import { useRef, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { InventoryItem, ItemCategory, Godown } from '../../types/masters';
import { formatCurrency } from '../../utils/formatters';
import { getItemsModuleTokens } from '../../theme/itemsModuleTheme';
import { useTheme } from '@mui/material/styles';

type FilterKey = 'ALL' | 'ACTIVE' | 'INACTIVE' | string;

type Props = {
  items: InventoryItem[];
  categories: ItemCategory[];
  godowns: Godown[];
  unitLabel: (unitId: string) => string;
  categoryLabel: (categoryId: string | null | undefined) => string;
  godownLabel: (item: InventoryItem) => string;
  selectedId: string | null;
  selectedIds: Set<string>;
  filter: FilterKey;
  search: string;
  onFilterChange: (f: FilterKey) => void;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onNew: () => void;
  onBulkDelete?: () => void;
  onExport?: () => void;
  onExportCsv?: () => void;
  onImport?: () => void;
};

export function ItemsListPanel({
  items,
  categories,
  godowns: _godowns,
  unitLabel,
  categoryLabel,
  godownLabel,
  selectedId,
  selectedIds,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onSelect,
  onToggleSelect,
  onToggleAll,
  onNew,
  onBulkDelete,
  onExport,
  onExportCsv,
  onImport,
}: Props) {
  const theme = useTheme();
  const tok = getItemsModuleTokens(theme);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <Box
      sx={{
        width: { xs: '100%', lg: '32%' },
        minWidth: { lg: 280 },
        maxWidth: { lg: 420 },
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${tok.border}`,
        borderRadius: `${tok.radius}px`,
        bgcolor: tok.surface,
        overflow: 'hidden',
        height: { lg: 'calc(100vh - 220px)' },
        minHeight: 400,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1.25, borderBottom: `1px solid ${tok.border}` }}>
        <FormControl size="small" sx={{ flex: 1, minWidth: 0 }}>
          <InputLabel>Filter</InputLabel>
          <Select label="Filter" value={filter} onChange={(e) => onFilterChange(e.target.value as FilterKey)}>
            <MenuItem value="ALL">All Items</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
            {categories.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onNew} sx={{ flexShrink: 0, fontWeight: 700 }}>
          New
        </Button>
        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
          <MoreVertIcon />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          {onImport ? (
            <MenuItem onClick={() => { onImport(); setMenuAnchor(null); }}>
              <UploadFileIcon fontSize="small" sx={{ mr: 1 }} /> Import Items
            </MenuItem>
          ) : null}
          {onExport ? (
            <MenuItem onClick={() => { onExport(); setMenuAnchor(null); }}>
              <FileDownloadIcon fontSize="small" sx={{ mr: 1 }} /> Export Excel
            </MenuItem>
          ) : null}
          {onExportCsv ? (
            <MenuItem onClick={() => { onExportCsv(); setMenuAnchor(null); }}>
              <FileDownloadIcon fontSize="small" sx={{ mr: 1 }} /> Export CSV
            </MenuItem>
          ) : null}
          {onBulkDelete ? (
            <MenuItem onClick={() => { onBulkDelete(); setMenuAnchor(null); }}>
              <DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Delete selected
            </MenuItem>
          ) : null}
        </Menu>
      </Stack>

      <Box sx={{ px: 1.5, py: 1, borderBottom: `1px solid ${tok.border}` }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Search items…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <List dense disablePadding sx={{ flex: 1, overflowY: 'auto' }}>
        {items.length > 0 ? (
          <ListItemButton sx={{ py: 0.5, borderBottom: `1px solid ${tok.border}` }} onClick={onToggleAll}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Checkbox edge="start" size="small" checked={allSelected} indeterminate={selectedIds.size > 0 && !allSelected} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'caption', fontWeight: 700 }} primary="Select all" />
          </ListItemButton>
        ) : null}
        {items.map((item) => {
          const active = selectedId === item.id;
          const price = item.pricing?.sale ?? item.pricing?.mrp ?? 0;
          return (
            <ListItemButton
              key={item.id}
              selected={active}
              onClick={() => onSelect(item.id)}
              sx={{
                alignItems: 'flex-start',
                py: 1.25,
                borderBottom: `1px solid ${tok.border}`,
                bgcolor: active ? tok.listActive : 'transparent',
                borderLeft: active ? `3px solid ${tok.listActiveBorder}` : '3px solid transparent',
                '&.Mui-selected': { bgcolor: tok.listActive },
                '&:hover': { bgcolor: active ? tok.listActive : tok.surfaceMuted },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36, mt: 0.25 }} onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  edge="start"
                  size="small"
                  checked={selectedIds.has(item.id)}
                  onChange={() => onToggleSelect(item.id)}
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                    <Typography fontWeight={700} fontSize="0.875rem" color={tok.text} noWrap sx={{ flex: 1 }}>
                      {item.name}
                    </Typography>
                    <Typography fontWeight={700} fontSize="0.8125rem" color={tok.navyMid} sx={{ flexShrink: 0 }}>
                      {formatCurrency(price)}
                    </Typography>
                  </Stack>
                }
                secondary={
                  <Stack spacing={0.25}>
                    <Typography variant="caption" color={tok.textMuted}>
                      {categoryLabel(item.categoryId)} · Units: {unitLabel(item.unitId)}
                    </Typography>
                    <Typography variant="caption" color={tok.textMuted}>
                      Godown: {godownLabel(item)}
                    </Typography>
                  </Stack>
                }
                secondaryTypographyProps={{ component: 'div' }}
              />
            </ListItemButton>
          );
        })}
        {items.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: tok.textMuted }}>
            <Typography variant="body2">No items found</Typography>
          </Box>
        ) : null}
      </List>
    </Box>
  );
}
