import api from './api';

export interface SchemeSlab {
  id: string;
  name: string;
  minNetPreGst: number;
}

export interface SchemeProduct {
  id: string;
  schemeId: string;
  productId: string;
  product: {
    id: string;
    name: string;
    code: string;
  };
}

export interface Scheme {
  id: string;
  companyId: string;
  name: string;
  schemeType: 'BUY_X_GET_Y' | 'FLAT_DISCOUNT' | 'PERCENT_DISCOUNT' | 'EXTRA_QUANTITY';
  schemeDetails: Record<string, any>;
  appliesTo: 'SALES' | 'PURCHASE' | 'BOTH';
  startDate: string;
  endDate: string;
  isActive: boolean;
  products: SchemeProduct[];
  createdAt: string;
  updatedAt: string;
  // Smart Scheme Engine fields
  giftCost?: number;
  marginBurnPercentage?: number;
  paymentTerms?: '7_days' | '15_days' | '30_days' | 'COD';
  autoCalculateTarget?: boolean;
  calculatedTarget?: number;
  isFrozen?: boolean;
}

export interface SchemeBenefit {
  applicable: boolean;
  benefit: string;
  value: number;
}

class SchemeService {
  /**
   * Get all schemes for a company
   */
  async getSchemes(companyId: string): Promise<Scheme[]> {
    try {
      const response = await api.get('/schemes', {
        params: { companyId }
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching schemes:', error);
      throw error;
    }
  }

  /**
   * Get single scheme
   */
  async getScheme(schemeId: string): Promise<Scheme> {
    try {
      const response = await api.get(`/schemes/${schemeId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching scheme:', error);
      throw error;
    }
  }

  /**
   * Create new scheme
   */
  async createScheme(data: {
    companyId: string;
    name: string;
    schemeType: string;
    schemeDetails: Record<string, any>;
    appliesTo: string;
    startDate: Date;
    endDate: Date;
    productIds: string[];
    isActive: boolean;
  }): Promise<Scheme> {
    try {
      const response = await api.post('/schemes', {
        ...data,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString()
      });
      return response.data.data;
    } catch (error) {
      console.error('Error creating scheme:', error);
      throw error;
    }
  }

  /**
   * Update scheme
   */
  async updateScheme(
    schemeId: string,
    data: Partial<Scheme> & { productIds?: string[] }
  ): Promise<Scheme> {
    try {
      const response = await api.put(`/schemes/${schemeId}`, {
        ...data,
        ...(data.startDate && { startDate: new Date(data.startDate).toISOString() }),
        ...(data.endDate && { endDate: new Date(data.endDate).toISOString() })
      });
      return response.data.data;
    } catch (error) {
      console.error('Error updating scheme:', error);
      throw error;
    }
  }

  /**
   * Delete scheme
   */
  async deleteScheme(schemeId: string): Promise<void> {
    try {
      await api.delete(`/schemes/${schemeId}`);
    } catch (error) {
      console.error('Error deleting scheme:', error);
      throw error;
    }
  }

  /**
   * Detect applicable schemes for a product
   */
  async detectSchemes(
    companyId: string,
    productId: string,
    invoiceDate: Date,
    appliesTo?: 'SALES' | 'PURCHASE'
  ): Promise<Scheme[]> {
    try {
      const response = await api.get(`/schemes/detect/${productId}`, {
        params: {
          companyId,
          invoiceDate: invoiceDate.toISOString(),
          ...(appliesTo && { appliesTo })
        }
      });
      return response.data.data || [];
    } catch (error) {
      console.error('Error detecting schemes:', error);
      return [];
    }
  }

  /**
   * Calculate scheme benefit
   */
  async calculateBenefit(schemeId: string, quantity: number): Promise<SchemeBenefit> {
    try {
      const response = await api.post('/schemes/calculate', {
        schemeId,
        quantity
      });
      return response.data.data;
    } catch (error) {
      console.error('Error calculating benefit:', error);
      throw error;
    }
  }

  /**
   * Check if multiple schemes are active
   */
  async checkActiveSchemes(
    companyId: string,
    productIds: string[],
    appliesTo?: string
  ): Promise<Record<string, Scheme[]>> {
    try {
      const schemeMap: Record<string, Scheme[]> = {};

      // For each product, get applicable schemes
      for (const productId of productIds) {
        const schemes = await this.detectSchemes(
          companyId,
          productId,
          new Date(),
          appliesTo as any
        );
        if (schemes.length > 0) {
          schemeMap[productId] = schemes;
        }
      }

      return schemeMap;
    } catch (error) {
      console.error('Error checking active schemes:', error);
      return {};
    }
  }

  /**
   * Get scheme benefit description
   */
  getBenefitDescription(scheme: Scheme): string {
    const details = scheme.schemeDetails || {};
    switch (scheme.schemeType) {
      case 'BUY_X_GET_Y':
        return `Buy ${details.buyQuantity} Get ${details.getQuantity}`;
      case 'EXTRA_QUANTITY':
        return `Buy ${details.buyQuantity} Get ${details.extraQty} Extra Free`;
      case 'PERCENT_DISCOUNT':
        return `${details.discountPercent}% Discount`;
      case 'FLAT_DISCOUNT':
        return `Rs ${details.discountAmount} Off`;
      default:
        return 'Special Offer';
    }
  }

  /**
   * Calculate final quantity after scheme
   */
  calculateFinalQuantity(scheme: Scheme, enteredQuantity: number): { quantity: number; freeQuantity: number } {
    const details = scheme.schemeDetails || {};
    let freeQuantity = 0;

    switch (scheme.schemeType) {
      case 'BUY_X_GET_Y':
        if (enteredQuantity >= details.buyQuantity) {
          const times = Math.floor(enteredQuantity / details.buyQuantity);
          freeQuantity = times * details.getQuantity;
        }
        break;

      case 'EXTRA_QUANTITY':
        if (enteredQuantity >= details.buyQuantity) {
          const times = Math.floor(enteredQuantity / details.buyQuantity);
          freeQuantity = times * details.extraQty;
        }
        break;
    }

    return {
      quantity: enteredQuantity + freeQuantity,
      freeQuantity
    };
  }

  /**
   * Create Smart Scheme with auto-calculated target
   */
  async createSmartScheme(data: {
    companyId: string;
    name: string;
    giftCost: number;
    marginBurnPercentage: number;
    paymentTerms: '7_days' | '15_days' | '30_days' | 'COD';
    startDate: Date;
    endDate: Date;
    productIds: string[];
    appliesTo?: 'SALES' | 'PURCHASE' | 'BOTH';
  }): Promise<Scheme> {
    try {
      const schemeData = {
        ...data,
        schemeType: 'SMART_SCHEME' as any,
        schemeDetails: {
          giftCost: data.giftCost,
          marginBurnPercentage: data.marginBurnPercentage,
          paymentTerms: data.paymentTerms,
          autoCalculateTarget: true
        },
        appliesTo: data.appliesTo || 'BOTH',
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        isActive: true,
        autoCalculateTarget: true,
        calculatedTarget: 0, // Will be calculated by backend
        isFrozen: false
      };

      const response = await api.post('/schemes/smart', schemeData);
      return response.data.data;
    } catch (error) {
      console.error('Error creating smart scheme:', error);
      throw error;
    }
  }

  /**
   * Update scheme progress for a retailer
   */
  async updateSchemeProgress(data: {
    schemeId: string;
    retailerId: string;
    invoiceAmount: number;
    paymentReceived: number;
    paymentPending: number;
  }): Promise<any> {
    try {
      const response = await api.post('/schemes/progress', data);
      return response.data.data;
    } catch (error) {
      console.error('Error updating scheme progress:', error);
      throw error;
    }
  }

  /**
   * Get retailer scheme dashboard data
   */
  async getRetailerSchemeDashboard(retailerId: string): Promise<any[]> {
    try {
      const response = await api.get(`/schemes/retailer/${retailerId}/dashboard`);
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching retailer dashboard:', error);
      throw error;
    }
  }

  /**
   * Get overdue and at-risk retailers
   */
  async getOverdueAndAtRiskRetailers(): Promise<any[]> {
    try {
      const response = await api.get('/schemes/overdue-retailers');
      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching overdue retailers:', error);
      throw error;
    }
  }

  /**
   * Freeze scheme for non-compliance
   */
  async freezeScheme(schemeId: string, retailerId: string, reason: string): Promise<void> {
    try {
      await api.post(`/schemes/${schemeId}/freeze`, { retailerId, reason });
    } catch (error) {
      console.error('Error freezing scheme:', error);
      throw error;
    }
  }

  /**
   * Release scheme (GREEN signal achieved)
   */
  async releaseScheme(schemeId: string, retailerId: string): Promise<void> {
    try {
      await api.post(`/schemes/${schemeId}/release`, { retailerId });
    } catch (error) {
      console.error('Error releasing scheme:', error);
      throw error;
    }
  }
}

export default new SchemeService();

export type SchemeCustomerRow = {
  customerId: string;
  customerName: string;
  salesSelectedPreGst: number;
  returnsPreGst: number;
  netPreGst: number;
  qualified: boolean;
  qualifiedSlabName: string | null;
};

export type SchemeEvaluation = {
  schemeId: string;
  fromDate: string;
  toDate: string;
  rows: SchemeCustomerRow[];
};
