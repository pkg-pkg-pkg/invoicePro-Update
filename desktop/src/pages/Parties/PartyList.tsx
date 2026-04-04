import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import { Party, PartyType } from '../../types/party';
import { partyService } from '../../services/masters/partyService';

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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/parties/new')}
        >
          New Party
        </Button>
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
    </Box>
  );
};

export default PartyList;
