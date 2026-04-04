// src/pages/Expenses/ExpenseHeadForm.tsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
} from '@mui/material';
import { AppDispatch, RootState } from '../../store';
import {
  fetchExpenseHeads,
  createExpenseHead,
  updateExpenseHead,
  clearError,
} from '../../store/slices/expenseSlice';
import { ledgerAccountService } from '../../services/masters/ledgerAccountService';
import { LedgerAccount } from '../../types/masters';

export default function ExpenseHeadForm() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const dispatch = useDispatch<AppDispatch>();
  const { expenseHeads, loading, error } = useSelector((state: RootState) => state.expenses);

  const isEditMode = !!id;
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ledgerId: '',
    isActive: true,
  });
  const [ledgers, setLedgers] = useState<LedgerAccount[]>([]);

  useEffect(() => {
    if (isEditMode && expenseHeads.length === 0) {
      dispatch(fetchExpenseHeads());
    }
    
    // Load ledger accounts
    ledgerAccountService.list({ includeInactive: false })
      .then(accounts => {
        // Filter to expense ledgers
        const expenseLedgers = accounts.filter(l => 
          l.groupId && l.isActive
        );
        setLedgers(expenseLedgers);
      })
      .catch(err => console.error('Failed to load ledgers:', err));
  }, [dispatch, isEditMode, expenseHeads.length]);

  useEffect(() => {
    if (isEditMode) {
      const expenseHead = expenseHeads.find(head => head.id === id);
      if (expenseHead) {
        setFormData({
          name: expenseHead.name,
          description: expenseHead.description || '',
          ledgerId: expenseHead.ledgerId || '',
          isActive: expenseHead.isActive,
        });
      }
    }
  }, [expenseHeads, id, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Expense head name is required');
      return;
    }

    try {
      if (isEditMode && id) {
        await dispatch(updateExpenseHead({
          id,
          updates: {
            name: formData.name.trim(),
            description: formData.description.trim(),
            ledgerId: formData.ledgerId || null,
            isActive: formData.isActive,
            updatedAt: new Date(),
          },
        })).unwrap();
      } else {
        await dispatch(createExpenseHead({
          name: formData.name.trim(),
          description: formData.description.trim(),
        })).unwrap();
      }

      navigate('/expenses');
    } catch (error) {
      console.error('Failed to save expense head:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        {isEditMode ? 'Edit Expense Head' : 'Add Expense Head'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => dispatch(clearError())}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Expense Head Name *"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                disabled={loading}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                multiline
                rows={3}
                disabled={loading}
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Expense Ledger Account</InputLabel>
                <Select
                  value={formData.ledgerId}
                  onChange={(e) => handleChange('ledgerId', e.target.value)}
                  disabled={loading}
                  label="Expense Ledger Account"
                >
                  <MenuItem value="">
                    <em>None (No accounting entry)</em>
                  </MenuItem>
                  {ledgers.map((ledger) => (
                    <MenuItem key={ledger.id} value={ledger.id}>
                      {ledger.name}
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Link to expense ledger for automatic voucher posting. If not set, expense will be tracked but not posted to accounts.
                </FormHelperText>
              </FormControl>
            </Grid>

            {isEditMode && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.isActive}
                      onChange={(e) => handleChange('isActive', e.target.checked)}
                      disabled={loading}
                    />
                  }
                  label="Active"
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => navigate('/expenses')}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={20} /> : null}
                >
                  {isEditMode ? 'Update' : 'Create'} Expense Head
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
}
