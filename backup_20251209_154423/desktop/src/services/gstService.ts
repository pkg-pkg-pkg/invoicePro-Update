import api from './api';

export interface GSTR1Response {
  period: { month: number; year: number };
  b2b: any[];
  b2c: any[];
  hsnSummary: any[];
  summary: {
    totalB2BInvoices: number;
    totalB2CInvoices: number;
    totalTaxableValue: number;
    totalIGST: number;
    totalCGST: number;
    totalSGST: number;
  };
}

export interface GSTR2Response {
  period: { month: number; year: number };
  b2b: any[];
  hsnSummary: any[];
  summary: {
    totalInvoices: number;
    totalTaxableValue: number;
    totalITC: number;
    totalIGST: number;
    totalCGST: number;
    totalSGST: number;
  };
}

export interface GSTR3BResponse {
  period: { month: number; year: number };
  outwardSupplies: {
    totalTaxableValue: number;
    totalIGST: number;
    totalCGST: number;
    totalSGST: number;
    totalTax: number;
  };
  inwardSupplies: {
    totalTaxableValue: number;
    totalIGST: number;
    totalCGST: number;
    totalSGST: number;
    totalITC: number;
  };
  taxLiability: {
    igst: number;
    cgst: number;
    sgst: number;
    total: number;
  };
  summary: {
    netTaxPayable: number;
    itcAvailable: number;
    itcUtilized: number;
  };
}

export interface GSTR9Response {
  year: number;
  monthlyData: Array<{
    month: number;
    sales: { count: number; total: number; tax: number };
    purchases: { count: number; total: number; tax: number };
  }>;
  annualSummary: {
    totalSales: number;
    totalPurchases: number;
    totalSalesTax: number;
    totalPurchaseTax: number;
    netTaxPayable: number;
  };
}

export interface HSNSummaryResponse {
  fromDate: string;
  toDate: string;
  hsnSummary: Array<{
    hsnCode: string;
    description: string;
    quantity: number;
    uqc: string;
    rate: number;
    taxableValue: number;
    igst: number;
    cgst: number;
    sgst: number;
    totalTax: number;
  }>;
}

export const gstService = {
  async getGSTR1(month: number, year: number): Promise<GSTR1Response> {
    const response = await api.get<GSTR1Response>('/gst/gstr1', {
      params: { month, year },
    });
    return response.data;
  },

  async getGSTR2(month: number, year: number): Promise<GSTR2Response> {
    const response = await api.get<GSTR2Response>('/gst/gstr2', {
      params: { month, year },
    });
    return response.data;
  },

  async getGSTR3B(month: number, year: number): Promise<GSTR3BResponse> {
    const response = await api.get<GSTR3BResponse>('/gst/gstr3b', {
      params: { month, year },
    });
    return response.data;
  },

  async getGSTR9(year: number): Promise<GSTR9Response> {
    const response = await api.get<GSTR9Response>('/gst/gstr9', {
      params: { year },
    });
    return response.data;
  },

  async exportGSTR1(month: number, year: number, gstin?: string): Promise<Blob> {
    const response = await api.get('/gst/gstr1/export', {
      params: { month, year, gstin },
      responseType: 'blob',
    });
    return response.data;
  },

  async exportGSTR2(month: number, year: number, gstin?: string): Promise<Blob> {
    const response = await api.get('/gst/gstr2/export', {
      params: { month, year, gstin },
      responseType: 'blob',
    });
    return response.data;
  },

  async getHSNSummary(fromDate?: string, toDate?: string): Promise<HSNSummaryResponse> {
    const response = await api.get<HSNSummaryResponse>('/gst/hsn-summary', {
      params: { fromDate, toDate },
    });
    return response.data;
  },

  async generateEwayBill(invoiceId: string): Promise<{ ewayBillNumber: string; invoiceNumber: string }> {
    const response = await api.post('/gst/eway-bill', { invoiceId });
    return response.data;
  },
};

