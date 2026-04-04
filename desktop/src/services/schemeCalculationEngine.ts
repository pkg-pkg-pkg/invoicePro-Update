import { Scheme } from './schemeService';
import { Product } from '../store/slices/productSlice';

export interface MarginData {
  totalMarginAvailable: number; // %
  marginBurnedInScheme: number; // %
  netMarginRemaining: number; // %
  marginValue: number; // ₹
}

export interface SchemeProgress {
  targetAmount: number;
  achievedAmount: number;
  paymentReceived: number;
  paymentPending: number;
  status: 'red' | 'yellow' | 'green';
  daysRemaining: number;
  progressPercentage: number;
}

export interface SchemeCalculation {
  calculatedTarget: number;
  marginBurnPercentage: number;
  giftCost: number;
  paymentTerms: '7_days' | '15_days' | '30_days' | 'COD';
}

/**
 * Smart Scheme Calculation Engine
 * Handles all auto-calculations for margins, targets, and progress
 */
class SchemeCalculationEngine {
  
  /**
   * Calculate real-time margin for a product
   * @param costPrice - Product cost price from master
   * @param sellingPrice - Current selling price in invoice
   * @returns Margin percentage and value
   */
  calculateRealtimeMargin(costPrice: number, sellingPrice: number): MarginData {
    if (sellingPrice <= 0 || costPrice <= 0) {
      return {
        totalMarginAvailable: 0,
        marginBurnedInScheme: 0,
        netMarginRemaining: 0,
        marginValue: 0
      };
    }

    // Calculate exact margin percentage
    const marginPercentage = ((sellingPrice - costPrice) / sellingPrice) * 100;
    const marginValue = sellingPrice - costPrice;

    return {
      totalMarginAvailable: Math.round(marginPercentage * 100) / 100, // Round to 2 decimal
      marginBurnedInScheme: 0, // Will be set by scheme
      netMarginRemaining: Math.round(marginPercentage * 100) / 100,
      marginValue: Math.round(marginValue * 100) / 100
    };
  }

  /**
   * Auto-calculate scheme target from gift cost and margin burn percentage
   * @param giftCost - Cost of the gift/trip in ₹
   * @param marginBurnPercentage - Percentage of margin to burn for scheme
   * @returns Calculated target amount
   */
  calculateAutoTarget(giftCost: number, marginBurnPercentage: number): number {
    if (marginBurnPercentage <= 0) return 0;
    
    // Formula: Target = Gift Cost ÷ (Margin % / 100)
    const target = giftCost / (marginBurnPercentage / 100);
    return Math.round(target * 100) / 100; // Round to 2 decimal
  }

  /**
   * Calculate scheme progress for a retailer
   * @param scheme - Scheme details
   * @param achievedAmount - Total billing achieved by retailer
   * @param paymentReceived - Total payment received
   * @param paymentPending - Total payment pending
   * @param schemeEndDate - Scheme end date
   * @returns Complete progress data
   */
  calculateSchemeProgress(
    scheme: Scheme,
    achievedAmount: number,
    paymentReceived: number,
    paymentPending: number,
    schemeEndDate: Date
  ): SchemeProgress {
    const targetAmount = scheme.calculatedTarget || this.calculateAutoTarget(
      scheme.giftCost || 0,
      scheme.marginBurnPercentage || 0
    );

    const progressPercentage = targetAmount > 0 ? (achievedAmount / targetAmount) * 100 : 0;
    const totalBilling = achievedAmount;
    const totalPayment = paymentReceived + paymentPending;

    // Determine status based on strict RED/YELLOW/GREEN logic
    let status: 'red' | 'yellow' | 'green' = 'red';

    if (achievedAmount >= targetAmount && paymentPending === 0) {
      // GREEN: Target achieved + 100% payment cleared
      status = 'green';
    } else if (achievedAmount >= targetAmount && paymentPending > 0) {
      // YELLOW: Target achieved but payment pending
      status = 'yellow';
    } else {
      // RED: Target not achieved OR payment issues
      status = 'red';
    }

    // Calculate days remaining
    const today = new Date();
    const daysRemaining = Math.max(0, Math.ceil((schemeEndDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      targetAmount,
      achievedAmount,
      paymentReceived,
      paymentPending,
      status,
      daysRemaining,
      progressPercentage: Math.round(progressPercentage * 100) / 100
    };
  }

  /**
   * Check if retailer is at risk of missing scheme
   * @param progress - Current scheme progress
   * @param daysRemaining - Days left in scheme
   * @returns Risk assessment
   */
  assessRisk(progress: SchemeProgress, daysRemaining: number): {
    isAtRisk: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    requiredDailyBilling: number;
  } {
    const remainingAmount = progress.targetAmount - progress.achievedAmount;
    const requiredDailyBilling = daysRemaining > 0 ? remainingAmount / daysRemaining : 0;

    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let isAtRisk = false;

    if (progress.status === 'red' && daysRemaining < 30) {
      riskLevel = 'critical';
      isAtRisk = true;
    } else if (progress.status === 'red' && daysRemaining < 60) {
      riskLevel = 'high';
      isAtRisk = true;
    } else if (progress.progressPercentage < 50 && daysRemaining < 90) {
      riskLevel = 'medium';
      isAtRisk = true;
    }

    return {
      isAtRisk,
      riskLevel,
      requiredDailyBilling: Math.round(requiredDailyBilling * 100) / 100
    };
  }

  /**
   * Calculate margin burned in current invoice
   * @param invoiceItems - Items in current invoice
   * @param schemeMarginBurn - Margin burn percentage for scheme
   * @returns Total margin burned in this invoice
   */
  calculateMarginBurnedInInvoice(
    invoiceItems: Array<{ productId: string; quantity: number; sellingPrice: number; costPrice: number }>,
    schemeMarginBurn: number
  ): MarginData {
    let totalMarginBurned = 0;
    let totalMarginAvailable = 0;

    invoiceItems.forEach(item => {
      const margin = this.calculateRealtimeMargin(item.costPrice, item.sellingPrice);
      totalMarginAvailable += margin.totalMarginAvailable * item.quantity;
      totalMarginBurned += (margin.totalMarginAvailable * schemeMarginBurn / 100) * item.quantity;
    });

    return {
      totalMarginAvailable: Math.round(totalMarginAvailable * 100) / 100,
      marginBurnedInScheme: Math.round(totalMarginBurned * 100) / 100,
      netMarginRemaining: Math.round((totalMarginAvailable - totalMarginBurned) * 100) / 100,
      marginValue: Math.round(totalMarginBurned * 100) / 100
    };
  }

  /**
   * Validate payment terms compliance
   * @param paymentDueDate - When payment is due
   * @param paymentReceived - Amount received
   * @param totalDue - Total amount due
   * @returns Compliance status
   */
  validatePaymentTerms(
    paymentDueDate: Date,
    paymentReceived: number,
    totalDue: number
  ): {
    isCompliant: boolean;
    daysOverdue: number;
    shouldFreezeScheme: boolean;
  } {
    const today = new Date();
    const daysOverdue = Math.max(0, Math.ceil((today.getTime() - paymentDueDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    const isCompliant = paymentReceived >= totalDue && daysOverdue === 0;
    const shouldFreezeScheme = !isCompliant; // Strict: immediately freeze on non-compliance

    return {
      isCompliant,
      daysOverdue,
      shouldFreezeScheme
    };
  }
}

export default new SchemeCalculationEngine();
