// src/pages/Accounts.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Tabs,
  Tab,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  AccountBalance as AccountBalanceIcon,
  Money as MoneyIcon,
  SwapHoriz as SwapHorizIcon,
} from '@mui/icons-material';

interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  balance: number;
  type: 'savings' | 'current' | 'cash';
}

interface CashTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description: string;
  date: string;
  type: 'deposit' | 'withdrawal' | 'transfer';
}

export default function Accounts() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(0);
  const [accounts, setAccounts] = useState<BankAccount[]>([
    {
      id: '1',
      name: 'Main Cash Account',
      accountNumber: 'CASH-001',
      bankName: 'Cash',
      ifscCode: 'N/A',
      balance: 50000,
      type: 'cash',
    },
    {
      id: '2',
      name: 'HDFC Savings',
      accountNumber: '501001234567',
      bankName: 'HDFC Bank',
      ifscCode: 'HDFC0001234',
      balance: 150000,
      type: 'savings',
    },
  ]);

  const [transfers, setTransfers] = useState<CashTransfer[]>([]);
  const [openTransferDialog, setOpenTransferDialog] = useState(false);
  const [transferForm, setTransferForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    amount: '',
    description: '',
    type: 'transfer' as 'deposit' | 'withdrawal' | 'transfer',
  });

  const getAccountTypeIcon = (type: string) => {
    switch (type) {
      case 'cash':
        return <MoneyIcon sx={{ color: 'success.main' }} />;
      case 'savings':
        return <AccountBalanceIcon sx={{ color: 'primary.main' }} />;
      case 'current':
        return <AccountBalanceIcon sx={{ color: 'secondary.main' }} />;
      default:
        return <AccountBalanceIcon />;
    }
  };

  const getAccountTypeLabel = (type: string) => {
    switch (type) {
      case 'cash':
        return 'Cash';
      case 'savings':
        return 'Savings';
      case 'current':
        return 'Current';
      default:
        return type;
    }
  };

  const handleTransfer = () => {
    if (!transferForm.fromAccountId || !transferForm.toAccountId || !transferForm.amount) {
      alert('Please fill in all required fields');
      return;
    }

    const fromAccount = accounts.find(acc => acc.id === transferForm.fromAccountId);
    const toAccount = accounts.find(acc => acc.id === transferForm.toAccountId);
    const amount = parseFloat(String(transferForm.amount ?? ''));

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Amount must be greater than 0');
      return;
    }

    if (!fromAccount || !toAccount) {
      alert('Invalid accounts selected');
      return;
    }

    if (fromAccount.balance < amount) {
      alert('Insufficient balance');
      return;
    }

    // Create transfer record
    const newTransfer: CashTransfer = {
      id: Date.now().toString(),
      fromAccountId: transferForm.fromAccountId,
      toAccountId: transferForm.toAccountId,
      amount,
      description: transferForm.description,
      date: new Date().toISOString(),
      type: transferForm.type,
    };

    // Update account balances
    const updatedAccounts = accounts.map(account => {
      if (account.id === transferForm.fromAccountId) {
        return { ...account, balance: account.balance - amount };
      }
      if (account.id === transferForm.toAccountId) {
        return { ...account, balance: account.balance + amount };
      }
      return account;
    });

    setAccounts(updatedAccounts);
    setTransfers([newTransfer, ...transfers]);
    setOpenTransferDialog(false);
    setTransferForm({
      fromAccountId: '',
      toAccountId: '',
      amount: '',
      description: '',
      type: 'transfer',
    });
  };

  const getTotalBalance = () => {
    return accounts.reduce((total, account) => total + account.balance, 0);
  };

  const getCashBalance = () => {
    return accounts
      .filter(account => account.type === 'cash')
      .reduce((total, account) => total + account.balance, 0);
  };

  const getBankBalance = () => {
    return accounts
      .filter(account => account.type !== 'cash')
      .reduce((total, account) => total + account.balance, 0);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Accounts Management</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/accounts/new')}
          >
            Add Account
          </Button>
          <Button
            variant="outlined"
            startIcon={<SwapHorizIcon />}
            onClick={() => setOpenTransferDialog(true)}
          >
            Transfer Funds
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Total Balance
                  </Typography>
                  <Typography variant="h4">
                    ₹{getTotalBalance().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <AccountBalanceIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Cash Balance
                  </Typography>
                  <Typography variant="h4" color="success.main">
                    ₹{getCashBalance().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <MoneyIcon sx={{ fontSize: 40, color: 'success.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography color="text.secondary" gutterBottom>
                    Bank Balance
                  </Typography>
                  <Typography variant="h4" color="primary.main">
                    ₹{getBankBalance().toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <AccountBalanceIcon sx={{ fontSize: 40, color: 'primary.main', opacity: 0.3 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
          <Tab label="Accounts" />
          <Tab label="Recent Transfers" />
        </Tabs>

        {/* Accounts Tab */}
        {activeTab === 0 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Account</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Account Number</TableCell>
                  <TableCell>Bank</TableCell>
                  <TableCell align="right">Balance</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {getAccountTypeIcon(account.type)}
                        <Box>
                          <Typography variant="body1" fontWeight="medium">
                            {account.name}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={getAccountTypeLabel(account.type)}
                        size="small"
                        color={account.type === 'cash' ? 'success' : 'primary'}
                      />
                    </TableCell>
                    <TableCell>{account.accountNumber}</TableCell>
                    <TableCell>{account.bankName}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                      ₹{account.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/accounts/edit/${account.id}`)}
                        title="Edit Account"
                      >
                        <EditIcon />
                      </IconButton>
                      {account.type !== 'cash' && (
                        <IconButton
                          size="small"
                          onClick={() => {
                            // Handle delete
                          }}
                          title="Delete Account"
                        >
                          <DeleteIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Transfers Tab */}
        {activeTab === 1 && (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>From</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Type</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {transfers.map((transfer) => {
                  const fromAccount = accounts.find(acc => acc.id === transfer.fromAccountId);
                  const toAccount = accounts.find(acc => acc.id === transfer.toAccountId);

                  return (
                    <TableRow key={transfer.id} hover>
                      <TableCell>{new Date(transfer.date).toLocaleDateString()}</TableCell>
                      <TableCell>{fromAccount?.name}</TableCell>
                      <TableCell>{toAccount?.name}</TableCell>
                      <TableCell>{transfer.description}</TableCell>
                      <TableCell align="right">₹{transfer.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Chip
                          label={transfer.type.charAt(0).toUpperCase() + transfer.type.slice(1)}
                          size="small"
                          color="info"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {transfers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No transfers recorded yet
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Transfer Funds Dialog */}
      <Dialog open={openTransferDialog} onClose={() => setOpenTransferDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Transfer Funds</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>From Account *</InputLabel>
                <Select
                  value={transferForm.fromAccountId}
                  label="From Account *"
                  onChange={(e) => setTransferForm(prev => ({ ...prev, fromAccountId: e.target.value }))}
                >
                  {accounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name} (₹{account.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>To Account *</InputLabel>
                <Select
                  value={transferForm.toAccountId}
                  label="To Account *"
                  onChange={(e) => setTransferForm(prev => ({ ...prev, toAccountId: e.target.value }))}
                >
                  {accounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      {account.name} (₹{account.balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Amount *"
                type="number"
                value={transferForm.amount}
                onChange={(e) => setTransferForm(prev => ({ ...prev, amount: e.target.value }))}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Transfer Type</InputLabel>
                <Select
                  value={transferForm.type}
                  label="Transfer Type"
                  onChange={(e) => setTransferForm(prev => ({ ...prev, type: e.target.value as any }))}
                >
                  <MenuItem value="transfer">Transfer</MenuItem>
                  <MenuItem value="deposit">Deposit</MenuItem>
                  <MenuItem value="withdrawal">Withdrawal</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={2}
                value={transferForm.description}
                onChange={(e) => setTransferForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTransferDialog(false)}>Cancel</Button>
          <Button onClick={handleTransfer} variant="contained">
            Transfer Funds
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
