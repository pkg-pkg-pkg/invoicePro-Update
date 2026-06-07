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

const HEAD_SX = {
  whiteSpace: 'nowrap' as const,
  px: 1,
  py: 1.1,
  lineHeight: 1.2,
  fontSize: '0.72rem',
  letterSpacing: '0.01em',
};

const STOCK_COL_SX = { whiteSpace: 'nowrap' as const, overflow: 'visible' as const };

const BODY_CELL_SX = { px: 1, py: 1.1, verticalAlign: 'middle' as const, fontSize: '0.8125rem' };

function HeadLabel({ label, title }: { label: string; title?: string }) {
  const text = (
    <Box component="span" sx={{ fontWeight: 700 }}>
      {label}
    </Box>
  );
  return title ? (
    <Tooltip title={title}>
      <Box component="span" sx={{ fontWeight: 700 }}>
        {label}
      </Box>
    </Tooltip>
  ) : (
    text
  );
}

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
          color: tok.textMuted,
          borderBottom: `1px solid ${tok.border}`,
          ...HEAD_SX,
        },
        '& .MuiTableBody-root .MuiTableCell-root': BODY_CELL_SX,
      }}
    >
      <Table size="small" stickyHeader sx={{ width: '100%', minWidth: 1060, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 40 }} />
          <col style={{ width: 'auto' }} />
          <col style={{ width: 92 }} />
          <col style={{ width: 72 }} />
          <col style={{ width: 88 }} />
          <col style={{ width: 52 }} />
          <col style={{ width: 84 }} />
          <col style={{ width: 96 }} />
          <col style={{ width: 92 }} />
          <col style={{ width: 124 }} />
          <col style={{ width: 80 }} />
          <col style={{ width: 96 }} />
        </colgroup>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox">
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={selectedIds.size > 0 && !allSelected}
                onChange={onToggleAll}
              />
            </TableCell>
            <TableCell><HeadLabel label="Item Name" /></TableCell>
            <TableCell><HeadLabel label="SKU" /></TableCell>
            <TableCell><HeadLabel label="HSN" title="HSN Code" /></TableCell>
            <TableCell><HeadLabel label="Category" /></TableCell>
            <TableCell><HeadLabel label="Unit" /></TableCell>
            <TableCell><HeadLabel label="Godown" /></TableCell>
            <TableCell align="right"><HeadLabel label="Pur. Price" title="Purchase Price" /></TableCell>
            <TableCell align="right"><HeadLabel label="Sale Price" title="Sales Price" /></TableCell>
            <TableCell sx={STOCK_COL_SX}><HeadLabel label="Stock" title="Stock Status" /></TableCell>
            <TableCell><HeadLabel label="Item" title="Item Status (Active / Inactive)" /></TableCell>
            <TableCell align="right"><HeadLabel label="Actions" /></TableCell>
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
                  <Typography fontWeight={700} fontSize="0.8125rem" color={tok.text} noWrap title={item.name}>
                    {item.name}
                  </Typography>
                  <Typography variant="caption" color={tok.textMuted} noWrap title={getItemTypeLabel(item.itemType)}>
                    {getItemTypeLabel(item.itemType)}
                  </Typography>
                </TableCell>
                <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.sku || undefined}>
                  {item.sku || '—'}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{item.hsnCode || '—'}</TableCell>
                <TableCell sx={{ overflow: 'hidden' }}>
                  {item.categoryId ? (
                    <Chip
                      label={categoryLabel(item.categoryId)}
                      size="small"
                      variant="outlined"
                      sx={{ fontWeight: 600, maxWidth: '100%', '& .MuiChip-label': { px: 0.75, overflow: 'hidden', textOverflow: 'ellipsis' } }}
                    />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{unitLabel(item.unitId)}</TableCell>
                <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={godownLabel(item)}>
                  {godownLabel(item)}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(purchase)}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(sale)}</TableCell>
                <TableCell sx={STOCK_COL_SX}>
                  <Chip
                    label={stock.label}
                    size="small"
                    sx={{
                      height: 22,
                      fontWeight: 600,
                      fontSize: '0.7rem',
                      bgcolor: `${stock.color}14`,
                      color: stock.color,
                      border: `1px solid ${stock.color}40`,
                      '& .MuiChip-label': { px: 0.75 },
                    }}
                    icon={
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          bgcolor: stock.color,
                          ml: '5px !important',
                          mr: '-3px !important',
                        }}
                      />
                    }
                  />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Chip
                    label={item.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                    size="small"
                    color={item.status === 'ACTIVE' ? 'success' : 'default'}
                    variant={item.status === 'ACTIVE' ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600, height: 22, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.75 } }}
                  />
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()} sx={{ whiteSpace: 'nowrap', px: 0.5 }}>
                  <Stack direction="row" spacing={0} justifyContent="flex-end" className="row-actions">
                    {canManage ? (
                      <>
                        <Tooltip title="Edit">
                          <IconButton size="small" sx={{ p: 0.5 }} onClick={() => onEdit(item.id)}>
                            <EditOutlinedIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Duplicate">
                          <IconButton size="small" sx={{ p: 0.5 }} onClick={() => onDuplicate(item.id)}>
                            <ContentCopyIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" sx={{ p: 0.5 }} onClick={() => onDelete(item.id)}>
                            <DeleteOutlineIcon sx={{ fontSize: 17 }} />
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
