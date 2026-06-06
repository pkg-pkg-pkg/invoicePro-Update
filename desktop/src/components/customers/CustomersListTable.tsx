import {
  Box,
  Button,
  Checkbox,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import type { Party } from '../../types/party';
import type { CustomerFilterKey } from '../../services/customers/customersApi';
import { customersApi } from '../../services/customers/customersApi';
import { formatCurrency } from '../../utils/formatters';
import { getCustomersModuleTokens } from '../../theme/customersModuleTheme';
import { useTheme } from '@mui/material/styles';
import { DocumentRowActionsMenu } from '../listActions/DocumentRowActionsMenu';
import { useState } from 'react';

export type CustomerSortKey = 'name' | 'company' | 'gstin' | 'mobile' | 'email' | 'balance' | 'status';

type TableProps = {
  customers: Party[];
  loading?: boolean;
  page: number;
  rowsPerPage: number;
  sortBy: CustomerSortKey;
  sortDir: 'asc' | 'desc';
  selectedIds: Set<string>;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (n: number) => void;
  onSortChange: (key: CustomerSortKey) => void;
  onToggleSelect: (id: string) => void;
  onToggleAll: (ids: string[]) => void;
  onRowClick: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onRefresh?: () => void;
};

function balanceColor(balance: number, overdue: boolean): string {
  if (overdue && balance > 0) return '#B91C1C';
  if (Math.abs(balance) < 0.01) return '#15803D';
  return '#0F172A';
}

function isOverdueCustomer(party: Party): boolean {
  return customersApi.customerBalance(party) > 0.01;
}

function sortCustomers(rows: Party[], sortBy: CustomerSortKey, sortDir: 'asc' | 'desc'): Party[] {
  const dir = sortDir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av: string | number = '';
    let bv: string | number = '';
    if (sortBy === 'balance') {
      av = customersApi.customerBalance(a);
      bv = customersApi.customerBalance(b);
    } else if (sortBy === 'company') {
      av = a.name;
      bv = b.name;
    } else if (sortBy === 'status') {
      av = a.status ?? 'ACTIVE';
      bv = b.status ?? 'ACTIVE';
    } else {
      av = String(a[sortBy] ?? '');
      bv = String(b[sortBy] ?? '');
    }
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

export function CustomersListTable({
  customers,
  loading,
  page,
  rowsPerPage,
  sortBy,
  sortDir,
  selectedIds,
  onPageChange,
  onRowsPerPageChange,
  onSortChange,
  onToggleSelect,
  onToggleAll,
  onRowClick,
  onEdit,
  onDelete,
  onNew,
  onRefresh,
}: TableProps) {
  const theme = useTheme();
  const tok = getCustomersModuleTokens(theme);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; party: Party } | null>(null);
  const sorted = sortCustomers(customers, sortBy, sortDir);
  const paged = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  const allPageIds = paged.map((c) => c.id);
  const allSelected = allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));

  const headerCell = (label: string, key: CustomerSortKey) => (
    <TableCell key={key} sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: tok.surfaceMuted }}>
      <TableSortLabel active={sortBy === key} direction={sortBy === key ? sortDir : 'asc'} onClick={() => onSortChange(key)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );

  if (!loading && customers.length === 0) {
    return (
      <Box sx={{ py: 10, textAlign: 'center', border: `1px solid ${tok.border}`, borderRadius: `${tok.radius}px`, bgcolor: tok.surface }}>
        <PeopleOutlineIcon sx={{ fontSize: 56, color: tok.textMuted, mb: 1 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>
          No customers yet
        </Typography>
        <Typography variant="body2" color={tok.textMuted} sx={{ mb: 2 }}>
          Add your first customer to start billing and tracking receivables.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={onNew}>
          Add your first customer
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ border: `1px solid ${tok.border}`, borderRadius: `${tok.radius}px`, bgcolor: tok.surface, overflow: 'hidden' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" sx={{ bgcolor: tok.surfaceMuted }}>
              <Checkbox size="small" checked={allSelected} indeterminate={selectedIds.size > 0 && !allSelected} onChange={() => onToggleAll(allPageIds)} />
            </TableCell>
            {headerCell('Name', 'name')}
            {headerCell('Company', 'company')}
            {headerCell('GSTIN', 'gstin')}
            {headerCell('Phone', 'mobile')}
            {headerCell('Email', 'email')}
            {headerCell('Balance (₹)', 'balance')}
            {headerCell('Status', 'status')}
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', bgcolor: tok.surfaceMuted }}>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {paged.map((c) => {
            const balance = customersApi.customerBalance(c);
            const overdue = isOverdueCustomer(c);
            const inactive = c.status === 'INACTIVE';
            return (
              <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => onRowClick(c.id)}>
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox size="small" checked={selectedIds.has(c.id)} onChange={() => onToggleSelect(c.id)} />
                </TableCell>
                <TableCell><Typography fontWeight={700}>{c.name}</Typography></TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.gstin || '—'}</TableCell>
                <TableCell>{c.mobile || '—'}</TableCell>
                <TableCell>{c.email || '—'}</TableCell>
                <TableCell>
                  <Typography fontWeight={700} sx={{ color: balanceColor(balance, overdue) }}>
                    {formatCurrency(balance)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {inactive ? (
                    <Chip label="Inactive" size="small" sx={{ bgcolor: '#F1F5F9', color: '#64748B', fontWeight: 700 }} />
                  ) : overdue ? (
                    <Chip label="Overdue" size="small" sx={{ bgcolor: '#FEF2F2', color: '#B91C1C', fontWeight: 700 }} />
                  ) : (
                    <Chip label="Active" size="small" sx={{ bgcolor: '#F0FDF4', color: '#15803D', fontWeight: 700 }} />
                  )}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <IconButton
                    size="small"
                    onClick={(e) => setMenuAnchor({ el: e.currentTarget, party: c })}
                    title="Actions"
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <DocumentRowActionsMenu
        anchorEl={menuAnchor?.el ?? null}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        onRefresh={onRefresh}
        onEditCustomer={onEdit}
        context={menuAnchor ? { type: 'customer', party: menuAnchor.party } : null}
      />
      <TablePagination
        component="div"
        count={customers.length}
        page={page}
        onPageChange={(_, p) => onPageChange(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => onRowsPerPageChange(parseInt(e.target.value, 10))}
        rowsPerPageOptions={[10, 20, 50]}
        labelDisplayedRows={({ from, to, count }) => `Showing ${from}-${to} of ${count} customers`}
      />
    </Box>
  );
}

type ToolbarProps = {
  filter: CustomerFilterKey;
  search: string;
  onFilterChange: (f: CustomerFilterKey) => void;
  onSearchChange: (q: string) => void;
  onClearFilters: () => void;
  onNew: () => void;
  onRefresh: () => void;
  onExport: () => void;
  onBulkUpload: () => void;
  onBulkDelete: () => void;
  selectedCount: number;
};

export function CustomersListToolbar({
  filter,
  search,
  onFilterChange,
  onSearchChange,
  onClearFilters,
  onNew,
  onRefresh,
  onExport,
  onBulkUpload,
  onBulkDelete,
  selectedCount,
}: ToolbarProps) {
  const theme = useTheme();
  const tok = getCustomersModuleTokens(theme);

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }} flexWrap="wrap" gap={1}>
        <Typography variant="h5" fontWeight={800} color={tok.text}>
          Customers
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap">
          <Button variant="contained" startIcon={<AddIcon />} onClick={onNew}>
            New Customer
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={onExport}>
            Download Excel
          </Button>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={onBulkUpload}>
            Bulk Upload
          </Button>
          <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} disabled={selectedCount === 0} onClick={onBulkDelete}>
            Bulk Delete
          </Button>
          <IconButton onClick={onRefresh} title="Refresh">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search customers..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          sx={{ minWidth: 260 }}
        />
        <TextField
          select
          size="small"
          label="Category"
          value={filter}
          onChange={(e) => onFilterChange(e.target.value as CustomerFilterKey)}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="ALL">All Customers</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="INACTIVE">Inactive</MenuItem>
          <MenuItem value="OVERDUE">Overdue</MenuItem>
        </TextField>
        {(search || filter !== 'ALL') ? (
          <Button size="small" onClick={onClearFilters}>
            Clear filters
          </Button>
        ) : null}
      </Stack>
    </>
  );
}
