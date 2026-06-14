import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Party, PartyInput } from '../../types/party';
import { partyService, PARTIES_CHANGED_EVENT } from '../../services/masters/partyService';
import { PartyFullForm } from '../../components/party/PartyFullForm';
import type { PartyProfile } from '../../types/partyProfile';
import { partyProfileService } from '../../services/masters/partyProfileService';
import {
  exportPartyTemplateExcel,
  mergePartyByMobileOrName,
  parsePartiesFile,
} from '../Parties/partyBulkExcel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Stack,
  Chip,
  IconButton,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { formatCurrency } from '../../utils/formatters';

type CreditorFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'WITH_BALANCE';

function creditorBalance(party: Party): number {
  const bal = Number(party.currentBalance ?? party.openingBalance ?? 0);
  return Math.max(0, -bal);
}

export default function CreditorsListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [creditors, setCreditors] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CreditorFilter>('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editParty, setEditParty] = useState<Party | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const status = filter === 'ACTIVE' ? 'ACTIVE' : filter === 'INACTIVE' ? 'INACTIVE' : undefined;
      let rows = await partyService.list({
        partyType: ['SUPPLIER', 'BOTH'],
        status,
        search: search.trim() || undefined,
      });
      if (filter === 'WITH_BALANCE') {
        rows = rows.filter((p) => creditorBalance(p) > 0.01);
      }
      setCreditors(rows.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setFormMode('create');
      setEditParty(null);
      setFormOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onPartiesChanged = () => void load();
    window.addEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
    return () => window.removeEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
  }, [load]);

  const handleSave = async (input: PartyInput, profile: Omit<PartyProfile, 'partyId'>, saveAndNew?: boolean) => {
    setSaving(true);
    setError(null);
    try {
      const payload = { ...input, partyType: 'SUPPLIER' as const };
      if (formMode === 'edit' && editParty) {
        await partyService.update(editParty.id, payload);
        await partyProfileService.save({ ...profile, partyId: editParty.id });
      } else {
        const created = await partyService.create(payload);
        await partyProfileService.save({ ...profile, partyId: created.id });
      }
      if (!saveAndNew) setFormOpen(false);
      await load();
      if (saveAndNew) {
        setFormMode('create');
        setEditParty(null);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    const buffer = await exportPartyTemplateExcel(creditors);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `creditors-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBulkUploading(true);
    setBulkError(null);
    try {
      const rows = await parsePartiesFile(file);
      const existing = await partyService.listForPurchase();
      for (const row of rows) {
        const input = { ...row, partyType: 'SUPPLIER' as const };
        const match = mergePartyByMobileOrName(existing, input);
        if (match) await partyService.update(match.id, input);
        else {
          const created = await partyService.create(input);
          existing.push(created);
        }
      }
      setBulkOpen(false);
      await load();
    } catch (err) {
      setBulkError((err as Error).message);
    } finally {
      setBulkUploading(false);
    }
  };

  const pageRows = creditors.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      {error ? <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert> : null}

      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setFormMode('create'); setEditParty(null); setFormOpen(true); }}>
          New Creditor
        </Button>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void handleExport()}>Download Excel</Button>
        <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => setBulkOpen(true)}>Bulk Upload</Button>
        <IconButton onClick={() => void load()}><RefreshIcon /></IconButton>
        <TextField select size="small" label="Category" value={filter} onChange={(e) => { setFilter(e.target.value as CreditorFilter); setPage(0); }} sx={{ minWidth: 160 }}>
          <MenuItem value="ALL">All Creditors</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="INACTIVE">Inactive</MenuItem>
          <MenuItem value="WITH_BALANCE">With Balance</MenuItem>
        </TextField>
        <TextField size="small" placeholder="Search creditors…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ minWidth: 220 }} />
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>GSTIN</TableCell>
            <TableCell>Phone</TableCell>
            <TableCell align="right">Outstanding (₹)</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading ? (
            <TableRow><TableCell colSpan={6}>Loading…</TableCell></TableRow>
          ) : pageRows.length === 0 ? (
            <TableRow><TableCell colSpan={6} align="center">No creditors found</TableCell></TableRow>
          ) : (
            pageRows.map((party) => {
              const outstanding = creditorBalance(party);
              return (
                <TableRow key={party.id} hover sx={{ cursor: 'pointer' }} onClick={() => party.ledgerId && navigate(`/ledgers/report?ledgerId=${party.ledgerId}`)}>
                  <TableCell>{party.name}</TableCell>
                  <TableCell>{party.gstin || '—'}</TableCell>
                  <TableCell>{party.mobile || '—'}</TableCell>
                  <TableCell align="right" sx={{ color: outstanding > 0 ? 'error.main' : undefined, fontWeight: 700 }}>
                    {formatCurrency(outstanding)}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={party.status === 'INACTIVE' ? 'Inactive' : 'Active'} color={party.status === 'INACTIVE' ? 'default' : 'success'} />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button size="small" onClick={() => { setEditParty(party); setFormMode('edit'); setFormOpen(true); }}>Edit</Button>
                    {party.ledgerId ? (
                      <Button size="small" onClick={() => navigate(`/ledgers/report?ledgerId=${party.ledgerId}`)}>Statement</Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      <TablePagination
        component="div"
        count={creditors.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
      />

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="lg" fullWidth scroll="paper">
        <DialogTitle>{formMode === 'create' ? 'New Creditor' : 'Edit Creditor'}</DialogTitle>
        <DialogContent dividers>
          <PartyFullForm
            mode="vendor"
            party={editParty}
            embedded
            saving={saving}
            onCancel={() => setFormOpen(false)}
            onSave={handleSave}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)}>
        <DialogTitle>Bulk upload creditors</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload Excel using the party template. Rows import as suppliers.
          </Typography>
          {bulkError ? <Alert severity="error">{bulkError}</Alert> : null}
          <Button variant="outlined" component="label" disabled={bulkUploading}>
            Choose file
            <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => void handleBulkFile(e)} />
          </Button>
        </DialogContent>
        <DialogActions><Button onClick={() => setBulkOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
}
