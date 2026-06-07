import {
  Box,
  Checkbox,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { InventoryItem } from '../../types/masters';
import { formatCurrency } from '../../utils/formatters';
import { getItemsModuleTokens } from '../../theme/itemsModuleTheme';

type Props = {
  items: InventoryItem[];
  unitLabel: (unitId: string) => string;
  godownLabel: (item: InventoryItem) => string;
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
};

/** Compact item list shown beside the detail panel in split view. */
export function ItemsListPanel({
  items,
  unitLabel,
  godownLabel,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onToggleAll,
}: Props) {
  const theme = useTheme();
  const tok = getItemsModuleTokens(theme);
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  return (
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
              transition: 'background-color 0.2s ease, border-color 0.2s ease',
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
                  <Typography fontWeight={700} fontSize="0.875rem" color={active ? tok.accent : tok.text} noWrap sx={{ flex: 1 }}>
                    {item.name}
                  </Typography>
                  <Typography fontWeight={700} fontSize="0.8125rem" color={tok.navyMid} sx={{ flexShrink: 0 }}>
                    {formatCurrency(price)}
                  </Typography>
                </Stack>
              }
              secondary={
                <Typography variant="caption" color={tok.textMuted}>
                  {unitLabel(item.unitId)} · {godownLabel(item)}
                </Typography>
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
  );
}
