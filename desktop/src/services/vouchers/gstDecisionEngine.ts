/**
 * GST Decision Engine - Implements the correct GST type decision logic
 * Follows the non-negotiable GST logic requirements:
 * 
 * Step 1: Resolve Party State (Priority Order)
 * 1. If GSTIN exists → take first 2 digits (state code)
 * 2. Else → Party State from profile  
 * 3. Else → Voucher address state
 * 
 * Step 2: Compare with Business GST State
 * - IF Party GSTIN is NOT present → Treat as LOCAL transaction → Apply CGST + SGST
 * - IF Party GST state code == Business GST state code → Apply CGST + SGST
 * - IF Party GST state code != Business GST state code → Apply IGST
 */

import { normalizeStateToCode } from '../../utils/stateMapping';
import { Party } from '../../types/party';

export type SupplyType = 'INTRA_STATE' | 'INTER_STATE';
export type TaxType = 'CGST_SGST' | 'IGST';

export interface PartyGSTInfo {
  stateCode: string;
  hasGSTIN: boolean;
  source: 'GSTIN' | 'PROFILE' | 'VOUCHER_ADDRESS' | 'UNKNOWN';
}

export interface GSTDecisionResult {
  supplyType: SupplyType;
  taxType: TaxType;
  partyGSTInfo: PartyGSTInfo;
  businessStateCode: string;
  isLocalTransaction: boolean;
}

/**
 * Extract state code from GSTIN (first 2 digits)
 */
export function extractStateCodeFromGSTIN(gstin: string): string {
  if (!gstin || gstin.length < 2) return '';
  
  // GSTIN format: 2-digit state code + 10-digit PAN + 1-digit check digit + 1-char status
  // First 2 digits represent the state code
  const stateCode = gstin.substring(0, 2);
  
  // Validate if it's a valid 2-digit number
  if (/^\d{2}$/.test(stateCode)) {
    return stateCode;
  }
  
  return '';
}

/**
 * Resolve party state using the priority order specified in requirements
 */
export function resolvePartyState(
  party: Party | undefined,
  voucherAddressState?: string
): PartyGSTInfo {
  if (!party) {
    return {
      stateCode: normalizeStateToCode(voucherAddressState) || '',
      hasGSTIN: false,
      source: voucherAddressState ? 'VOUCHER_ADDRESS' : 'UNKNOWN'
    };
  }

  // Priority 1: GSTIN (if exists)
  if (party.gstin && party.gstin.trim()) {
    const stateCode = extractStateCodeFromGSTIN(party.gstin);
    if (stateCode) {
      return {
        stateCode,
        hasGSTIN: true,
        source: 'GSTIN'
      };
    }
  }

  // Priority 2: Party State from profile
  if (party.state && party.state.trim()) {
    const stateCode = normalizeStateToCode(party.state);
    if (stateCode) {
      return {
        stateCode,
        hasGSTIN: Boolean(party.gstin && party.gstin.trim()),
        source: 'PROFILE'
      };
    }
  }

  // Priority 3: Voucher address state
  if (voucherAddressState && voucherAddressState.trim()) {
    const stateCode = normalizeStateToCode(voucherAddressState);
    if (stateCode) {
      return {
        stateCode,
        hasGSTIN: Boolean(party.gstin && party.gstin.trim()),
        source: 'VOUCHER_ADDRESS'
      };
    }
  }

  // No state information available
  return {
    stateCode: '',
    hasGSTIN: Boolean(party.gstin && party.gstin.trim()),
    source: 'UNKNOWN'
  };
}

/**
 * Determine GST type based on party state and business state
 * Implements the exact logic specified in requirements
 */
export function determineGSTType(
  partyGSTInfo: PartyGSTInfo,
  businessStateCode: string
): GSTDecisionResult {
  // Normalize business state code
  const normalizedBusinessState = normalizeStateToCode(businessStateCode);
  
  // Rule: IF Party GSTIN is NOT present → Treat as LOCAL transaction → Apply CGST + SGST
  if (!partyGSTInfo.hasGSTIN) {
    return {
      supplyType: 'INTRA_STATE',
      taxType: 'CGST_SGST',
      partyGSTInfo,
      businessStateCode: normalizedBusinessState,
      isLocalTransaction: true
    };
  }

  // If party state couldn't be resolved, default to inter-state for safety
  if (!partyGSTInfo.stateCode) {
    return {
      supplyType: 'INTER_STATE',
      taxType: 'IGST',
      partyGSTInfo,
      businessStateCode: normalizedBusinessState,
      isLocalTransaction: false
    };
  }

  // Compare state codes
  if (partyGSTInfo.stateCode === normalizedBusinessState) {
    // Same state → Local transaction → CGST + SGST
    return {
      supplyType: 'INTRA_STATE',
      taxType: 'CGST_SGST',
      partyGSTInfo,
      businessStateCode: normalizedBusinessState,
      isLocalTransaction: true
    };
  } else {
    // Different states → Inter-state transaction → IGST
    return {
      supplyType: 'INTER_STATE',
      taxType: 'IGST',
      partyGSTInfo,
      businessStateCode: normalizedBusinessState,
      isLocalTransaction: false
    };
  }
}

/**
 * Convenience function that combines party state resolution and GST type determination
 */
export function decideGSTType(
  party: Party | undefined,
  businessStateCode: string,
  voucherAddressState?: string
): GSTDecisionResult {
  const partyGSTInfo = resolvePartyState(party, voucherAddressState);
  return determineGSTType(partyGSTInfo, businessStateCode);
}

/**
 * Get human-readable description of the GST decision
 */
export function getGSTDecisionDescription(result: GSTDecisionResult): string {
  const { taxType, partyGSTInfo, businessStateCode, isLocalTransaction } = result;
  
  if (!partyGSTInfo.stateCode) {
    return `Party state not determined. Defaulting to ${taxType === 'CGST_SGST' ? 'CGST + SGST' : 'IGST'}`;
  }
  
  const partyStateName = partyGSTInfo.stateCode;
  const businessStateName = businessStateCode;
  
  if (isLocalTransaction) {
    return `Local transaction (Party: ${partyStateName} = Business: ${businessStateName}) → CGST + SGST`;
  } else {
    return `Inter-state transaction (Party: ${partyStateName} ≠ Business: ${businessStateName}) → IGST`;
  }
}

/**
 * Validate GST decision result
 */
export function validateGSTDecision(result: GSTDecisionResult): {
  isValid: boolean;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check if business state is set
  if (!result.businessStateCode) {
    errors.push('Business GST state is not configured');
  }
  
  // Check if party state could be determined
  if (!result.partyGSTInfo.stateCode) {
    warnings.push('Party state could not be determined - using default GST type');
  }
  
  // Check for inconsistencies
  if (result.partyGSTInfo.hasGSTIN && !result.partyGSTInfo.stateCode) {
    warnings.push('Party has GSTIN but state code could not be extracted');
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
}
