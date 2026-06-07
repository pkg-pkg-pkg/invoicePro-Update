import { useState } from 'react';
import {
  Button,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import type { ItemCategory } from '../../types/masters';

type FilterKey = 'ALL' | 'ACTIVE' | 'INACTIVE' | string;

type Props = {
  categories: ItemCategory[];
  filter: FilterKey;
  search: string;
  onFilterChange: (f: FilterKey) => void;
  onSearchChange: (q: string) => void;
  onNew: () => void;
  onBulkDelete?: () => void;
  onExport?: () => void;
  onExportCsv?: () => void;
  onImport?: () => void;
  compact?: boolean;
};

export function ItemsToolbar({
  categories,
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onNew,
  onBulkDelete,
  onExport,
  onExportCsv,
  onImport,
  compact = false,
}: Props) {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={1}
      sx={{ px: compact ? 1.25 : 2, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}
    >
      <FormControl size="small" sx={{ flex: compact ? 1 : { xs: 1, sm: 'none' }, minWidth: compact ? 0 : { sm: 180 } }}>
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
      <TextField
        size="small"
        sx={{
          width: { xs: '100%', sm: compact ? undefined : 240 },
          flex: compact ? 1 : 'none',
          minWidth: compact ? 0 : { sm: 200 },
          maxWidth: compact ? undefined : { sm: 280 },
        }}
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
      <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexShrink: 0, ml: { sm: 'auto' } }}>
      <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={onNew} sx={{ fontWeight: 700 }}>
        New
      </Button>
      <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
      </Stack>
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
  );
}
