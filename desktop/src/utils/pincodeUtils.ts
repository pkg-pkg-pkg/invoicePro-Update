/**
 * Pincode Utilities for auto-fetching State and District
 * This uses a hardcoded pincode master for offline operation
 */

export interface PincodeInfo {
  pincode: string;
  district: string;
  state: string;
  region: string;
}

// Sample pincode master - in production, this would be loaded from database
// This is a representative sample for major pincodes in India
const PINCODE_MASTER: Record<string, PincodeInfo> = {
  // Karnataka
  '560001': { pincode: '560001', district: 'Bengaluru', state: 'Karnataka', region: 'Urban' },
  '560002': { pincode: '560002', district: 'Bengaluru', state: 'Karnataka', region: 'Urban' },
  '560034': { pincode: '560034', district: 'Bengaluru', state: 'Karnataka', region: 'Urban' },
  '560100': { pincode: '560100', district: 'Bengaluru', state: 'Karnataka', region: 'Urban' },
  '575001': { pincode: '575001', district: 'Mangalore', state: 'Karnataka', region: 'Urban' },
  '580001': { pincode: '580001', district: 'Belgaum', state: 'Karnataka', region: 'Urban' },

  // Tamil Nadu
  '600001': { pincode: '600001', district: 'Chennai', state: 'Tamil Nadu', region: 'Urban' },
  '600004': { pincode: '600004', district: 'Chennai', state: 'Tamil Nadu', region: 'Urban' },
  '600032': { pincode: '600032', district: 'Chennai', state: 'Tamil Nadu', region: 'Urban' },
  '641001': { pincode: '641001', district: 'Coimbatore', state: 'Tamil Nadu', region: 'Urban' },
  '638001': { pincode: '638001', district: 'Salem', state: 'Tamil Nadu', region: 'Urban' },

  // Maharashtra
  '400001': { pincode: '400001', district: 'Mumbai', state: 'Maharashtra', region: 'Urban' },
  '400002': { pincode: '400002', district: 'Mumbai', state: 'Maharashtra', region: 'Urban' },
  '400005': { pincode: '400005', district: 'Mumbai', state: 'Maharashtra', region: 'Urban' },
  '400019': { pincode: '400019', district: 'Mumbai', state: 'Maharashtra', region: 'Urban' },
  '411001': { pincode: '411001', district: 'Pune', state: 'Maharashtra', region: 'Urban' },
  '411046': { pincode: '411046', district: 'Pune', state: 'Maharashtra', region: 'Urban' },
  '440001': { pincode: '440001', district: 'Nagpur', state: 'Maharashtra', region: 'Urban' },

  // Telangana
  '500001': { pincode: '500001', district: 'Hyderabad', state: 'Telangana', region: 'Urban' },
  '500002': { pincode: '500002', district: 'Hyderabad', state: 'Telangana', region: 'Urban' },
  '500004': { pincode: '500004', district: 'Hyderabad', state: 'Telangana', region: 'Urban' },
  '500017': { pincode: '500017', district: 'Hyderabad', state: 'Telangana', region: 'Urban' },

  // Uttar Pradesh
  '201001': { pincode: '201001', district: 'Gautam Budh Nagar', state: 'Uttar Pradesh', region: 'Suburban' },
  '110001': { pincode: '110001', district: 'New Delhi', state: 'Delhi', region: 'Urban' },
  '110002': { pincode: '110002', district: 'New Delhi', state: 'Delhi', region: 'Urban' },
  '110011': { pincode: '110011', district: 'New Delhi', state: 'Delhi', region: 'Urban' },

  // Rajasthan
  '302001': { pincode: '302001', district: 'Jaipur', state: 'Rajasthan', region: 'Urban' },
  '302002': { pincode: '302002', district: 'Jaipur', state: 'Rajasthan', region: 'Urban' },
  '302005': { pincode: '302005', district: 'Jaipur', state: 'Rajasthan', region: 'Urban' },

  // Gujarat
  '380001': { pincode: '380001', district: 'Ahmedabad', state: 'Gujarat', region: 'Urban' },
  '380009': { pincode: '380009', district: 'Ahmedabad', state: 'Gujarat', region: 'Urban' },
  '390001': { pincode: '390001', district: 'Indore', state: 'Madhya Pradesh', region: 'Urban' },

  // Haryana
  '121001': { pincode: '121001', district: 'Faridabad', state: 'Haryana', region: 'Urban' },
  '122001': { pincode: '122001', district: 'Noida', state: 'Haryana', region: 'Urban' },

  // Kerala
  '682001': { pincode: '682001', district: 'Kochi', state: 'Kerala', region: 'Urban' },
  '682002': { pincode: '682002', district: 'Kochi', state: 'Kerala', region: 'Urban' },
  '695001': { pincode: '695001', district: 'Thiruvananthapuram', state: 'Kerala', region: 'Urban' },

  // West Bengal
  '700001': { pincode: '700001', district: 'Kolkata', state: 'West Bengal', region: 'Urban' },
  '700014': { pincode: '700014', district: 'Kolkata', state: 'West Bengal', region: 'Urban' },
};

/**
 * Look up pincode and return state + district
 * Returns null if pincode not found
 */
export const lookupPincode = (pincode: string): PincodeInfo | null => {
  if (!pincode) return null;

  // Try exact match first
  if (PINCODE_MASTER[pincode]) {
    return { ...PINCODE_MASTER[pincode] };
  }

  // In production, you could query database here
  // For now, return null for not found
  return null;
};

/**
 * Check if pincode exists in master
 */
export const isPincodeValid = (pincode: string): boolean => {
  if (!pincode) return false;
  return !!PINCODE_MASTER[pincode.trim()];
};

/**
 * Get all pincodes for a specific state
 */
export const getPincodesForState = (state: string): PincodeInfo[] => {
  return Object.values(PINCODE_MASTER).filter((p) => p.state === state);
};

/**
 * Get all pincodes for a specific district
 */
export const getPincodesForDistrict = (state: string, district: string): PincodeInfo[] => {
  return Object.values(PINCODE_MASTER).filter((p) => p.state === state && p.district === district);
};

/**
 * Get unique list of states
 */
export const getAllStates = (): string[] => {
  const states = new Set<string>();
  Object.values(PINCODE_MASTER).forEach((p) => states.add(p.state));
  return Array.from(states).sort();
};

/**
 * Get unique list of districts for a state
 */
export const getDistrictsForState = (state: string): string[] => {
  const districts = new Set<string>();
  Object.values(PINCODE_MASTER).forEach((p) => {
    if (p.state === state) {
      districts.add(p.district);
    }
  });
  return Array.from(districts).sort();
};
