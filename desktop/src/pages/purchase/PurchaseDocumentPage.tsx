import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import { purchaseNavForKind, purchaseKindFromParam } from '../../config/purchaseModuleNav';
import { purchaseDocumentService } from '../../services/purchase/purchaseDocumentService';
import type { PurchaseDocumentFilters, PurchaseDocumentRow } from '../../types/purchaseDocuments';
import type { SalesDocumentRow } from '../../types/salesDocuments';
import { SalesToolbar } from '../../components/sales/SalesToolbar';
import { SalesDataTable } from '../../components/sales/SalesDataTable';
import { currentCalendarMonthRange, isDateWithinInclusive } from '../../utils/dateRange';
import { customersApi, type PartyFilterOption } from '../../services/customers/customersApi';
import { PARTIES_CHANGED_EVENT } from '../../services/masters/partyService';

function defaultFilters(): PurchaseDocumentFilters {
  const { from, to } = currentCalendarMonthRange();
  return { search: '', fromDate: from, toDate: to, vendorId: '', status: 'ALL' };
}

function toTableRow(row: PurchaseDocumentRow): SalesDocumentRow {
  return {
    id: row.id,
    kind: 'tax-invoices',
    number: row.number,
    date: row.date,
    customerId: row.vendorId,
    customerName: row.vendorName,
    amount: row.amount,
    gstAmount: row.gstAmount,
    balanceDue: row.balanceDue,
    status: row.status,
    dueDate: row.dueDate,
    source: row.source === 'pipeline' ? 'pipeline' : row.source === 'expense' ? 'expense' : 'voucher',
    editPath: row.editPath,
  };
}

export default function PurchaseDocumentPage() {
  const { docKind } = useParams<{ docKind: string }>();
  const kind = purchaseKindFromParam(docKind);
  const navigate = useNavigate();
  const nav = kind ? purchaseNavForKind(kind) : null;

  const [filters, setFilters] = useState<PurchaseDocumentFilters>(defaultFilters);
  const [rows, setRows] = useState<PurchaseDocumentRow[]>([]);
  const [vendors, setVendors] = useState<PartyFilterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVendors = useCallback(async () => {
    try {
      const data = await customersApi.listSupplierFilterOptions();
      setVendors(data);
    } catch {
      setVendors([]);
    }
  }, []);

  useEffect(() => {
    void loadVendors();
  }, [loadVendors]);

  useEffect(() => {
    const onPartiesChanged = () => void loadVendors();
    window.addEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
    return () => window.removeEventListener(PARTIES_CHANGED_EVENT, onPartiesChanged);
  }, [loadVendors]);

  const load = useCallback(async () => {
    if (!kind) return;
    setLoading(true);
    setError(null);
    try {
      const data = await purchaseDocumentService.listByKind(kind);
      setRows(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!isDateWithinInclusive(row.date, filters.fromDate, filters.toDate)) return false;
      if (filters.vendorId && row.vendorId !== filters.vendorId) return false;
      if (filters.status !== 'ALL' && row.status !== filters.status) return false;
      if (q) {
        const hay = `${row.number} ${row.vendorName} ${row.status}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filters]);

  const handleCreate = () => {
    if (!nav || !kind) return;
    if (nav.createPath) {
      navigate(nav.createPath);
      return;
    }
    if (nav.supportsPipeline) {
      navigate(`/purchase/${kind}/new`);
    }
  };

  if (!kind || !nav) {
    return <Alert severity="warning">Unknown purchase document type.</Alert>;
  }

  const canCreate = nav.supportsPipeline || Boolean(nav.createPath);

  const handleBulkDelete = async (ids: string[]) => {
    if (!ids.length) return;
    await purchaseDocumentService.bulkDeletePipeline(ids);
    await load();
  };

  const salesFilters = {
    search: filters.search,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
    customerId: filters.vendorId,
    status: filters.status,
  };

  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {error ? <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError(null)}>{error}</Alert> : null}

      <SalesToolbar
        moduleName="Purchase"
        title={nav.label}
        subtitle={nav.description}
        filters={salesFilters}
        onFiltersChange={(patch) =>
          setFilters((prev) => ({
            ...prev,
            search: patch.search ?? prev.search,
            fromDate: patch.fromDate ?? prev.fromDate,
            toDate: patch.toDate ?? prev.toDate,
            vendorId: patch.customerId ?? prev.vendorId,
            status: patch.status ?? prev.status,
          }))
        }
        customers={vendors}
        partyFilterLabel="Vendor"
        createLabel={nav.createLabel}
        onCreate={handleCreate}
        canCreate={canCreate}
      />

      <SalesDataTable
        kind={`purchase-${kind}`}
        title={nav.label}
        rows={filteredRows.map(toTableRow)}
        loading={loading}
        onRefresh={() => void load()}
        partyColumnLabel="Vendor"
        onBulkDelete={(ids) => void handleBulkDelete(ids)}
        allowPipelineDelete={nav.supportsPipeline}
      />
    </Box>
  );
}
