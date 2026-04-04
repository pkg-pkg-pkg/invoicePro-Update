/**
 * GSTIN Utilities for auto-fetching state and validating format
 */

// State codes in GSTIN (first 2 digits)
const STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '25': 'Daman & Diu',
  '26': 'Dadra & Nagar Haveli',
  '27': 'Maharashtra',
  '28': 'Andhra Pradesh (Old)',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh (New)',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Centre Jurisdiction',
};

/**
 * Validate GSTIN format
 * GSTIN Format: 2 char state code + 10 char entity PAN + 1 char entity type + 1 char check digit
 * Total: 15 characters
 */
export const validateGSTIN = (gstin: string): boolean => {
  if (!gstin) return false;
  
  // Remove spaces and convert to uppercase
  const cleanedGstin = gstin.trim().toUpperCase();
  
  // Check length
  if (cleanedGstin.length !== 15) return false;
  
  // Check if first 2 chars are numeric
  if (!/^\d{2}/.test(cleanedGstin)) return false;
  
  // Check if valid state code
  const stateCode = cleanedGstin.substring(0, 2);
  if (!STATE_CODES[stateCode]) return false;
  
  // Check remaining chars are alphanumeric
  if (!/^[A-Z0-9]*$/.test(cleanedGstin)) return false;
  
  return true;
};

/**
 * Extract state from GSTIN
 * Returns state name if valid GSTIN, null otherwise
 */
export const extractStateFromGSTIN = (gstin: string): string | null => {
  if (!validateGSTIN(gstin)) return null;
  
  const stateCode = gstin.trim().substring(0, 2);
  return STATE_CODES[stateCode] || null;
};

/**
 * Get all state codes and names
 */
export const getStateCodes = (): Record<string, string> => {
  return { ...STATE_CODES };
};

/**
 * Abbreviate state names to commonly used 2-letter codes
 */
export const getStateAbbreviation = (stateName: string): string => {
  const abbreviations: Record<string, string> = {
    'Andhra Pradesh': 'AP',
    'Arunachal Pradesh': 'AR',
    'Assam': 'AS',
    'Bihar': 'BR',
    'Chhattisgarh': 'CG',
    'Goa': 'GA',
    'Gujarat': 'GJ',
    'Haryana': 'HR',
    'Himachal Pradesh': 'HP',
    'Jharkhand': 'JH',
    'Karnataka': 'KA',
    'Kerala': 'KL',
    'Madhya Pradesh': 'MP',
    'Maharashtra': 'MH',
    'Manipur': 'MN',
    'Meghalaya': 'ML',
    'Mizoram': 'MZ',
    'Nagaland': 'NL',
    'Odisha': 'OD',
    'Punjab': 'PB',
    'Rajasthan': 'RJ',
    'Sikkim': 'SK',
    'Tamil Nadu': 'TN',
    'Telangana': 'TS',
    'Tripura': 'TR',
    'Uttar Pradesh': 'UP',
    'Uttarakhand': 'UT',
    'West Bengal': 'WB',
    'Jammu and Kashmir': 'JK',
    'Ladakh': 'LA',
  };
  return abbreviations[stateName] || stateName;
};
