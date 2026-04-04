/**
 * Scheme Resolution Engine
 * Determines which schemes are applicable for a given product, transaction type, and date
 *
 * Core Rule: Product-wise only, never at bill level
 * Conditions for applicability:
 * 1. Scheme is active (is_active = true)
 * 2. Transaction date is between start_date and end_date
 * 3. Product is mapped in scheme_products
 * 4. applies_to matches transaction type (SALES, PURCHASE, or BOTH)
 */

import { Scheme } from './schemeService';

export interface SchemeResolutionContext {
  productId: string;
  quantity: number;
  txnType: 'SALES' | 'PURCHASE';
  txnDate: Date;
  schemes: Scheme[];
}

export interface ApplicableScheme {
  scheme: Scheme;
  benefit: {
    type: string;
    description: string;
    value: number;
    freeQuantity?: number;
  };
}

/**
 * Resolve applicable schemes for a product in a transaction
 * Filters schemes by:
 * - Active status
 * - Date range
 * - Product mapping
 * - Transaction type applicability
 *
 * @param context - Resolution context with product, qty, type, date, available schemes
 * @returns Array of applicable schemes with calculated benefits
 */
export function getApplicableSchemes(
  context: SchemeResolutionContext
): ApplicableScheme[] {
  const { productId, quantity, txnType, txnDate, schemes } = context;

  return schemes
    .filter((scheme) => {
      // Rule 1: Scheme must be active
      if (!scheme.isActive) return false;

      // Rule 2: Transaction date must be within scheme validity
      const startDate = new Date(scheme.startDate);
      const endDate = new Date(scheme.endDate);
      if (txnDate < startDate || txnDate > endDate) return false;

      // Rule 3: Product must be mapped in scheme
      const productMapped = scheme.products?.some(
        (sp) => sp.productId === productId
      );
      if (!productMapped) return false;

      // Rule 4: Transaction type must match scheme applicability
      if (
        scheme.appliesTo !== 'BOTH' &&
        scheme.appliesTo !== txnType
      ) {
        return false;
      }

      return true;
    })
    .map((scheme) => {
      const benefit = calculateSchemeBenefit(scheme, quantity);
      return {
        scheme,
        benefit,
      };
    });
}

/**
 * Calculate scheme benefit for a given quantity
 * Handles all scheme types: BUY_X_GET_Y, FLAT_DISCOUNT, PERCENT_DISCOUNT, EXTRA_QUANTITY
 *
 * @param scheme - Scheme to calculate benefit for
 * @param quantity - Quantity of product
 * @returns Benefit object with type, description, and calculated value
 */
function calculateSchemeBenefit(
  scheme: Scheme,
  quantity: number
): ApplicableScheme['benefit'] {
  const details = scheme.schemeDetails || {};

  switch (scheme.schemeType) {
    case 'BUY_X_GET_Y': {
      // Example: Buy 10 Get 1 means for every 10 units, get 1 free
      const buyQty = details.buyQuantity || 1;
      const getQty = details.getQuantity || 0;
      let freeQuantity = 0;

      if (quantity >= buyQty) {
        const times = Math.floor(quantity / buyQty);
        freeQuantity = times * getQty;
      }

      return {
        type: 'BUY_X_GET_Y',
        description: `Buy ${buyQty} Get ${getQty}`,
        value: freeQuantity,
        freeQuantity,
      };
    }

    case 'EXTRA_QUANTITY': {
      // Example: Buy 10 Get 2 Extra Free (different from BUY_X_GET_Y in terminology)
      const buyQty = details.buyQuantity || 1;
      const extraQty = details.extraQty || 0;
      let freeQuantity = 0;

      if (quantity >= buyQty) {
        const times = Math.floor(quantity / buyQty);
        freeQuantity = times * extraQty;
      }

      return {
        type: 'EXTRA_QUANTITY',
        description: `Buy ${buyQty} Get ${extraQty} Extra`,
        value: freeQuantity,
        freeQuantity,
      };
    }

    case 'PERCENT_DISCOUNT': {
      // Example: 15% discount
      const percent = details.discountPercent || 0;
      return {
        type: 'PERCENT_DISCOUNT',
        description: `${percent}% Discount`,
        value: percent,
      };
    }

    case 'FLAT_DISCOUNT': {
      // Example: Rs 100 off
      const amount = details.discountAmount || 0;
      return {
        type: 'FLAT_DISCOUNT',
        description: `Rs ${amount} Off`,
        value: amount,
      };
    }

    default:
      return {
        type: 'UNKNOWN',
        description: 'Special Offer',
        value: 0,
      };
  }
}

/**
 * Check if a scheme is currently valid (not expired)
 *
 * @param scheme - Scheme to check
 * @param checkDate - Date to check against (defaults to today)
 * @returns True if scheme is active and within validity period
 */
export function isSchemeValid(scheme: Scheme, checkDate = new Date()): boolean {
  if (!scheme.isActive) return false;

  const startDate = new Date(scheme.startDate);
  const endDate = new Date(scheme.endDate);

  return checkDate >= startDate && checkDate <= endDate;
}

/**
 * Get all schemes applicable to a product for a transaction type
 * Useful for showing user a list of available schemes
 *
 * @param productId - Product ID
 * @param txnType - Transaction type (SALES or PURCHASE)
 * @param schemes - Available schemes
 * @param asOfDate - Check schemes as of this date (defaults to today)
 * @returns Schemes applicable to this product and transaction type
 */
export function getSchemesByProductAndType(
  productId: string,
  txnType: 'SALES' | 'PURCHASE',
  schemes: Scheme[],
  asOfDate = new Date()
): Scheme[] {
  return schemes.filter((scheme) => {
    // Check active and date range
    if (!isSchemeValid(scheme, asOfDate)) return false;

    // Check product mapping
    const productMapped = scheme.products?.some(
      (sp) => sp.productId === productId
    );
    if (!productMapped) return false;

    // Check transaction type applicability
    if (
      scheme.appliesTo !== 'BOTH' &&
      scheme.appliesTo !== txnType
    ) {
      return false;
    }

    return true;
  });
}

/**
 * Find the best scheme (highest benefit) for a product
 * Returns the first scheme if multiple have same benefit
 *
 * @param productId - Product ID
 * @param quantity - Quantity of product
 * @param txnType - Transaction type
 * @param schemes - Available schemes
 * @param txnDate - Transaction date
 * @returns Best applicable scheme or null
 */
export function getBestScheme(
  productId: string,
  quantity: number,
  txnType: 'SALES' | 'PURCHASE',
  schemes: Scheme[],
  txnDate = new Date()
): ApplicableScheme | null {
  const applicable = getApplicableSchemes({
    productId,
    quantity,
    txnType,
    txnDate,
    schemes,
  });

  if (applicable.length === 0) return null;

  // For simplicity, return the first applicable scheme
  // In production, you might want to implement logic to find the "best" scheme
  // based on benefit value (highest benefit first)
  return applicable[0];
}

/**
 * Calculate final quantity after applying a scheme
 * Used to compute the total quantity customer receives (including free qty)
 *
 * @param scheme - Scheme to apply
 * @param enteredQuantity - Quantity entered by user
 * @returns Total quantity (entered + free from scheme)
 */
export function calculateFinalQuantity(
  scheme: Scheme,
  enteredQuantity: number
): { totalQuantity: number; freeQuantity: number } {
  const details = scheme.schemeDetails || {};
  let freeQuantity = 0;

  switch (scheme.schemeType) {
    case 'BUY_X_GET_Y':
    case 'EXTRA_QUANTITY': {
      const buyQty = details.buyQuantity || 1;
      const freeQty =
        details.getQuantity || details.extraQty || 0;

      if (enteredQuantity >= buyQty) {
        const times = Math.floor(enteredQuantity / buyQty);
        freeQuantity = times * freeQty;
      }
      break;
    }

    default:
      // Discount schemes don't affect quantity
      freeQuantity = 0;
  }

  return {
    totalQuantity: enteredQuantity + freeQuantity,
    freeQuantity,
  };
}
