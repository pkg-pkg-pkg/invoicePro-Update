import api from './api';

export interface Customer {
  id: string;
  name: string;
  code?: string;
  phone: string;
  email?: string;
  whatsapp?: string;
  gstin?: string;
  pan?: string;
  group: 'RETAIL' | 'WHOLESALE' | 'DISTRIBUTOR' | 'VIP';
  creditLimit: number;
  creditDays: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  code?: string;
  phone: string;
  email?: string;
  whatsapp?: string;
  gstin?: string;
  pan?: string;
  creditDays: number;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartyFilters {
  page?: number;
  limit?: number;
  search?: string;
  group?: string;
  hasOutstanding?: boolean;
  hasPayable?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PartiesResponse {
  data: (Customer | Supplier)[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface LedgerTransaction {
  id?: string;
  date: string;
  type: string;
  reference: string;
  description?: string;
  debit: number;
  credit: number;
  balance: number;
  paymentStatus?: string;
}

export interface PartyLedger {
  customer?: Customer;
  supplier?: Supplier;
  transactions: LedgerTransaction[];
  summary: {
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
  };
}

export interface OutstandingSummary {
  total: number;
  current: number;
  overdue30: number;
  overdue60: number;
  overdue90Plus: number;
  totalOverdue: number;
}

export interface OutstandingParty {
  partyId: string;
  name: string;
  phone: string;
  outstanding: number;
  overdue: boolean;
  oldestInvoiceDate: string | null;
}

export const customerService = {
  async getCustomers(filters: PartyFilters = {}): Promise<PartiesResponse> {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.group) params.append('group', filters.group);
    if (filters.hasOutstanding) params.append('hasOutstanding', 'true');
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await api.get<PartiesResponse>(`/customers?${params.toString()}`);
    return response.data;
  },

  async getCustomer(id: string): Promise<Customer> {
    const response = await api.get<Customer>(`/customers/${id}`);
    return response.data;
  },

  async createCustomer(data: Partial<Customer>): Promise<Customer> {
    const response = await api.post<Customer>('/customers', data);
    return response.data;
  },

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const response = await api.put<Customer>(`/customers/${id}`, data);
    return response.data;
  },

  async deleteCustomer(id: string): Promise<void> {
    await api.delete(`/customers/${id}`);
  },

  async getCustomerLedger(id: string, fromDate?: string, toDate?: string): Promise<PartyLedger> {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    
    const response = await api.get<PartyLedger>(`/customers/${id}/ledger?${params.toString()}`);
    return response.data;
  },

  async getCustomerOutstanding(id: string): Promise<OutstandingSummary> {
    const response = await api.get<OutstandingSummary>(`/customers/${id}/outstanding`);
    return response.data;
  },

  async getOutstandingList(): Promise<OutstandingParty[]> {
    const response = await api.get<OutstandingParty[]>('/customers/outstanding');
    return response.data;
  },

  async getCustomerByPhone(phone: string): Promise<Customer> {
    const response = await api.get<Customer>(`/customers/phone/${phone}`);
    return response.data;
  },

  async getCustomerByGSTIN(gstin: string): Promise<Customer> {
    const response = await api.get<Customer>(`/customers/gstin/${gstin}`);
    return response.data;
  },
};

export const supplierService = {
  async getSuppliers(filters: PartyFilters = {}): Promise<PartiesResponse> {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.search) params.append('search', filters.search);
    if (filters.hasPayable) params.append('hasPayable', 'true');
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await api.get<PartiesResponse>(`/suppliers?${params.toString()}`);
    return response.data;
  },

  async getSupplier(id: string): Promise<Supplier> {
    const response = await api.get<Supplier>(`/suppliers/${id}`);
    return response.data;
  },

  async createSupplier(data: Partial<Supplier>): Promise<Supplier> {
    const response = await api.post<Supplier>('/suppliers', data);
    return response.data;
  },

  async updateSupplier(id: string, data: Partial<Supplier>): Promise<Supplier> {
    const response = await api.put<Supplier>(`/suppliers/${id}`, data);
    return response.data;
  },

  async deleteSupplier(id: string): Promise<void> {
    await api.delete(`/suppliers/${id}`);
  },

  async getSupplierLedger(id: string, fromDate?: string, toDate?: string): Promise<PartyLedger> {
    const params = new URLSearchParams();
    if (fromDate) params.append('fromDate', fromDate);
    if (toDate) params.append('toDate', toDate);
    
    const response = await api.get<PartyLedger>(`/suppliers/${id}/ledger?${params.toString()}`);
    return response.data;
  },

  async getSupplierPayable(id: string): Promise<OutstandingSummary> {
    const response = await api.get<OutstandingSummary>(`/suppliers/${id}/payable`);
    return response.data;
  },

  async getPayableList(): Promise<OutstandingParty[]> {
    const response = await api.get<OutstandingParty[]>('/suppliers/payable');
    return response.data;
  },
};

