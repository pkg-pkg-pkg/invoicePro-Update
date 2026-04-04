import { useCallback, useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
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
  Paper,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import MoneyIcon from '@mui/icons-material/Money';

import { ledgerAccountService } from '../../../services/masters/ledgerAccountService';
import { useMasterList } from '../../../hooks/useMasterList';
import { usePermission } from '../../../hooks/usePermission';
import { LedgerAccount } from '../../../types/masters';

const BankLedgerList = () => {
  const navigate = useNavigate();
  const { can } = usePermission();
  const [search, setSearch] = useState('');

  const fetchAccounts = useCallback(() => ledgerAccountService.list({ isCashBank: true, includeInactive: false }), []);
  const { data: accounts, loading, error, refresh } = useMasterList<LedgerAccount>(fetchAccounts);

  const filteredAccounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((acct) => {
      if (!q) return true;
      const haystack = `${acct.name} ${acct.bankDetails?.accountNumber ?? ''} ${acct.bankDetails?.bankName ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [accounts, search]);

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 2,
      }),
    []
  );

  const canManage = can('manage-ledgers');
  const canView = can('view-ledgers');

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acct) => sum + (acct.currentBalance || 0), 0);
  }, [accounts]);

  if (!canView) {
    return (
      <Card>
        <CardContent>
          <Alert severity="warning">You do not have permission to view bank accounts.</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={4}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h4" fontWeight={900} sx={{ color: 'text.primary', mb: 1 }}>
            Bank & Cash Accounts
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Monitor your liquidity and manage financial accounts
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Tooltip title="Refresh Data">
            <IconButton 
              onClick={refresh} 
              sx={{ bgcolor: 'white', border: '1px solid #e2e8f0', p: 1.5 }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canManage && (
            <Button 
              variant="contained" 
              size="large"
              startIcon={<AddIcon />}
              onClick={() => navigate('/masters/ledger-accounts/new', { state: { isCashBank: true } })}
              sx={{ px: 4, py: 1.5, borderRadius: 3, boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)' }}
            >
              Add New Account
            </Button>
          )}
        </Stack>
      </Stack>

      {/* Summary Cards with Gradients */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <CardContent sx={{ p: 4 }}>
              <Typography sx={{ opacity: 0.8, fontWeight: 600, mb: 1 }}>
                Total Available Balance
              </Typography>
              <Typography variant="h3" fontWeight={900}>
                {currencyFormatter.format(totalBalance)}
              </Typography>
              <AccountBalanceIcon sx={{ 
                position: 'absolute', 
                right: -20, 
                bottom: -20, 
                fontSize: 180, 
                opacity: 0.1 
              }} />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card sx={{ 
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <CardContent sx={{ p: 4 }}>
              <Typography sx={{ opacity: 0.8, fontWeight: 600, mb: 1 }}>
                Active Accounts
              </Typography>
              <Typography variant="h3" fontWeight={900}>
                {accounts.length}
              </Typography>
              <MoneyIcon sx={{ 
                position: 'absolute', 
                right: -20, 
                bottom: -20, 
                fontSize: 180, 
                opacity: 0.1 
              }} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ p: 0, overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
        <Box sx={{ p: 3, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
          <TextField
            placeholder="Search by name, account number or bank..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            InputProps={{
              sx: { bgcolor: 'white', borderRadius: 2 }
            }}
          />
        </Box>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 800, py: 2 }}>Account Name</TableCell>
                <TableCell sx={{ fontWeight: 800, py: 2 }}>Type & Institution</TableCell>
                <TableCell sx={{ fontWeight: 800, py: 2 }}>A/c Details</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800, py: 2 }}>Current Balance</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, py: 2 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                    <CircularProgress size={40} />
                  </TableCell>
                </TableRow>
              ) : filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 10 }}>
                    <Typography variant="h6" color="text.secondary">
                      No accounts found matching your search.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.map((account) => (
                  <TableRow key={account.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                    <TableCell>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Avatar sx={{ 
                          bgcolor: account.bankDetails?.accountType === 'CASH' ? 'success.light' : 'primary.light',
                          color: account.bankDetails?.accountType === 'CASH' ? 'success.main' : 'primary.main'
                        }}>
                          {account.bankDetails?.accountType === 'CASH' ? <MoneyIcon /> : <AccountBalanceIcon />}
                        </Avatar>
                        <Box>
                          <Typography variant="body1" fontWeight={700}>
                            {account.name}
                          </Typography>
                          <Typography variant="caption" sx={{ bgcolor: '#f1f5f9', px: 1, borderRadius: 1, fontWeight: 600 }}>
                            {account.code || 'NO-CODE'}
                          </Typography>
                        </Box>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {account.bankDetails?.bankName || (account.bankDetails?.accountType === 'CASH' ? 'Liquid Cash' : '—')}
                      </Typography>
                      <Chip 
                        size="small" 
                        label={account.bankDetails?.accountType || 'CURRENT'} 
                        sx={{ 
                          fontWeight: 700, 
                          borderRadius: 1,
                          bgcolor: account.bankDetails?.accountType === 'CASH' ? 'success.lighter' : 'primary.lighter'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {account.bankDetails?.accountNumber ? `•••• ${account.bankDetails.accountNumber.slice(-4)}` : '—'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {account.bankDetails?.ifscCode || ''}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        variant="h6" 
                        fontWeight={900}
                        color={account.currentBalance >= 0 ? 'success.main' : 'error.main'}
                      >
                        {currencyFormatter.format(account.currentBalance)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Edit Details">
                        <IconButton
                          onClick={() => navigate(`/masters/ledger-accounts/${account.id}/edit`)}
                          disabled={!canManage}
                          sx={{ border: '1px solid #e2e8f0', '&:hover': { bgcolor: 'primary.light', color: 'primary.main' } }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
};

// Placeholder for TableContainer if not imported
const TableContainer = ({ children, sx }: any) => <Box sx={{ overflowX: 'auto', ...sx }}>{children}</Box>;

export default BankLedgerList;
