import { ChangeEvent, useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Party, PartyInput } from '../../types/party';
import { customersApi, type CustomerFilterKey } from '../../services/customers/customersApi';
import { CustomerFormModal } from '../../components/customers/CustomerFormModal';
import { CustomersListTable, CustomersListToolbar, type CustomerSortKey } from '../../components/customers/CustomersListTable';
import {
  exportPartyTemplateExcel,
  mergePartyByMobileOrName,
  parsePartiesFile,
} from '../Parties/partyBulkExcel';
import { partyService, PARTIES_CHANGED_EVENT } from '../../services/masters/partyService';
import { sendBulkOutstandingReminders } from '../../services/customers/customerLedgerStatementService';

export default function CustomersListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [customers, setCustomers] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<CustomerFilterKey>('ALL');
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [sortBy, setSortBy] = useState<CustomerSortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editParty, setEditParty] = useState<Party | null>(null);
  const [saving, setSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [reminderSummary, setReminderSummary] = useState<string | null>(null);
  const [bulkStatusOpen, setBulkStatusOpen] = useState<'ACTIVE' | 'INACTIVE' | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await customersApi.list(filter, search);
      setCustomers(list);
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
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const onPartiesChanged = () => void loadCustomers();
    window.addEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
    return () => window.removeEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
  }, [loadCustomers]);

  const handleSortChange = (key: CustomerSortKey) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('asc');
    }
  };

  const handleSubmit = async (values: PartyInput) => {
    setSaving(true);
    setError(null);
    try {
      if (formMode === 'create') {
        const created = await customersApi.create(values);
        setFormOpen(false);
        await loadCustomers();
        navigate(`/ledgers/debtors/${created.id}`);
      } else if (editParty) {
        await customersApi.update(editParty.id, values);
        setFormOpen(false);
        await loadCustomers();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) await customersApi.markInactive(id);
    setSelectedIds(new Set());
    await loadCustomers();
  };

  const handleBulkReminders = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const result = await sendBulkOutstandingReminders(ids);
    setReminderSummary(`Selected: ${result.selected} • Sent: ${result.sent} • Skipped: ${result.skipped}`);
    if (result.errors.length) setError(result.errors.join('; '));
  };

  const handleBulkStatus = async (status: 'ACTIVE' | 'INACTIVE') => {
    for (const id of selectedIds) {
      if (status === 'ACTIVE') await customersApi.reactivate(id);
      else await customersApi.markInactive(id);
    }
    setSelectedIds(new Set());
    setBulkStatusOpen(null);
    await loadCustomers();
  };

  const handleExport = async () => {
    const rows = selectedIds.size > 0 ? customers.filter((c) => selectedIds.has(c.id)) : customers;
    const buffer = await exportPartyTemplateExcel(rows);
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      const existing = await partyService.listForSales();
      for (const row of rows) {
        const input = { ...row, partyType: 'BUYER' as const };
        const match = mergePartyByMobileOrName(existing, input);
        if (match) await partyService.update(match.id, input);
        else {
          const created = await partyService.create(input);
          existing.push(created);
        }
      }
      setBulkOpen(false);
      await loadCustomers();
    } catch (err) {
      setBulkError((err as Error).message);
    } finally {
      setBulkUploading(false);
    }
  };

  return (
    <Box>
      {error ? <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert> : null}

      {reminderSummary ? <Alert severity="info" sx={{ mb: 1.5 }} onClose={() => setReminderSummary(null)}>{reminderSummary}</Alert> : null}

      <CustomersListToolbar
        filter={filter}
        search={search}
        onFilterChange={(f) => { setFilter(f); setPage(0); }}
        onSearchChange={(q) => { setSearch(q); setPage(0); }}
        onClearFilters={() => { setFilter('ALL'); setSearch(''); setPage(0); }}
        onNew={() => { setFormMode('create'); setEditParty(null); setFormOpen(true); }}
        onRefresh={() => void loadCustomers()}
        onExport={() => void handleExport()}
        onBulkUpload={() => setBulkOpen(true)}
        onBulkDelete={() => void handleBulkDelete()}
        onBulkReminders={() => void handleBulkReminders()}
        onBulkMarkActive={() => setBulkStatusOpen('ACTIVE')}
        onBulkMarkInactive={() => setBulkStatusOpen('INACTIVE')}
        selectedCount={selectedIds.size}
      />

      <CustomersListTable
        customers={customers}
        loading={loading}
        page={page}
        rowsPerPage={rowsPerPage}
        sortBy={sortBy}
        sortDir={sortDir}
        selectedIds={selectedIds}
        onPageChange={setPage}
        onRowsPerPageChange={(n) => { setRowsPerPage(n); setPage(0); }}
        onSortChange={handleSortChange}
        onToggleSelect={(id) => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onToggleAll={(ids) => {
          const allOnPage = ids.every((id) => selectedIds.has(id));
          setSelectedIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => (allOnPage ? next.delete(id) : next.add(id)));
            return next;
          });
        }}
        onRowClick={(id) => navigate(`/ledgers/debtors/${id}`)}
        onEdit={(id) => {
          const party = customers.find((c) => c.id === id);
          if (!party) return;
          setEditParty(party);
          setFormMode('edit');
          setFormOpen(true);
        }}
        onDelete={async (id) => {
          await customersApi.remove(id);
          await loadCustomers();
        }}
        onRefresh={() => void loadCustomers()}
        onNew={() => { setFormMode('create'); setEditParty(null); setFormOpen(true); }}
      />

      <CustomerFormModal
        open={formOpen}
        mode={formMode}
        party={editParty}
        saving={saving}
        onClose={() => setFormOpen(false)}
        onSubmit={async () => {
          setFormOpen(false);
          await loadCustomers();
        }}
      />

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)}>
        <DialogTitle>Bulk upload customers</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload Excel (.xlsx) using the party template. Rows are imported as customers (buyers).
          </Typography>
          {bulkError ? <Alert severity="error">{bulkError}</Alert> : null}
          <Button variant="outlined" component="label" disabled={bulkUploading}>
            Choose file
            <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => void handleBulkFile(e)} />
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkStatusOpen != null} onClose={() => setBulkStatusOpen(null)}>
        <DialogTitle>{bulkStatusOpen === 'ACTIVE' ? 'Mark selected active?' : 'Mark selected inactive?'}</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will update {selectedIds.size} customer(s). Continue?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkStatusOpen(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => bulkStatusOpen && void handleBulkStatus(bulkStatusOpen)}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
