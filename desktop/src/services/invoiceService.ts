import api from './api';

export interface InvoiceItem {
  id?: string;
  productId?: string;
  name: string;
  hsnCode?: string;
  sacCode?: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  discountType: 'PERCENTAGE' | 'FIXED';
  taxableAmount: number;
  gstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  totalAmount: number;
  batchNumber?: string;
  serialNumber?: string;
}

export interface AdditionalCharge {
  name: string;
  amount: number;
  isTaxable: boolean;
  gstRate?: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  date: string;
  partyId: string;
  partyType: 'CUSTOMER' | 'SUPPLIER';
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountType: 'PERCENTAGE' | 'FIXED';
  additionalCharges?: AdditionalCharge[];
  roundOff: number;
  totalAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  grandTotal: number;
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
  paymentMode: string[];
  notes?: string;
  terms?: string;
  ewayBillNumber?: string;
  isCancelled: boolean;
  createdAt: string;
  createdBy: string;
}

export interface InvoiceFilters {
  page?: number;
  limit?: number;
  type?: string;
  partyId?: string;
  fromDate?: string;
  toDate?: string;
  paymentStatus?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface InvoicesResponse {
  data: Invoice[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const invoiceService = {
  async getInvoices(filters: InvoiceFilters = {}): Promise<InvoicesResponse> {
    const params = new URLSearchParams();
    
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());
    if (filters.type) params.append('type', filters.type);
    if (filters.partyId) params.append('partyId', filters.partyId);
    if (filters.fromDate) params.append('fromDate', filters.fromDate);
    if (filters.toDate) params.append('toDate', filters.toDate);
    if (filters.paymentStatus) params.append('paymentStatus', filters.paymentStatus);
    if (filters.sortBy) params.append('sortBy', filters.sortBy);
    if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);

    const response = await api.get<InvoicesResponse>(`/invoices?${params.toString()}`);
    return response.data;
  },

  async getInvoice(id: string): Promise<Invoice> {
    const response = await api.get<Invoice>(`/invoices/${id}`);
    return response.data;
  },

  async getNextInvoiceNumber(type: string): Promise<{ invoiceNumber: string }> {
    const response = await api.get<{ invoiceNumber: string }>('/invoices/next-number', {
      params: { type },
    });
    return response.data;
  },

  async createInvoice(data: Partial<Invoice>): Promise<Invoice> {
    const response = await api.post<Invoice>('/invoices', data);
    return response.data;
  },

  async updateInvoice(id: string, data: Partial<Invoice>): Promise<Invoice> {
    const response = await api.put<Invoice>(`/invoices/${id}`, data);
    return response.data;
  },

  async deleteInvoice(id: string): Promise<void> {
    await api.delete(`/invoices/${id}`);
  },

  async cancelInvoice(id: string): Promise<Invoice> {
    const response = await api.post<Invoice>(`/invoices/${id}/cancel`);
    return response.data;
  },

  async printInvoice(id: string): Promise<any> {
    const response = await api.get(`/invoices/${id}/print`);
    return response.data;
  },

  async emailInvoice(id: string, email: string): Promise<void> {
    await api.post(`/invoices/${id}/email`, { email });
  },
};

