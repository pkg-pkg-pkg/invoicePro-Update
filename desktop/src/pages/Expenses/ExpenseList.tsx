// src/pages/Expenses/ExpenseList.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
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
  Alert,
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
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { AppDispatch, RootState } from '../../store';
import {
  fetchExpenseHeads,
  deleteExpenseHead,
  fetchExpenses,
  createExpense,
  clearError,
} from '../../store/slices/expenseSlice';
import { formatCurrency, formatDate } from '../../utils/formatters';

export default function ExpenseList() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { expenses, expenseHeads, loading, error } = useSelector((state: RootState) => state.expenses);
  const { user } = useSelector((state: RootState) => state.auth);

  const [openExpenseDialog, setOpenExpenseDialog] = useState(false);
  const [expenseFormData, setExpenseFormData] = useState({
    expenseHeadId: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'cash' as 'cash' | 'bank' | 'cheque' | 'upi' | 'card',
    referenceNumber: '',
    notes: '',
  });

  useEffect(() => {
    dispatch(fetchExpenseHeads());
    dispatch(fetchExpenses({}));
  }, [dispatch]);

  const handleDeleteExpenseHead = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense head? This will also delete all associated expenses.')) {
      await dispatch(deleteExpenseHead(id));
    }
  };

  const handleAddExpense = async () => {
    if (!expenseFormData.expenseHeadId || !expenseFormData.amount || !expenseFormData.description) {
      alert('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(String(expenseFormData.amount ?? ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Amount must be greater than 0');
      return;
    }

    try {
      const selectedHead = expenseHeads.find(head => head.id === expenseFormData.expenseHeadId);
      if (!selectedHead) return;

      await dispatch(createExpense({
        expenseHeadId: expenseFormData.expenseHeadId,
        expenseHeadName: selectedHead.name,
        expenseHeadLedgerId: selectedHead.ledgerId || null,
        amount,
        description: expenseFormData.description,
        date: expenseFormData.date,
        paymentMode: expenseFormData.paymentMode,
        referenceNumber: expenseFormData.referenceNumber || undefined,
        notes: expenseFormData.notes || undefined,
        createdBy: user?.fullName || 'Unknown',
      })).unwrap();

      setOpenExpenseDialog(false);
      setExpenseFormData({
        expenseHeadId: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'cash',
        referenceNumber: '',
        notes: '',
      });
    } catch (error) {
      console.error('Failed to create expense:', error);
    }
  };

  const getTotalExpenses = () => {
    return expenses.reduce((total, expense) => total + expense.amount, 0);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Expense Management</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenExpenseDialog(true)}
          >
            Add Expense
          </Button>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => navigate('/expenses/heads/new')}
          >
            Add Expense Head
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="primary">
              Total Expense Heads
            </Typography>
            <Typography variant="h4">
              {expenseHeads.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="secondary">
              Total Expenses
            </Typography>
            <Typography variant="h4">
              {expenses.length}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="error">
              Total Amount
            </Typography>
            <Typography variant="h4">
              {formatCurrency(getTotalExpenses())}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2, textAlign: 'center' }}>
            <Typography variant="h6" color="success">
              This Month
            </Typography>
            <Typography variant="h4">
              {formatCurrency(
                expenses
                  .filter(expense => {
                    const expenseDate = new Date(expense.date);
                    const now = new Date();
                    return expenseDate.getMonth() === now.getMonth() &&
                           expenseDate.getFullYear() === now.getFullYear();
                  })
                  .reduce((total, expense) => total + expense.amount, 0)
              )}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Expense Heads Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Expense Heads
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Expenses Count</TableCell>
                <TableCell>Total Amount</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenseHeads.map((head) => {
                const headExpenses = expenses.filter(expense => expense.expenseHeadId === head.id);
                const totalAmount = headExpenses.reduce((sum, expense) => sum + expense.amount, 0);

                return (
                  <TableRow key={head.id} hover>
                    <TableCell>{head.name}</TableCell>
                    <TableCell>{head.description || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={head.isActive ? 'Active' : 'Inactive'}
                        color={head.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{headExpenses.length}</TableCell>
                    <TableCell>{formatCurrency(totalAmount)}</TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/expenses/heads/edit/${head.id}`)}
                        title="Edit Expense Head"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteExpenseHead(head.id)}
                        title="Delete Expense Head"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Recent Expenses Section */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Expenses
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Expense Head</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Payment Mode</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenses.slice(0, 10).map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>{formatDate(expense.date)}</TableCell>
                  <TableCell>{expense.expenseHeadName}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>
                    <Chip
                      label={expense.paymentMode.toUpperCase()}
                      size="small"
                      color="primary"
                    />
                  </TableCell>
                  <TableCell align="right">{formatCurrency(expense.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add Expense Dialog */}
      <Dialog open={openExpenseDialog} onClose={() => setOpenExpenseDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add New Expense</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Expense Head *</InputLabel>
                <Select
                  value={expenseFormData.expenseHeadId}
                  label="Expense Head *"
                  onChange={(e) => setExpenseFormData(prev => ({ ...prev, expenseHeadId: e.target.value }))}
                >
                  {expenseHeads.filter(head => head.isActive).map((head) => (
                    <MenuItem key={head.id} value={head.id}>
                      {head.name}
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
                value={expenseFormData.amount}
                onChange={(e) => setExpenseFormData(prev => ({ ...prev, amount: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Date *"
                type="date"
                value={expenseFormData.date}
                onChange={(e) => setExpenseFormData(prev => ({ ...prev, date: e.target.value }))}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>Payment Mode</InputLabel>
                <Select
                  value={expenseFormData.paymentMode}
                  label="Payment Mode"
                  onChange={(e) => setExpenseFormData(prev => ({ ...prev, paymentMode: e.target.value as any }))}
                >
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="bank">Bank Transfer</MenuItem>
                  <MenuItem value="cheque">Cheque</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                  <MenuItem value="card">Card</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description *"
                multiline
                rows={2}
                value={expenseFormData.description}
                onChange={(e) => setExpenseFormData(prev => ({ ...prev, description: e.target.value }))}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Reference Number"
                value={expenseFormData.referenceNumber}
                onChange={(e) => setExpenseFormData(prev => ({ ...prev, referenceNumber: e.target.value }))}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Notes"
                value={expenseFormData.notes}
                onChange={(e) => setExpenseFormData(prev => ({ ...prev, notes: e.target.value }))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenExpenseDialog(false)}>Cancel</Button>
          <Button onClick={handleAddExpense} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={20} /> : 'Add Expense'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
