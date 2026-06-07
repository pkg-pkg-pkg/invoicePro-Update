import {
  Box,
  Checkbox,
  Chip,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTheme } from '@mui/material/styles';
import type { InventoryItem } from '../../types/masters';
import { formatCurrency } from '../../utils/formatters';
import { getItemsModuleTokens } from '../../theme/itemsModuleTheme';
import { getItemStockStatus, getItemTypeLabel } from '../../utils/itemDisplayHelpers';

type Props = {
  items: InventoryItem[];
  categoryLabel: (categoryId: string | null | undefined) => string;
  unitLabel: (unitId: string) => string;
  godownLabel: (item: InventoryItem) => string;
  selectedId: string | null;
  selectedIds: Set<string>;
  canManage: boolean;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onEdit: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ItemsTablePanel({
  items,
  categoryLabel,
  unitLabel,
  godownLabel,
  selectedId,
  selectedIds,
  canManage,
  onSelect,
  onToggleSelect,
  onToggleAll,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  const theme = useTheme();
  const tok = getItemsModuleTokens(theme);
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  return (
    <TableContainer
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        '& .MuiTableHead-root .MuiTableCell-root': {
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: tok.surfaceMuted,
          fontWeight: 700,
          fontSize: '0.75rem',
          color: tok.textMuted,
          borderBottom: `1px solid ${tok.border}`,
        },
      }}
    >
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" sx={{ width: 48 }}>
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={selectedIds.size > 0 && !allSelected}
                onChange={onToggleAll}
              />
            </TableCell>
            <TableCell>Item Name</TableCell>
            <TableCell>SKU</TableCell>
            <TableCell>HSN Code</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Unit</TableCell>
            <TableCell>Godown</TableCell>
            <TableCell align="right">Purchase Price</TableCell>
            <TableCell align="right">Sales Price</TableCell>
            <TableCell>Stock Status</TableCell>
            <TableCell>Status</TableCell>
            <TableCell align="right" sx={{ width: 108 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => {
            const stock = getItemStockStatus(item);
            const purchase = item.pricing?.purchase ?? 0;
            const sale = item.pricing?.sale ?? item.pricing?.mrp ?? 0;
            return (
              <TableRow
                key={item.id}
                hover
                selected={selectedId === item.id}
                onClick={() => onSelect(item.id)}
                sx={{
                  cursor: 'pointer',
                  '& .row-actions': { opacity: 0, transition: 'opacity 0.15s ease' },
                  '&:hover .row-actions': { opacity: 1 },
                  bgcolor: selectedId === item.id ? tok.listActive : undefined,
                }}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    size="small"
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggleSelect(item.id)}
                  />
                </TableCell>
                <TableCell>
                  <Typography fontWeight={700} fontSize="0.875rem" color={tok.text}>
                    {item.name}
                  </Typography>
                  <Typography variant="caption" color={tok.textMuted}>
                    {getItemTypeLabel(item.itemType)}
                  </Typography>
                </TableCell>
                <TableCell>{item.sku || '—'}</TableCell>
                <TableCell>{item.hsnCode || '—'}</TableCell>
                <TableCell>
                  {item.categoryId ? (
                    <Chip label={categoryLabel(item.categoryId)} size="small" variant="outlined" sx={{ fontWeight: 600 }} />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>{unitLabel(item.unitId)}</TableCell>
                <TableCell>{godownLabel(item)}</TableCell>
                <TableCell align="right">{formatCurrency(purchase)}</TableCell>
                <TableCell align="right">{formatCurrency(sale)}</TableCell>
                <TableCell>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: stock.color, flexShrink: 0 }} />
                    <Typography variant="body2" fontSize="0.8125rem">
                      {stock.label}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <Chip
                    label={item.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    size="small"
                    color={item.status === 'ACTIVE' ? 'success' : 'default'}
                    variant={item.status === 'ACTIVE' ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600, minWidth: 72 }}
                  />
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Stack direction="row" spacing={0.25} justifyContent="flex-end" className="row-actions">
                    {canManage ? (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => onEdit(item.id)}>
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicate">
                          <IconButton size="small" onClick={() => onDuplicate(item.id)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => onDelete(item.id)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : null}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={12} align="center" sx={{ py: 6, color: tok.textMuted }}>
                No items found
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
