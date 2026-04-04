import api from './api';
import { PaymentType, PartyType, PaymentMode } from "@gst-billing/shared";

export interface Payment {
  id: string;
  type: PaymentType;
  partyId: string;
  partyType: PartyType;
  party?: {
    id: string;
    name: string;
  };
  amount: number;
  paymentMode: PaymentMode;
  referenceNumber?: string;
  chequeNumber?: string;
  chequeDate?: string;
  bankId?: string;
  bank?: {
    id: string;
    name: string;
    accountNumber: string;
  };
  invoiceId?: string;
  invoice?: {
    id: string;
    invoiceNumber: string;
    type: string;
    grandTotal: number;
    paymentStatus: string;
  };
  notes?: string;
  date: string;
  createdAt: string;
  createdBy: string;
}

export interface PaymentFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: PaymentType;
  partyType?: PartyType;
  partyId?: string;
  paymentMode?: PaymentMode;
  fromDate?: string;
  toDate?: string;
  invoiceId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaymentsResponse {
  data: Payment[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface PaymentSummary {
  receipts: {
    total: number;
    count: number;
  };
  payments: {
    total: number;
    count: number;
  };
  net: number;
  byMode: Array<{
    mode: PaymentMode;
    total: number;
  }>;
}

export interface CreatePaymentData {
  type: PaymentType;
  partyId: string;
  partyType: PartyType;
  amount: number;
  paymentMode: PaymentMode;
  referenceNumber?: string;
  chequeNumber?: string;
  chequeDate?: string;
  bankId?: string;
  invoiceId?: string;
  notes?: string;
  date: string;
}

export const paymentService = {
  // Get payments with filters
  getPayments: async (filters: PaymentFilters = {}): Promise<PaymentsResponse> => {
    const response = await api.get('/payments', { params: filters });
    return response.data;
  },

  // Get single payment
  getPayment: async (id: string): Promise<Payment> => {
    const response = await api.get(`/payments/${id}`);
    return response.data;
  },

  // Create payment
  createPayment: async (data: CreatePaymentData): Promise<Payment> => {
    const response = await api.post('/payments', data);
    return response.data;
  },

  // Update payment
  updatePayment: async (id: string, data: Partial<CreatePaymentData>): Promise<Payment> => {
    const response = await api.put(`/payments/${id}`, data);
    return response.data;
  },

  // Delete payment
  deletePayment: async (id: string): Promise<void> => {
    await api.delete(`/payments/${id}`);
  },

  // Get payment summary
  getPaymentSummary: async (fromDate?: string, toDate?: string): Promise<PaymentSummary> => {
    const response = await api.get('/payments/summary', {
      params: { fromDate, toDate },
    });
    return response.data;
  },
};

export default paymentService;

