import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
} from '@mui/material';
import type { InventoryItem, LedgerAccount } from '../../types/masters';
import type { Voucher } from '../../types/vouchers';
import { voucherService } from '../../services/vouchers/voucherService';
import { inventoryItemService } from '../../services/masters/inventoryItemService';
import { ledgerAccountService } from '../../services/masters/ledgerAccountService';
import { buildPreGstTradingProfit } from '../../services/reports/preGstProfitService';
import { formatCurrency } from '../../utils/formatters';

interface PreGstProfitReportsProps {
  canExport: boolean;
}

export default function PreGstProfitReports({ canExport: _canExport }: PreGstProfitReportsProps) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [ledgers, setLedgers] = useState<LedgerAccount[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [vList, iList, lList] = await Promise.all([
        voucherService.list(),
        inventoryItemService.list({ includeInactive: true }),
        ledgerAccountService.list({ includeInactive: true }),
      ]);
      setVouchers(vList);
      setItems(iList);
      setLedgers(lList);
    } catch (e) {
      setError((e as Error).message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const ledgerName = useMemo(() => {
    const m = new Map(ledgers.map((l) => [l.id, l.name]));
    return (id: string) => m.get(id) ?? id;
  }, [ledgers]);

  const { byItem, byBill, byCustomer } = useMemo(
    () => buildPreGstTradingProfit(vouchers, items),
    [vouchers, items]
  );

  const totals = useMemo(() => {
    const rev = byItem.reduce((s, r) => s + r.revenueExGst, 0);
    const cost = byItem.reduce((s, r) => s + r.costAtMasterPurchaseExGst, 0);
    return {
      revenueExGst: Number(rev.toFixed(2)),
      costExGst: Number(cost.toFixed(2)),
      profitExGst: Number((rev - cost).toFixed(2)),
    };
  }, [byItem]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" onClose={() => setError(null)}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom fontWeight={600}>
        Trading profit (pre-GST)
      </Typography>
      <Alert severity="info" sx={{ mb: 2 }}>
        Revenue is taken only from <strong>sales item lines</strong> posted as <strong>taxable value excluding GST</strong>.
        Cost uses <strong>current master purchase rate × quantity</strong> (not FIFO from purchase bills). Sales or
        purchase returns without matching item lines are not fully reflected here.
      </Alert>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="body2">
          Sales (ex-GST): <strong>{formatCurrency(totals.revenueExGst)}</strong>
        </Typography>
        <Typography variant="body2">
          Cost @ master purchase (ex-GST): <strong>{formatCurrency(totals.costExGst)}</strong>
        </Typography>
        <Typography variant="body2">
          Gross (ex-GST): <strong>{formatCurrency(totals.profitExGst)}</strong>
        </Typography>
      </Paper>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Item wise" />
        <Tab label="Bill wise" />
        <Tab label="Customer wise" />
      </Tabs>

      {tab === 0 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell align="right">Qty out</TableCell>
                <TableCell align="right">Revenue (ex-GST)</TableCell>
                <TableCell align="right">Cost @ master (ex-GST)</TableCell>
                <TableCell align="right">Profit (ex-GST)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {byItem.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">
                      No qualifying sales lines found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                byItem.map((r) => (
                  <TableRow key={r.itemId}>
                    <TableCell>{r.itemName}</TableCell>
                    <TableCell align="right">{r.qtyOut}</TableCell>
                    <TableCell align="right">{formatCurrency(r.revenueExGst)}</TableCell>
                    <TableCell align="right">{formatCurrency(r.costAtMasterPurchaseExGst)}</TableCell>
                    <TableCell align="right">{formatCurrency(r.profitExGst)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 1 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Bill #</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Revenue (ex-GST)</TableCell>
                <TableCell align="right">Cost @ master (ex-GST)</TableCell>
                <TableCell align="right">Profit (ex-GST)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {byBill.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary">
                      No bills with qualifying lines.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                byBill.map((r) => (
                  <TableRow key={r.voucherId}>
                    <TableCell>{r.number}</TableCell>
                    <TableCell>{r.date?.slice(0, 10)}</TableCell>
                    <TableCell>{ledgerName(r.customerLedgerId)}</TableCell>
                    <TableCell align="right">{formatCurrency(r.revenueExGst)}</TableCell>
                    <TableCell align="right">{formatCurrency(r.costAtMasterPurchaseExGst)}</TableCell>
                    <TableCell align="right">{formatCurrency(r.profitExGst)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {tab === 2 && (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Customer</TableCell>
                <TableCell align="right">Revenue (ex-GST)</TableCell>
                <TableCell align="right">Cost @ master (ex-GST)</TableCell>
                <TableCell align="right">Profit (ex-GST)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {byCustomer.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary">
                      No customer-level data.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                byCustomer.map((r) => (
                  <TableRow key={r.customerLedgerId}>
                    <TableCell>{ledgerName(r.customerLedgerId)}</TableCell>
                    <TableCell align="right">{formatCurrency(r.revenueExGst)}</TableCell>
                    <TableCell align="right">{formatCurrency(r.costAtMasterPurchaseExGst)}</TableCell>
                    <TableCell align="right">{formatCurrency(r.profitExGst)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
