import { ChangeEvent, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import { Party, PartyInput, PartyType } from '../../types/party';
import { partyService } from '../../services/masters/partyService';
import { exportPartyTemplateExcel, mergePartyByMobileOrName, parsePartiesFile } from './partyBulkExcel';

const getPartyTypeLabel = (type: PartyType): string => {
  switch (type) {
    case 'BUYER': return 'Buyer';
    case 'SUPPLIER': return 'Supplier';
    case 'BOTH': return 'Both';
    default: return type;
  }
};

const getPartyTypeColor = (type: PartyType): 'primary' | 'secondary' | 'success' => {
  switch (type) {
    case 'BUYER': return 'primary';
    case 'SUPPLIER': return 'secondary';
    case 'BOTH': return 'success';
    default: return 'primary';
  }
};

const PartyList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkFileName, setBulkFileName] = useState<string | null>(null);
  const [bulkRows, setBulkRows] = useState<PartyInput[] | null>(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkParsingError, setBulkParsingError] = useState<string | null>(null);
  const [bulkResultSummary, setBulkResultSummary] = useState<string | null>(null);
  const [bulkResultErrors, setBulkResultErrors] = useState<string[]>([]);

  const loadParties = async () => {
    try {
      setLoading(true);
      const data = await partyService.list({ search: search || undefined });
      setParties(data);
    } catch (err) {
      setError('Failed to load parties');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (location.pathname === '/parties') {
      loadParties();
    }
  }, [location.pathname]);

  const handleSearch = () => {
    loadParties();
  };

  const closeBulkDialog = () => {
    setBulkDialogOpen(false);
    setBulkFileName(null);
    setBulkRows(null);
    setBulkParsingError(null);
    setBulkResultSummary(null);
    setBulkResultErrors([]);
  };

  const handleBulkFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setBulkParsingError(null);
      setBulkResultSummary(null);
      setBulkResultErrors([]);
      const rows = await parsePartiesFile(file);
      setBulkRows(rows);
      setBulkFileName(file.name);
    } catch (err) {
      setBulkRows(null);
      setBulkFileName(file.name);
      setBulkParsingError((err as Error).message || 'Failed to parse file');
    }
  };

  const handleProcessBulkUpload = async () => {
    if (!bulkRows?.length) return;
    try {
      setBulkUploading(true);
      const existing = await partyService.list();
      let created = 0;
      let updated = 0;
      const errors: string[] = [];

      for (const row of bulkRows) {
        try {
          const match = mergePartyByMobileOrName(existing, row);
          if (match) {
            await partyService.update(match.id, row);
            updated += 1;
          } else {
            const c = await partyService.create(row);
            existing.push(c);
            created += 1;
          }
        } catch (err) {
          errors.push(`${row.name || row.mobile}: ${(err as Error).message}`);
        }
      }

      setBulkResultSummary(`Processed ${bulkRows.length}. Created: ${created}, Updated: ${updated}.`);
      setBulkResultErrors(errors);
      await loadParties();
    } finally {
      setBulkUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const existing = await partyService.list();
      const buffer = await exportPartyTemplateExcel(existing);
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'party-bulk-template.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setBulkParsingError((err as Error).message || 'Failed to download template');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this party?')) return;
    
    try {
      await partyService.delete(id);
      loadParties();
    } catch (err) {
      alert('Failed to delete party');
      console.error(err);
    }
  };

  const filteredParties = search
    ? parties.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.mobile.includes(search) ||
        p.gstin?.toLowerCase().includes(search.toLowerCase())
      )
    : parties;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Party Master
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage buyers and suppliers in one place
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setBulkDialogOpen(true)}
          >
            Upload Excel
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/parties/new')}
          >
            New Party
          </Button>
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={2}>
              <TextField
                placeholder="Search by name, mobile, or GSTIN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                fullWidth
                size="small"
              />
              <Button variant="outlined" onClick={handleSearch}>
                Search
              </Button>
            </Stack>

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            {loading ? (
              <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
              </Box>
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Mobile</TableCell>
                    <TableCell>GSTIN</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Balance</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredParties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" py={2}>
                          No parties found. Click "New Party" to add one.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredParties.map((party) => (
                      <TableRow key={party.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {party.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getPartyTypeLabel(party.partyType)}
                            color={getPartyTypeColor(party.partyType)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{party.mobile}</TableCell>
                        <TableCell>{party.gstin || '-'}</TableCell>
                        <TableCell>{party.state || '-'}</TableCell>
                        <TableCell>
                          ₹{party.currentBalance?.toFixed(2) || '0.00'}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={() => navigate(`/parties/${party.id}`)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(party.id)}
                            color="error"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </Stack>
        </CardContent>
      </Card>
      <Dialog open={bulkDialogOpen} onClose={closeBulkDialog} fullWidth maxWidth="sm">
        <DialogTitle>Bulk Upload Parties</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Upload <strong>.xlsx</strong> or <strong>.json</strong> with party rows. Required columns: name and mobile.
              Optional: partyType, gstin, address, state, pincode, email, whatsapp, openingBalance.
            </Typography>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => void handleDownloadTemplate()}>
                Download Template
              </Button>
              <Button variant="contained" component="label">
                Choose Excel or JSON
                <input
                  type="file"
                  hidden
                  accept=".xlsx,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/json"
                  onChange={handleBulkFileSelected}
                />
              </Button>
              <Typography variant="body2" color={bulkFileName ? 'text.primary' : 'text.secondary'}>
                {bulkFileName ?? 'No file selected'}
              </Typography>
            </Stack>

            {bulkParsingError && (
              <Alert severity="error" onClose={() => setBulkParsingError(null)}>
                {bulkParsingError}
              </Alert>
            )}

            {bulkRows && (
              <Box>
                <Typography variant="subtitle2">Preview ({bulkRows.length} row(s))</Typography>
                <Stack spacing={0.5} mt={1}>
                  {bulkRows.slice(0, 5).map((row, idx) => (
                    <Typography key={`${row.mobile}-${idx}`} variant="body2">
                      • {row.name} ({row.mobile}) {row.partyType ? `• ${row.partyType}` : ''}
                    </Typography>
                  ))}
                </Stack>
                {bulkRows.length > 5 && (
                  <Typography variant="caption" color="text.secondary">
                    + {bulkRows.length - 5} more row(s)
                  </Typography>
                )}
              </Box>
            )}

            {bulkResultSummary && <Alert severity="success">{bulkResultSummary}</Alert>}
            {bulkResultErrors.length > 0 && (
              <Alert severity="warning">
                ⚠️ {bulkResultErrors.length} row(s) failed:
                <Box component="ul" sx={{ pl: 3, mt: 1, mb: 0 }}>
                  {bulkResultErrors.slice(0, 6).map((err, idx) => (
                    <li key={idx}>
                      <Typography variant="body2">{err}</Typography>
                    </li>
                  ))}
                </Box>
                {bulkResultErrors.length > 6 && (
                  <Typography variant="caption" color="text.secondary">
                    + {bulkResultErrors.length - 6} more error(s)
                  </Typography>
                )}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBulkDialog} disabled={bulkUploading}>
            Close
          </Button>
          <Button
            variant="contained"
            onClick={handleProcessBulkUpload}
            disabled={bulkUploading || !bulkRows?.length}
          >
            {bulkUploading ? 'Processing…' : 'Upload & Process'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PartyList;
