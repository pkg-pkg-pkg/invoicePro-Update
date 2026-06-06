import { useState } from 'react';
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
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useTheme } from '@mui/material/styles';
import type { Party } from '../../types/party';
import type { CustomerFilterKey } from '../../services/customers/customersApi';
import { customersApi } from '../../services/customers/customersApi';
import { formatCurrency } from '../../utils/formatters';
import { getCustomersModuleTokens } from '../../theme/customersModuleTheme';

type Props = {
  customers: Party[];
  selectedId: string | null;
  selectedIds: Set<string>;
  filter: CustomerFilterKey;
  search: string;
  onFilterChange: (f: CustomerFilterKey) => void;
  onSearchChange: (q: string) => void;
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleAll: () => void;
  onNew: () => void;
  onBulkDelete?: () => void;
  onExport?: () => void;
};

export function CustomersListPanel({
  customers,
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
}: Props) {
  const theme = useTheme();
  const tok = getCustomersModuleTokens(theme);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const allSelected = customers.length > 0 && selectedIds.size === customers.length;

  return (
    <Box
      sx={{
        width: { xs: '100%', lg: '25%' },
        flex: { lg: '0 0 25%' },
        minWidth: { lg: 260 },
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
          <InputLabel>View</InputLabel>
          <Select label="View" value={filter} onChange={(e) => onFilterChange(e.target.value as CustomerFilterKey)}>
            <MenuItem value="ALL">All Customers</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
            <MenuItem value="WITH_BALANCE">With Balance</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onNew} sx={{ flexShrink: 0, fontWeight: 700 }}>
          New
        </Button>
        <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
          <MoreVertIcon />
        </IconButton>
        <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
          {onExport ? (
            <MenuItem onClick={() => { onExport(); setMenuAnchor(null); }}>
              <FileDownloadIcon fontSize="small" sx={{ mr: 1 }} /> Export
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
          placeholder="Search in Customers"
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
        {customers.length > 0 ? (
          <ListItemButton sx={{ py: 0.5, borderBottom: `1px solid ${tok.border}` }} onClick={onToggleAll}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <Checkbox edge="start" size="small" checked={allSelected} indeterminate={selectedIds.size > 0 && !allSelected} />
            </ListItemIcon>
            <ListItemText primaryTypographyProps={{ variant: 'caption', fontWeight: 700 }} primary="Select all" />
          </ListItemButton>
        ) : null}

        {customers.map((c) => {
          const active = c.id === selectedId;
          const balance = customersApi.customerBalance(c);
          return (
            <ListItemButton
              key={c.id}
              selected={active}
              onClick={() => onSelect(c.id)}
              sx={{
                py: 1.25,
                borderBottom: `1px solid ${tok.border}`,
                bgcolor: active ? tok.listActive : 'transparent',
                borderLeft: active ? `3px solid ${tok.listActiveBorder}` : '3px solid transparent',
                '&.Mui-selected': { bgcolor: tok.listActive },
                '&.Mui-selected:hover': { bgcolor: tok.listActive },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }} onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  edge="start"
                  size="small"
                  checked={selectedIds.has(c.id)}
                  onChange={() => onToggleSelect(c.id)}
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography variant="body2" fontWeight={700} color={tok.text} noWrap>
                    {c.name}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color={tok.textMuted}>
                    {formatCurrency(balance)}
                  </Typography>
                }
              />
            </ListItemButton>
          );
        })}

        {customers.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color={tok.textMuted}>
              No customers found
            </Typography>
          </Box>
        ) : null}
      </List>
    </Box>
  );
}
