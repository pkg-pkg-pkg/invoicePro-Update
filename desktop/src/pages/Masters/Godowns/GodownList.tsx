import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RestoreIcon from '@mui/icons-material/Restore';

import { godownService } from '../../../services/masters/godownService';
import { useMasterList } from '../../../hooks/useMasterList';
import { Godown } from '../../../types/masters';
import { usePermission } from '../../../hooks/usePermission';

type StatusFilter = 'ACTIVE' | 'INACTIVE' | 'ALL';

const GodownList = () => {
  const navigate = useNavigate();
  const { can } = usePermission();

  const fetchGodowns = useCallback(() => godownService.list({ includeInactive: true }), []);
  const { data: godowns, loading, error, refresh } = useMasterList<Godown>(fetchGodowns);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const canView = can('view-inventory');
  const canManage = can('manage-inventory');

  const filteredGodowns = useMemo(() => {
    const query = search.trim().toLowerCase();
    return godowns.filter((godown) => {
      if (statusFilter === 'ACTIVE' && godown.isActive === false) return false;
      if (statusFilter === 'INACTIVE' && godown.isActive !== false) return false;
      if (!query) return true;
      const haystack = `${godown.name} ${godown.code ?? ''} ${godown.address ?? ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [godowns, search, statusFilter]);

  const handleRefresh = async () => {
    setActionMessage(null);
    setActionError(null);
    await refresh();
  };

  const handleSoftDelete = async (id: string) => {
    try {
      await godownService.softDelete(id);
      setActionMessage('Godown deactivated');
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionMessage(null);
      setActionError((err as Error).message ?? 'Failed to deactivate godown');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await godownService.restore(id);
      setActionMessage('Godown reactivated');
      setActionError(null);
      await refresh();
    } catch (err) {
      setActionMessage(null);
      setActionError((err as Error).message ?? 'Failed to restore godown');
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">You do not have permission to view godowns.</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h5" fontWeight={600}>
            Godowns
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage stock locations and default godown mapping
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Button variant="contained" onClick={() => navigate('/masters/godowns/new')}>
              New Godown
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="Search"
              placeholder="Search by name, code, or address"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel id="godown-status-filter-label">Status</InputLabel>
              <Select
                labelId="godown-status-filter-label"
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              >
                <MenuItem value="ACTIVE">Active only</MenuItem>
                <MenuItem value="INACTIVE">Inactive only</MenuItem>
                <MenuItem value="ALL">
                  <em>All</em>
                </MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </CardContent>
      </Card>

      {actionMessage && <Alert severity="success">{actionMessage}</Alert>}
      {actionError && <Alert severity="error">{actionError}</Alert>}
      {error && <Alert severity="error">{error.message}</Alert>}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={6}>
              <CircularProgress size={32} />
            </Box>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell align="center">Default</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredGodowns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No godowns found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGodowns.map((godown) => (
                    <TableRow key={godown.id} hover>
                      <TableCell>{godown.name}</TableCell>
                      <TableCell>{godown.code || '—'}</TableCell>
                      <TableCell>{godown.address || '—'}</TableCell>
                      <TableCell align="center">
                        {godown.isDefault ? <Chip size="small" color="success" label="Default" /> : '—'}
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={godown.isActive === false ? 'Inactive' : 'Active'}
                          color={godown.isActive === false ? 'default' : 'primary'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="Edit">
                            <span>
                              <IconButton
                                size="small"
                                onClick={() => navigate(`/masters/godowns/${godown.id}/edit`)}
                                disabled={!canManage}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          {godown.isActive === false ? (
                            <Tooltip title="Restore">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleRestore(godown.id)}
                                  disabled={!canManage}
                                >
                                  <RestoreIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          ) : (
                            <Tooltip title="Deactivate">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleSoftDelete(godown.id)}
                                  disabled={!canManage || godown.isDefault}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
};

export default GodownList;
