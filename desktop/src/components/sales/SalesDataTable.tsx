import { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DeleteIcon from '@mui/icons-material/Delete';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../hooks/usePermissions';
import { voucherService } from '../../services/vouchers/voucherService';
import { approvalService } from '../../services/approvals/approvalService';
import type { SalesDocumentRow } from '../../types/salesDocuments';
import { SalesStatusBadge } from './SalesStatusBadge';
import { getSalesModuleTokens } from '../../theme/salesModuleTheme';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { exportSalesDocumentsExcel, exportSalesDocumentsPdf } from '../../utils/salesDocumentExport';
import { DocumentRowActionsMenu } from '../listActions/DocumentRowActionsMenu';
import type { DocumentListKind } from '../listActions/types';
import { EwayBillStatusChip } from '../eway/EwayBillStatusChip';

export type SalesColumnKey =
  | 'number'
  | 'date'
  | 'customer'
  | 'amount'
  | 'gstAmount'
  | 'balanceDue'
  | 'status'
  | 'dueDate'
  | 'ewayBill';

const ALL_COLUMNS: { key: SalesColumnKey; label: string; align?: 'left' | 'right' }[] = [
  { key: 'number', label: 'Document No.' },
  { key: 'date', label: 'Date' },
  { key: 'customer', label: 'Customer' },
  { key: 'amount', label: 'Amount', align: 'right' },
  { key: 'gstAmount', label: 'GST Amount', align: 'right' },
  { key: 'balanceDue', label: 'Balance Due', align: 'right' },
  { key: 'status', label: 'Status' },
  { key: 'dueDate', label: 'Due Date' },
  { key: 'ewayBill', label: 'EWB' },
];

type SortKey = SalesColumnKey;
type SortDir = 'asc' | 'desc';

type Props = {
  kind: string;
  title: string;
  rows: SalesDocumentRow[];
  loading?: boolean;
  onRefresh: () => void;
  onBulkDelete?: (ids: string[]) => void;
  allowPipelineDelete?: boolean;
  partyColumnLabel?: string;
};

function colStorageKey(kind: string) {
  return `pve_module_columns_${kind}`;
}

function readVisibleColumns(kind: string): SalesColumnKey[] {
  try {
    const raw = localStorage.getItem(colStorageKey(kind));
    if (!raw) return ALL_COLUMNS.map((c) => c.key);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : ALL_COLUMNS.map((c) => c.key);
  } catch {
    return ALL_COLUMNS.map((c) => c.key);
  }
}

export function SalesDataTable({
  kind,
  title,
  rows,
  loading,
  onRefresh,
  onBulkDelete,
  allowPipelineDelete,
  partyColumnLabel = 'Customer',
}: Props) {
  const theme = useTheme();
  const st = getSalesModuleTokens(theme);
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();

  const handleDeleteInvoice = async (row: SalesDocumentRow) => {
    if (kind !== 'tax-invoices' || row.source !== 'voucher') return;
    if (!isAdmin) {
      try {
        await approvalService.request({
          section: 'SALES',
          action: 'DELETE_VOUCHER',
          entityType: 'VOUCHER',
          entityId: row.id,
          entityLabel: row.number,
          reason: 'Delete sales invoice requested by non-admin user',
        });
        alert('Approval request sent to Admin. Once approved, invoice will be deleted.');
      } catch (e) {
        alert((e as Error).message || 'Could not send approval request.');
      }
      return;
    }
    if (!window.confirm(`Delete invoice ${row.number}?`)) return;
    try {
      await voucherService.delete(row.id);
      onRefresh();
    } catch (e) {
      alert((e as Error).message || 'Failed to delete invoice.');
    }
  };

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [visibleCols, setVisibleCols] = useState<SalesColumnKey[]>(() => readVisibleColumns(kind));
  const [colDialogOpen, setColDialogOpen] = useState(false);
  const [bulkAnchor, setBulkAnchor] = useState<null | HTMLElement>(null);
  const [rowMenu, setRowMenu] = useState<{ anchor: HTMLElement; row: SalesDocumentRow } | null>(null);

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let av: string | number = '';
      let bv: string | number = '';
      switch (sortKey) {
        case 'number':
          av = a.number;
          bv = b.number;
          break;
        case 'date':
          av = a.date;
          bv = b.date;
          break;
        case 'customer':
          av = a.customerName;
          bv = b.customerName;
          break;
        case 'amount':
          av = a.amount;
          bv = b.amount;
          break;
        case 'gstAmount':
          av = a.gstAmount ?? 0;
          bv = b.gstAmount ?? 0;
          break;
        case 'balanceDue':
          av = a.balanceDue ?? 0;
          bv = b.balanceDue ?? 0;
          break;
        case 'status':
          av = a.status;
          bv = b.status;
          break;
        case 'dueDate':
          av = a.dueDate ?? '';
          bv = b.dueDate ?? '';
          break;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortDir, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleAll = () => {
    if (selected.size === sortedRows.length) setSelected(new Set());
    else setSelected(new Set(sortedRows.map((r) => r.id)));
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedRows = sortedRows.filter((r) => selected.has(r.id));

  const saveColumns = useCallback(
    (cols: SalesColumnKey[]) => {
      setVisibleCols(cols);
      localStorage.setItem(colStorageKey(kind), JSON.stringify(cols));
      setColDialogOpen(false);
    },
    [kind]
  );

  const handleExportExcel = async (target: SalesDocumentRow[]) => {
    await exportSalesDocumentsExcel(target, title, `${kind}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const openRow = (row: SalesDocumentRow) => {
    if (row.editPath) navigate(row.editPath);
  };

  const columns = ALL_COLUMNS.map((col) =>
    col.key === 'customer' ? { ...col, label: partyColumnLabel } : col
  ).filter((c) => visibleCols.includes(c.key));

  return (
    <Box sx={{ bgcolor: '#fff', borderRadius: '0 0 8px 8px', border: '1px solid #e2e8f0', borderTop: 'none' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.25, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}
      >
        <Typography variant="body2" fontWeight={700} color="#64748b">
          {sortedRows.length} record{sortedRows.length === 1 ? '' : 's'}
          {selected.size > 0 ? ` · ${selected.size} selected` : ''}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          {selected.size > 0 ? (
            <>
              <Button size="small" onClick={(e) => setBulkAnchor(e.currentTarget)} endIcon={<MoreVertIcon />}>
                Bulk actions
              </Button>
              <Menu anchorEl={bulkAnchor} open={Boolean(bulkAnchor)} onClose={() => setBulkAnchor(null)}>
                <MenuItem
                  onClick={() => {
                    void handleExportExcel(selectedRows);
                    setBulkAnchor(null);
                  }}
                >
                  Export selected (Excel)
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    exportSalesDocumentsPdf(selectedRows, `${title} — Selected`);
                    setBulkAnchor(null);
                  }}
                >
                  Export selected (PDF)
                </MenuItem>
                {allowPipelineDelete && onBulkDelete ? (
                  <MenuItem
                    onClick={() => {
                      onBulkDelete(selectedRows.filter((r) => r.source === 'pipeline').map((r) => r.id));
                      setSelected(new Set());
                      setBulkAnchor(null);
                    }}
                  >
                    Delete selected
                  </MenuItem>
                ) : null}
              </Menu>
            </>
          ) : null}
          <Tooltip title="Column chooser">
            <IconButton size="small" onClick={() => setColDialogOpen(true)}>
              <ViewColumnIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export Excel">
            <IconButton size="small" onClick={() => void handleExportExcel(sortedRows)}>
              <FileDownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export PDF">
            <IconButton size="small" onClick={() => exportSalesDocumentsPdf(sortedRows, title)}>
              <PictureAsPdfIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Refresh">
            <span style={{ display: 'inline-flex' }}>
              <IconButton size="small" onClick={onRefresh} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ bgcolor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <Checkbox
                  size="small"
                  indeterminate={selected.size > 0 && selected.size < sortedRows.length}
                  checked={sortedRows.length > 0 && selected.size === sortedRows.length}
                  onChange={toggleAll}
                />
              </TableCell>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  align={col.align}
                  sx={{
                    bgcolor: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 800,
                    fontSize: '0.6875rem',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid #e2e8f0',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <TableSortLabel
                    active={sortKey === col.key}
                    direction={sortKey === col.key ? sortDir : 'asc'}
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell
                align="right"
                sx={{
                  bgcolor: '#f1f5f9',
                  borderBottom: '1px solid #e2e8f0',
                  color: '#475569',
                  fontWeight: 800,
                  fontSize: '0.6875rem',
                }}
              >
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedRows.map((row) => (
              <TableRow
                key={row.id}
                hover
                selected={selected.has(row.id)}
                onClick={() => openRow(row)}
                sx={{
                  cursor: row.editPath ? 'pointer' : 'default',
                  '&:hover': { bgcolor: st.rowHover },
                  '&.Mui-selected': { bgcolor: st.activeNavBg },
                }}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox size="small" checked={selected.has(row.id)} onChange={() => toggleRow(row.id)} />
                </TableCell>
                {columns.map((col) => (
                  <TableCell key={col.key} align={col.align}>
                    {col.key === 'number' ? (
                      <Typography
                        component="span"
                        fontWeight={700}
                        sx={{ color: st.navyMid, cursor: row.editPath ? 'pointer' : 'default' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          row.editPath && navigate(row.editPath);
                        }}
                      >
                        {row.number}
                      </Typography>
                    ) : col.key === 'date' ? (
                      formatDate(row.date)
                    ) : col.key === 'customer' ? (
                      row.customerName
                    ) : col.key === 'amount' ? (
                      <Typography fontWeight={700}>{formatCurrency(row.amount)}</Typography>
                    ) : col.key === 'gstAmount' ? (
                      formatCurrency(row.gstAmount ?? 0)
                    ) : col.key === 'balanceDue' ? (
                      <Typography
                        fontWeight={700}
                        sx={{ color: (row.balanceDue ?? 0) > 0 ? '#B91C1C' : '#15803D' }}
                      >
                        {formatCurrency(row.balanceDue ?? 0)}
                      </Typography>
                    ) : col.key === 'status' ? (
                      <SalesStatusBadge status={row.status} />
                    ) : col.key === 'dueDate' ? (
                      row.dueDate ? formatDate(row.dueDate) : '—'
                    ) : col.key === 'ewayBill' ? (
                      <EwayBillStatusChip eway={row.ewayBill} />
                    ) : null}
                  </TableCell>
                ))}
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Stack direction="row" spacing={0.25} justifyContent="flex-end" alignItems="center">
                    {kind === 'tax-invoices' && row.source === 'voucher' ? (
                      <Tooltip title={isAdmin ? 'Delete invoice' : 'Request delete approval'}>
                        <span style={{ display: 'inline-flex' }}>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => void handleDeleteInvoice(row)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    ) : null}
                    <IconButton size="small" onClick={(e) => setRowMenu({ anchor: e.currentTarget, row })}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 2} align="center" sx={{ py: 6, color: st.textMuted }}>
                  {loading ? 'Loading…' : 'No documents match your filters.'}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Box>

      <DocumentRowActionsMenu
        anchorEl={rowMenu?.anchor ?? null}
        open={Boolean(rowMenu)}
        onClose={() => setRowMenu(null)}
        listKind={kind as DocumentListKind}
        title={title}
        onRefresh={onRefresh}
        context={
          rowMenu
            ? {
                type: 'document',
                row: rowMenu.row,
                listKind: kind as DocumentListKind,
                title,
              }
            : null
        }
      />

      <Dialog open={colDialogOpen} onClose={() => setColDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>Choose columns</DialogTitle>
        <DialogContent>
          <FormGroup>
            {ALL_COLUMNS.map((col) => (
              <FormControlLabel
                key={col.key}
                control={
                  <Checkbox
                    checked={visibleCols.includes(col.key)}
                    onChange={(e) => {
                      if (e.target.checked) setVisibleCols((prev) => [...prev, col.key]);
                      else if (visibleCols.length > 1) setVisibleCols((prev) => prev.filter((k) => k !== col.key));
                    }}
                  />
                }
                label={col.label}
              />
            ))}
          </FormGroup>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setColDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => saveColumns(visibleCols)}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
