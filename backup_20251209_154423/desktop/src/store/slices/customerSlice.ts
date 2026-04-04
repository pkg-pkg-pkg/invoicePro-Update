import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export interface Customer {
  id: string | number;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  gstin?: string;
  currentBalance?: number; // Positive = Receivable
}

interface CustomerState {
  items: Customer[];
  loading: boolean;
  error: string | null;
}

const initialState: CustomerState = {
  items: [],
  loading: false,
  error: null,
};

export const fetchCustomers = createAsyncThunk(
  'customers/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('http://localhost:3000/api/customers');
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch customers');
    }
  }
);

export const addCustomer = createAsyncThunk(
  'customers/add',
  async (data: Partial<Customer>, { rejectWithValue }) => {
    try {
      const response = await axios.post('http://localhost:3000/api/customers', data);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to add customer');
    }
  }
);

export const updateCustomer = createAsyncThunk(
  'customers/update',
  async ({ id, data }: { id: string | number; data: Partial<Customer> }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`http://localhost:3000/api/customers/${id}`, data);
      return response.data.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update customer');
    }
  }
);

export const deleteCustomer = createAsyncThunk(
  'customers/delete',
  async (id: string | number, { rejectWithValue }) => {
    try {
      await axios.delete(`http://localhost:3000/api/customers/${id}`);
      return id;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete customer');
    }
  }
);

const customerSlice = createSlice({
  name: 'customers',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCustomers.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(fetchCustomers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchCustomers.rejected, (state, action) => { state.loading = false; state.error = action.payload as string; })
      .addCase(addCustomer.fulfilled, (state, action) => { state.items.push(action.payload); })
      .addCase(updateCustomer.fulfilled, (state, action) => {
        const index = state.items.findIndex(c => c.id === action.payload.id);
        if (index !== -1) state.items[index] = action.payload;
      })
      .addCase(deleteCustomer.fulfilled, (state, action) => {
        state.items = state.items.filter(c => c.id !== action.payload);
      });
  },
});

export const { clearError } = customerSlice.actions;
export default customerSlice.reducer;
