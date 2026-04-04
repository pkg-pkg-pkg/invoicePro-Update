import api from './api';
import { BankAccountType } from "@gst-billing/shared";

export interface BankAccount {
  id: string;
  name: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  accountType: BankAccountType;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    payments: number;
  };
}

export interface BankFilters {
  search?: string;
  accountType?: BankAccountType;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface BankStatementEntry {
  id: string;
  type: string;
  amount: number;
  paymentMode: string;
  referenceNumber?: string;
  date: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    type: string;
  };
  balance: number;
}

export interface BankStatement {
  bankAccount: {
    id: string;
    name: string;
    accountNumber: string;
    openingBalance: number;
    currentBalance: number;
  };
  statement: BankStatementEntry[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BankSummary {
  totalBalance: number;
  cashBalance: number;
  bankBalance: number;
  accountCount: number;
  accounts: Array<{
    id: string;
    name: string;
    accountType: BankAccountType;
    balance: number;
  }>;
}

export interface CreateBankAccountData {
  name: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  branchName?: string;
  accountType: BankAccountType;
  openingBalance?: number;
}

export interface ReconcileBankData {
  balance: number;
  date?: string;
  notes?: string;
}

export const bankService = {
  // Get bank accounts
  getBankAccounts: async (filters: BankFilters = {}): Promise<BankAccount[]> => {
    const response = await api.get('/banks', { params: filters });
    return response.data;
  },

  // Get single bank account
  getBankAccount: async (id: string): Promise<BankAccount> => {
    const response = await api.get(`/banks/${id}`);
    return response.data;
  },

  // Create bank account
  createBankAccount: async (data: CreateBankAccountData): Promise<BankAccount> => {
    const response = await api.post('/banks', data);
    return response.data;
  },

  // Update bank account
  updateBankAccount: async (id: string, data: Partial<CreateBankAccountData & { isActive?: boolean }>): Promise<BankAccount> => {
    const response = await api.put(`/banks/${id}`, data);
    return response.data;
  },

  // Delete bank account
  deleteBankAccount: async (id: string): Promise<void> => {
    await api.delete(`/banks/${id}`);
  },

  // Get bank statement
  getBankStatement: async (
    id: string,
    fromDate?: string,
    toDate?: string,
    page?: number,
    limit?: number
  ): Promise<BankStatement> => {
    const response = await api.get(`/banks/${id}/statement`, {
      params: { fromDate, toDate, page, limit },
    });
    return response.data;
  },

  // Reconcile bank account
  reconcileBankAccount: async (id: string, data: ReconcileBankData): Promise<any> => {
    const response = await api.post(`/banks/${id}/reconcile`, data);
    return response.data;
  },

  // Get bank summary
  getBankSummary: async (): Promise<BankSummary> => {
    const response = await api.get('/banks/summary');
    return response.data;
  },
};

export default bankService;

