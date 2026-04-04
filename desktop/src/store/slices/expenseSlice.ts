// src/store/slices/expenseSlice.ts
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { createExpenseVoucher, deleteExpenseVoucher } from '../../services/expenses/expenseVoucherService';

export interface ExpenseHead {
  id: string;
  name: string;
  description?: string;
  ledgerId?: string | null; // Link to expense ledger account
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Expense {
  id: string;
  expenseHeadId: string;
  expenseHeadName: string;
  amount: number;
  description: string;
  date: string;
  paymentMode: 'cash' | 'bank' | 'cheque' | 'upi' | 'card';
  bankAccountId?: string;
  referenceNumber?: string;
  voucherId?: string | null; // Link to accounting voucher
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseState {
  expenses: Expense[];
  expenseHeads: ExpenseHead[];
  loading: boolean;
  error: string | null;
  currentExpense: Expense | null;
}

const initialState: ExpenseState = {
  expenses: [],
  expenseHeads: [],
  loading: false,
  error: null,
  currentExpense: null,
};

// Async thunks
export const fetchExpenseHeads = createAsyncThunk<ExpenseHead[], void, { rejectValue: string }>(
  'expense/fetchExpenseHeads',
  async (_, thunkAPI) => {
    try {
      // Load from localStorage
      const stored = localStorage.getItem('expense_heads');
      if (stored) {
        return JSON.parse(stored) as ExpenseHead[];
      }
      // Return empty array if no data
      return [];
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to load expense heads');
    }
  }
);

export const createExpenseHead = createAsyncThunk<ExpenseHead, {
  name: string;
  description?: string;
}, { rejectValue: string }>(
  'expense/createExpenseHead',
  async (payload, thunkAPI) => {
    try {
      // Create corresponding ledger account for expense head
      let ledgerId: string | undefined;
      try {
        const { autoLedgerService } = await import("../../services/masters/autoLedgerService");
        ledgerId = await autoLedgerService.ensureExpenseLedger(payload.name);
        console.log('✅ Created expense ledger:', ledgerId);
      } catch (ledgerError) {
        console.warn('⚠️ Failed to create expense ledger:', ledgerError);
        // Continue without ledger - expense head will still work
      }

      const newExpenseHead: ExpenseHead = {
        id: Date.now().toString(),
        name: payload.name,
        description: payload.description || '',
        ledgerId: ledgerId || null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Save to localStorage
      const stored = localStorage.getItem('expense_heads');
      const existing = stored ? JSON.parse(stored) : [];
      const updated = [...existing, newExpenseHead];
      localStorage.setItem('expense_heads', JSON.stringify(updated));

      return newExpenseHead;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to create expense head');
    }
  }
);

export const updateExpenseHead = createAsyncThunk<ExpenseHead, {
  id: string;
  updates: Partial<ExpenseHead>;
}, { rejectValue: string }>(
  'expense/updateExpenseHead',
  async ({ id, updates }, thunkAPI) => {
    try {
      const stored = localStorage.getItem('expense_heads');
      if (!stored) return thunkAPI.rejectWithValue('Expense heads not found');

      const existing = JSON.parse(stored) as ExpenseHead[];
      const index = existing.findIndex(head => head.id === id);
      if (index === -1) return thunkAPI.rejectWithValue('Expense head not found');

      const updatedHead = { ...existing[index], ...updates, updatedAt: new Date() };
      existing[index] = updatedHead;
      localStorage.setItem('expense_heads', JSON.stringify(existing));

      return updatedHead;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to update expense head');
    }
  }
);

export const deleteExpenseHead = createAsyncThunk<string, string, { rejectValue: string }>(
  'expense/deleteExpenseHead',
  async (id, thunkAPI) => {
    try {
      const stored = localStorage.getItem('expense_heads');
      if (!stored) return thunkAPI.rejectWithValue('Expense heads not found');

      const existing = JSON.parse(stored) as ExpenseHead[];
      const filtered = existing.filter(head => head.id !== id);

      // Also delete associated expenses
      const expensesStored = localStorage.getItem('expenses');
      if (expensesStored) {
        const expenses = JSON.parse(expensesStored) as Expense[];
        const filteredExpenses = expenses.filter(expense => expense.expenseHeadId !== id);
        localStorage.setItem('expenses', JSON.stringify(filteredExpenses));
      }

      localStorage.setItem('expense_heads', JSON.stringify(filtered));
      return id;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to delete expense head');
    }
  }
);

export const fetchExpenses = createAsyncThunk<Expense[], {
  startDate?: string;
  endDate?: string;
  expenseHeadId?: string;
}, { rejectValue: string }>(
  'expense/fetchExpenses',
  async (filters, thunkAPI) => {
    try {
      const stored = localStorage.getItem('expenses');
      if (!stored) return [];

      let expenses = JSON.parse(stored) as Expense[];

      // Apply filters
      if (filters.expenseHeadId) {
        expenses = expenses.filter(expense => expense.expenseHeadId === filters.expenseHeadId);
      }
      if (filters.startDate) {
        expenses = expenses.filter(expense => expense.date >= filters.startDate!);
      }
      if (filters.endDate) {
        expenses = expenses.filter(expense => expense.date <= filters.endDate!);
      }

      return expenses;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to load expenses');
    }
  }
);

export const createExpense = createAsyncThunk<Expense, Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'voucherId'> & {
  expenseHeadLedgerId?: string | null;
}, { rejectValue: string }>(
  'expense/createExpense',
  async (expenseData, thunkAPI) => {
    try {
      const newExpense: Expense = {
        ...expenseData,
        id: Date.now().toString(),
        voucherId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Create accounting voucher if expense head has ledger mapping
      try {
        const voucherId = await createExpenseVoucher({
          expenseId: newExpense.id,
          expenseHeadLedgerId: expenseData.expenseHeadLedgerId || null,
          amount: expenseData.amount,
          description: expenseData.description,
          date: expenseData.date,
          paymentMode: expenseData.paymentMode,
          bankAccountId: expenseData.bankAccountId,
          referenceNumber: expenseData.referenceNumber,
        });
        
        if (voucherId) {
          newExpense.voucherId = voucherId;
        }
      } catch (voucherError) {
        console.warn('Expense saved but voucher creation failed:', voucherError);
        // Continue saving expense even if voucher fails
      }

      // Save to localStorage
      const stored = localStorage.getItem('expenses');
      const existing = stored ? JSON.parse(stored) : [];
      const updated = [...existing, newExpense];
      localStorage.setItem('expenses', JSON.stringify(updated));

      return newExpense;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to create expense');
    }
  }
);

export const updateExpense = createAsyncThunk<Expense, {
  id: string;
  updates: Partial<Expense>;
}, { rejectValue: string }>(
  'expense/updateExpense',
  async ({ id, updates }, thunkAPI) => {
    try {
      const stored = localStorage.getItem('expenses');
      if (!stored) return thunkAPI.rejectWithValue('Expenses not found');

      const existing = JSON.parse(stored) as Expense[];
      const index = existing.findIndex(expense => expense.id === id);
      if (index === -1) return thunkAPI.rejectWithValue('Expense not found');

      const updatedExpense = { ...existing[index], ...updates, updatedAt: new Date() };
      existing[index] = updatedExpense;
      localStorage.setItem('expenses', JSON.stringify(existing));

      return updatedExpense;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to update expense');
    }
  }
);

export const deleteExpense = createAsyncThunk<string, string, { rejectValue: string }>(
  'expense/deleteExpense',
  async (id, thunkAPI) => {
    try {
      const stored = localStorage.getItem('expenses');
      if (!stored) return thunkAPI.rejectWithValue('Expenses not found');

      const existing = JSON.parse(stored) as Expense[];
      const expense = existing.find(e => e.id === id);
      
      // Delete associated voucher if exists
      if (expense?.voucherId) {
        try {
          await deleteExpenseVoucher(expense.voucherId);
        } catch (voucherError) {
          console.warn('Expense deleted but voucher deletion failed:', voucherError);
        }
      }

      const filtered = existing.filter(expense => expense.id !== id);
      localStorage.setItem('expenses', JSON.stringify(filtered));

      return id;
    } catch (err: any) {
      return thunkAPI.rejectWithValue(err?.message ?? 'Failed to delete expense');
    }
  }
);

const expenseSlice = createSlice({
  name: 'expense',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    setCurrentExpense(state, action: PayloadAction<Expense | null>) {
      state.currentExpense = action.payload;
    },
    clearCurrentExpense(state) {
      state.currentExpense = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // Expense Heads
      .addCase(fetchExpenseHeads.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExpenseHeads.fulfilled, (state, action) => {
        state.loading = false;
        state.expenseHeads = action.payload;
      })
      .addCase(fetchExpenseHeads.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to fetch expense heads';
      })

      .addCase(createExpenseHead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createExpenseHead.fulfilled, (state, action) => {
        state.loading = false;
        state.expenseHeads.push(action.payload);
      })
      .addCase(createExpenseHead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to create expense head';
      })

      .addCase(updateExpenseHead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateExpenseHead.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.expenseHeads.findIndex(head => head.id === action.payload.id);
        if (index !== -1) {
          state.expenseHeads[index] = action.payload;
        }
      })
      .addCase(updateExpenseHead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to update expense head';
      })

      .addCase(deleteExpenseHead.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteExpenseHead.fulfilled, (state, action) => {
        state.loading = false;
        state.expenseHeads = state.expenseHeads.filter(head => head.id !== action.payload);
      })
      .addCase(deleteExpenseHead.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to delete expense head';
      })

      // Expenses
      .addCase(fetchExpenses.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExpenses.fulfilled, (state, action) => {
        state.loading = false;
        state.expenses = action.payload;
      })
      .addCase(fetchExpenses.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to fetch expenses';
      })

      .addCase(createExpense.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(createExpense.fulfilled, (state, action) => {
        state.loading = false;
        state.expenses.push(action.payload);
      })
      .addCase(createExpense.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to create expense';
      })

      .addCase(updateExpense.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateExpense.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.expenses.findIndex(expense => expense.id === action.payload.id);
        if (index !== -1) {
          state.expenses[index] = action.payload;
        }
      })
      .addCase(updateExpense.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to update expense';
      })

      .addCase(deleteExpense.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteExpense.fulfilled, (state, action) => {
        state.loading = false;
        state.expenses = state.expenses.filter(expense => expense.id !== action.payload);
      })
      .addCase(deleteExpense.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload ?? action.error?.message ?? 'Failed to delete expense';
      });
  },
});

export const { clearError, setCurrentExpense, clearCurrentExpense } = expenseSlice.actions;

export default expenseSlice.reducer;
