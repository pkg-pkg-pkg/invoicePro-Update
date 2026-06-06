import { useEffect, useMemo, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Link,
  Menu,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import CloseIcon from '@mui/icons-material/Close';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import type { Party } from '../../types/party';
import {
  customersApi,
  type CustomerComment,
  type CustomerDocRow,
  type CustomerInvoiceRow,
  type CustomerMailRow,
  type CustomerPaymentRow,
  type CustomerStatementRow,
  type CustomerTransactionsBundle,
} from '../../services/customers/customersApi';
import { partyService } from '../../services/masters/partyService';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { getCustomersModuleTokens } from '../../theme/customersModuleTheme';
import { SalesStatusBadge, SALES_STATUS_FILTER_OPTIONS } from '../sales/SalesStatusBadge';
import type { SalesDocumentStatus } from '../../types/salesDocuments';

type Props = {
  customer: Party | null;
  loading?: boolean;
  transactions: CustomerTransactionsBundle | null;
  comments: CustomerComment[];
  mails: CustomerMailRow[];
  statementRows: CustomerStatementRow[];
  statementLoading?: boolean;
  onEdit: () => void;
  onClose: () => void;
  onDelete: () => void;
  onAddComment: (text: string) => void;
  onGenerateStatement: (from: string, to: string) => void;
};

function FieldRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  const tok = getCustomersModuleTokens(theme);
  return (
    <>
      <Grid item xs={12} sm={5}>
        <Typography variant="body2" color={tok.textMuted} fontWeight={600}>
          {label}
        </Typography>
      </Grid>
      <Grid item xs={12} sm={7}>
        <Typography variant="body2" fontWeight={600} color={tok.text}>
          {value || '—'}
        </Typography>
      </Grid>
    </>
  );
}

function DocTable({ rows, columns }: { rows: CustomerDocRow[]; columns: string[] }) {
  const theme = useTheme();
  const tok = getCustomersModuleTokens(theme);
  if (rows.length === 0) {
    return (
      <Box sx={{ py: 3, textAlign: 'center', color: tok.textMuted }}>
        <Typography variant="body2">No records yet</Typography>
      </Box>
    );
  }
  return (
    <Table size="small">
      <TableHead>
        <TableRow sx={{ bgcolor: tok.surfaceMuted }}>
          {columns.map((c) => (
            <TableCell key={c} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
              {c}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id} hover>
            <TableCell>{formatDate(r.date)}</TableCell>
            <TableCell>{r.number}</TableCell>
            <TableCell align="right">{formatCurrency(r.amount)}</TableCell>
            <TableCell>
              <SalesStatusBadge status={r.status} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function CustomerDetailPanel({
  customer,
  loading,
  transactions,
  comments,
  mails,
  statementRows,
  statementLoading,
  onEdit,
  onClose,
  onDelete,
  onAddComment,
  onGenerateStatement,
}: Props) {
  const theme = useTheme();
  const tok = getCustomersModuleTokens(theme);
  const navigate = useNavigate();
  const [tab, setTab] = useState(2);
  const [moreAnchor, setMoreAnchor] = useState<null | HTMLElement>(null);
  const [txnAnchor, setTxnAnchor] = useState<null | HTMLElement>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<SalesDocumentStatus | 'ALL'>('ALL');
  const [commentDraft, setCommentDraft] = useState('');
  const [stmtFrom, setStmtFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [stmtTo, setStmtTo] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    setTab(2);
    setInvoiceStatus('ALL');
  }, [customer?.id]);

  const filteredInvoices = useMemo(() => {
    const rows = transactions?.invoices ?? [];
    if (invoiceStatus === 'ALL') return rows;
    return rows.filter((r) => r.status === invoiceStatus);
  }, [transactions?.invoices, invoiceStatus]);

  const overviewFields = useMemo(() => {
    if (!customer) return [];
    const addr = [customer.address, customer.city, customer.state, customer.pincode].filter(Boolean).join(', ');
    return [
      { label: 'Customer Name', value: customer.name },
      { label: 'Customer Type', value: 'Business' },
      { label: 'Company Name', value: customer.name },
      { label: 'GSTIN', value: customer.gstin ?? '—' },
      { label: 'PAN Number', value: '—' },
      { label: 'Phone / Mobile', value: customer.mobile },
      { label: 'Email', value: customer.email ?? '—' },
      { label: 'Billing Address', value: addr || '—' },
      { label: 'Shipping Address', value: addr || '—' },
      { label: 'Currency', value: 'INR (₹)' },
      { label: 'Payment Terms', value: 'Due on Receipt' },
      { label: 'Credit Limit', value: '—' },
    ];
  }, [customer]);

  if (!customer) {
    return (
      <Box
        sx={{
          flex: 1,
          border: `1px solid ${tok.border}`,
          borderRadius: `${tok.radius}px`,
          bgcolor: tok.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 400,
          color: tok.textMuted,
        }}
      >
        <Typography>Select a customer from the list to view details</Typography>
      </Box>
    );
  }

  const openNewInvoice = () => navigate('/vouchers/sales/new');
  const openNewReceipt = () => navigate('/vouchers/receipt-vouchers/new');

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        border: `1px solid ${tok.border}`,
        borderRadius: `${tok.radius}px`,
        bgcolor: tok.surface,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 400,
        height: { lg: 'calc(100vh - 220px)' },
        overflow: 'hidden',
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${tok.border}` }}
      >
        <Typography variant="h5" fontWeight={800} color={tok.text}>
          {customer.name}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <IconButton size="small" onClick={onEdit} title="Edit">
            <EditOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" title="Attachments">
            <AttachFileOutlinedIcon fontSize="small" />
          </IconButton>
          <Button
            size="small"
            variant="contained"
            endIcon={<ArrowDropDownIcon />}
            onClick={(e) => setTxnAnchor(e.currentTarget)}
          >
            New Transaction
          </Button>
          <Menu anchorEl={txnAnchor} open={Boolean(txnAnchor)} onClose={() => setTxnAnchor(null)}>
            <MenuItem onClick={() => { openNewInvoice(); setTxnAnchor(null); }}>Sales Invoice</MenuItem>
            <MenuItem onClick={() => { openNewReceipt(); setTxnAnchor(null); }}>Customer Payment</MenuItem>
            <MenuItem onClick={() => { navigate('/sales/quotations'); setTxnAnchor(null); }}>Quotation</MenuItem>
            <MenuItem onClick={() => { navigate('/sales/sales-orders'); setTxnAnchor(null); }}>Sales Order</MenuItem>
          </Menu>
          <Button size="small" variant="outlined" endIcon={<MoreHorizIcon />} onClick={(e) => setMoreAnchor(e.currentTarget)}>
            More
          </Button>
          <IconButton size="small" onClick={onClose} title="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
          <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
            <MenuItem
              onClick={() => {
                void (async () => {
                  const ledgerId =
                    customer.ledgerId ??
                    (await partyService.ensureLedgerForParty(customer.id)) ??
                    '';
                  if (ledgerId) navigate(`/parties/party-ledger/${ledgerId}`);
                  setMoreAnchor(null);
                })();
              }}
            >
              View ledger
            </MenuItem>
            <MenuItem onClick={() => { onDelete(); setMoreAnchor(null); }}>Delete customer</MenuItem>
          </Menu>
        </Stack>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          px: 2,
          borderBottom: `1px solid ${tok.border}`,
          minHeight: 44,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 600, minHeight: 44 },
          '& .Mui-selected': { color: tok.accent },
          '& .MuiTabs-indicator': { bgcolor: tok.accent, height: 3 },
        }}
      >
        <Tab label="Overview" />
        <Tab label="Comments" />
        <Tab label="Transactions" />
        <Tab label="Mails" />
        <Tab label="Statement" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto', p: 2.5 }}>
        {loading ? (
          <Stack alignItems="center" py={6}>
            <CircularProgress size={32} />
          </Stack>
        ) : null}

        {!loading && tab === 0 ? (
          <Grid container spacing={1.5}>
            {overviewFields.map((f) => (
              <FieldRow key={f.label} label={f.label} value={f.value} />
            ))}
          </Grid>
        ) : null}

        {!loading && tab === 1 ? (
          <Stack spacing={2}>
            <TextField
              multiline
              minRows={3}
              placeholder="Add an internal comment…"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
            />
            <Button
              variant="contained"
              disabled={!commentDraft.trim()}
              onClick={() => {
                onAddComment(commentDraft);
                setCommentDraft('');
              }}
            >
              Add Comment
            </Button>
            <Stack spacing={1.5}>
              {comments.map((c) => (
                <Box key={c.id} sx={{ p: 1.5, borderRadius: 1, bgcolor: tok.surfaceMuted, border: `1px solid ${tok.border}` }}>
                  <Typography variant="body2">{c.text}</Typography>
                  <Typography variant="caption" color={tok.textMuted}>
                    {c.userName} · {formatDate(c.createdAt.slice(0, 10))}
                  </Typography>
                </Box>
              ))}
              {comments.length === 0 ? (
                <Typography variant="body2" color={tok.textMuted}>
                  No comments yet
                </Typography>
              ) : null}
            </Stack>
          </Stack>
        ) : null}

        {!loading && tab === 2 && transactions ? (
          <Stack spacing={1}>
            {customer ? (
              <Box
                sx={{
                  px: 2,
                  py: 1.25,
                  mb: 0.5,
                  borderRadius: 1,
                  bgcolor: tok.surfaceMuted,
                  border: `1px solid ${tok.border}`,
                }}
              >
                <Typography variant="body2" color={tok.textMuted}>
                  Outstanding balance
                </Typography>
                <Typography variant="h6" fontWeight={800} sx={{ color: customersApi.customerBalance(customer) > 0 ? '#B91C1C' : '#15803D' }}>
                  {formatCurrency(customersApi.customerBalance(customer))}
                </Typography>
              </Box>
            ) : null}
            <Accordion defaultExpanded disableGutters elevation={0} sx={{ border: `1px solid ${tok.border}`, borderRadius: 1, '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', pr: 1 }}>
                  <Typography fontWeight={700}>Invoices</Typography>
                  <Stack direction="row" spacing={1} onClick={(e) => e.stopPropagation()}>
                    <FormControl size="small" sx={{ minWidth: 140 }}>
                      <InputLabel>Status</InputLabel>
                      <Select label="Status" value={invoiceStatus} onChange={(e) => setInvoiceStatus(e.target.value as SalesDocumentStatus | 'ALL')}>
                        {SALES_STATUS_FILTER_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={openNewInvoice}>
                      Add New
                    </Button>
                  </Stack>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                {filteredInvoices.length === 0 ? (
                  <Box sx={{ py: 3, textAlign: 'center', color: tok.textMuted }}>
                    <Typography variant="body2">No invoices for this customer</Typography>
                  </Box>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: tok.surfaceMuted }}>
                        {['Date', 'Invoice No.', 'Order No.', 'Amount', 'Balance Due', 'Status'].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredInvoices.map((row: CustomerInvoiceRow) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{formatDate(row.date)}</TableCell>
                          <TableCell>
                            <Link component="button" underline="hover" sx={{ fontWeight: 700 }} onClick={() => navigate(row.editPath)}>
                              {row.number}
                            </Link>
                          </TableCell>
                          <TableCell>{row.orderNumber}</TableCell>
                          <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.balanceDue)}</TableCell>
                          <TableCell>
                            <SalesStatusBadge status={row.status} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AccordionDetails>
            </Accordion>

            <Accordion defaultExpanded disableGutters elevation={0} sx={{ border: `1px solid ${tok.border}`, borderRadius: 1, '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ width: '100%', pr: 1 }}>
                  <Typography fontWeight={700}>Customer Payments</Typography>
                  <Button size="small" startIcon={<AddIcon />} variant="outlined" onClick={(e) => { e.stopPropagation(); openNewReceipt(); }}>
                    Add New
                  </Button>
                </Stack>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0 }}>
                {(transactions.payments ?? []).length === 0 ? (
                  <Box sx={{ py: 3, textAlign: 'center', color: tok.textMuted }}>
                    <Typography variant="body2">No payments recorded</Typography>
                  </Box>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: tok.surfaceMuted }}>
                        {['Date', 'Payment No.', 'Invoice No.', 'Amount', 'Mode', 'Reference'].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                            {h}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {transactions.payments.map((row: CustomerPaymentRow) => (
                        <TableRow key={row.id} hover>
                          <TableCell>{formatDate(row.date)}</TableCell>
                          <TableCell>
                            <Link component="button" underline="hover" onClick={() => navigate(row.editPath)}>
                              {row.number}
                            </Link>
                          </TableCell>
                          <TableCell>{row.invoiceNumber}</TableCell>
                          <TableCell align="right">{formatCurrency(row.amount)}</TableCell>
                          <TableCell>{row.mode}</TableCell>
                          <TableCell>{row.reference}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </AccordionDetails>
            </Accordion>

            {[
              { title: 'Credit Notes', rows: transactions.creditNotes },
              { title: 'Sales Orders', rows: transactions.salesOrders },
              { title: 'Delivery Challans', rows: transactions.deliveryChallans },
              { title: 'Retainer Invoices', rows: transactions.retainerInvoices },
              { title: 'Expenses', rows: transactions.expenses },
            ].map(({ title, rows }) => (
              <Accordion key={title} disableGutters elevation={0} sx={{ border: `1px solid ${tok.border}`, borderRadius: 1, '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography fontWeight={700}>{title}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 0 }}>
                  <DocTable rows={rows} columns={['Date', 'Number', 'Amount', 'Status']} />
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        ) : null}

        {!loading && tab === 3 ? (
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle1" fontWeight={700}>
                Emails
              </Typography>
              <Button variant="contained" size="small" disabled>
                Send Mail
              </Button>
            </Stack>
            {mails.length === 0 ? (
              <Typography variant="body2" color={tok.textMuted}>
                No emails sent to this customer yet
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Subject</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mails.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{formatDate(m.date)}</TableCell>
                      <TableCell>{m.subject}</TableCell>
                      <TableCell>{m.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Stack>
        ) : null}

        {!loading && tab === 4 ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <TextField type="date" size="small" label="From" InputLabelProps={{ shrink: true }} value={stmtFrom} onChange={(e) => setStmtFrom(e.target.value)} />
              <TextField type="date" size="small" label="To" InputLabelProps={{ shrink: true }} value={stmtTo} onChange={(e) => setStmtTo(e.target.value)} />
              <Button variant="contained" onClick={() => onGenerateStatement(stmtFrom, stmtTo)} disabled={statementLoading}>
                Generate Statement
              </Button>
            </Stack>
            {statementLoading ? (
              <CircularProgress size={24} />
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: tok.surfaceMuted }}>
                    {['Date', 'Particulars', 'Debit', 'Credit', 'Balance'].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>
                        {h}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {statementRows.map((r, idx) => (
                    <TableRow key={`${r.date}-${idx}`}>
                      <TableCell>{formatDate(r.date)}</TableCell>
                      <TableCell>{r.particulars}</TableCell>
                      <TableCell align="right">{r.debit ? formatCurrency(r.debit) : '—'}</TableCell>
                      <TableCell align="right">{r.credit ? formatCurrency(r.credit) : '—'}</TableCell>
                      <TableCell align="right">{formatCurrency(r.balance)}</TableCell>
                    </TableRow>
                  ))}
                  {statementRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ color: tok.textMuted }}>
                        Generate a statement for the selected date range
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            )}
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
