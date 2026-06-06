import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box } from '@mui/material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { salesNavForKind, salesKindFromParam } from '../../config/salesModuleNav';
import { salesDocumentService } from '../../services/sales/salesDocumentService';
import { customersApi, type PartyFilterOption } from '../../services/customers/customersApi';
import type { SalesDocumentFilters, SalesDocumentRow } from '../../types/salesDocuments';
import { SalesToolbar } from '../../components/sales/SalesToolbar';
import { SalesDataTable } from '../../components/sales/SalesDataTable';
import { currentCalendarMonthRange, isDateWithinInclusive } from '../../utils/dateRange';
import { usePermission } from '../../hooks/usePermission';
import { PARTIES_CHANGED_EVENT } from '../../services/masters/partyService';

function defaultFilters(): SalesDocumentFilters {
  const { from, to } = currentCalendarMonthRange();
  return { search: '', fromDate: from, toDate: to, customerId: '', status: 'ALL' };
}

export default function SalesDocumentPage() {
  const { docKind } = useParams<{ docKind: string }>();
  const location = useLocation();
  const kind = salesKindFromParam(docKind);
  const navigate = useNavigate();
  const { can } = usePermission();
  const nav = kind ? salesNavForKind(kind) : null;

  const [filters, setFilters] = useState<SalesDocumentFilters>(defaultFilters);
  const [rows, setRows] = useState<SalesDocumentRow[]>([]);
  const [customers, setCustomers] = useState<PartyFilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await customersApi.listCustomerFilterOptions();
      setCustomers(data);
    } catch {
      setCustomers([]);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    const onPartiesChanged = () => void loadCustomers();
    window.addEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
    return () => window.removeEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
  }, [loadCustomers]);

  const load = useCallback(async () => {
    if (!kind) return;
    setLoading(true);
    setError(null);
    try {
      const data = await salesDocumentService.listByKind(kind);
      setRows(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load, location.pathname, location.key]);

  useEffect(() => {
    const onVouchersChanged = () => void load();
    const onFocus = () => void load();
    window.addEventListener('pve:vouchers-changed', onVouchersChanged);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('pve:vouchers-changed', onVouchersChanged);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!isDateWithinInclusive(row.date, filters.fromDate, filters.toDate)) return false;
      if (filters.customerId && row.customerId !== filters.customerId) return false;
      if (filters.status !== 'ALL' && row.status !== filters.status) return false;
      if (q) {
        const hay = `${row.number} ${row.customerName} ${row.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const handleCreate = () => {
    if (!nav) return;
    if (nav.createPath) {
      navigate(nav.createPath);
      return;
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!ids.length) return;
    await salesDocumentService.bulkDeletePipeline(ids);
    await load();
  };

  if (!kind || !nav) {
    return (
      <Alert severity="warning">Unknown sales document type.</Alert>
    );
  }

  const canCreate =
    nav.supportsPipeline || (kind === 'tax-invoices' && can('create-vouchers')) || kind === 'collections' || kind === 'credit-adjustments';

  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {error ? <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert> : null}

      <SalesToolbar
        title={nav.label}
        subtitle={nav.description}
        filters={filters}
        onFiltersChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
        customers={customers}
        createLabel={nav.createLabel}
        onCreate={handleCreate}
        canCreate={canCreate}
      />

      <SalesDataTable
        kind={kind}
        title={nav.label}
        rows={filteredRows}
        loading={loading}
        onRefresh={() => void load()}
        onBulkDelete={(ids) => void handleBulkDelete(ids)}
        allowPipelineDelete={nav.supportsPipeline}
      />
    </Box>
  );
}
