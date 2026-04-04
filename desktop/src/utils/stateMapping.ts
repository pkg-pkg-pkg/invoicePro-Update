/**
 * GST State Code to State Name Mapping
 * Used for proper state comparison in GST bifurcation
 */

export const STATE_CODE_TO_NAME: Record<string, string> = {
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
  '11': 'Jharkhand',
  '12': 'Odisha',
  '13': 'West Bengal',
  '14': 'Sikkim',
  '15': 'Arunachal Pradesh',
  '16': 'Nagaland',
  '17': 'Manipur',
  '18': 'Mizoram',
  '19': 'Tripura',
  '20': 'Meghalaya',
  '21': 'Assam',
  '22': 'Meghalaya',
  '23': 'Manipur',
  '24': 'Telangana',
  '25': 'Andhra Pradesh',
  '26': 'Karnataka',
  '27': 'Tamil Nadu',
  '28': 'Kerala',
  '29': 'Karnataka',
  '30': 'Telangana',
  '31': 'Lakshadweep',
  '32': 'Puducherry',
  '33': 'Andaman & Nicobar',
  '34': 'Dadra & Nagar Haveli',
  '35': 'Daman & Diu',
  '36': 'Dadra and Nagar Haveli and Daman and Diu',
  '37': 'Ladakh',
};

export const STATE_NAME_TO_CODE: Record<string, string> = {
  'Jammu & Kashmir': '01',
  'Himachal Pradesh': '02',
  'Punjab': '03',
  'Chandigarh': '04',
  'Uttarakhand': '05',
  'Haryana': '06',
  'Delhi': '07',
  'Rajasthan': '08',
  'Uttar Pradesh': '09',
  'Bihar': '10',
  'Jharkhand': '11',
  'Odisha': '12',
  'West Bengal': '13',
  'Sikkim': '14',
  'Arunachal Pradesh': '15',
  'Nagaland': '16',
  'Manipur': '17',
  'Mizoram': '18',
  'Tripura': '19',
  'Meghalaya': '20',
  'Assam': '21',
  'Telangana': '24',
  'Andhra Pradesh': '25',
  'Karnataka': '29',
  'Tamil Nadu': '27',
  'Kerala': '28',
  'Lakshadweep': '31',
  'Puducherry': '32',
  'Andaman & Nicobar': '33',
  'Dadra & Nagar Haveli': '34',
  'Daman & Diu': '35',
  'Dadra and Nagar Haveli and Daman and Diu': '36',
  'Ladakh': '37',
};

/**
 * Normalize state to state code for comparison
 * Handles both state names and state codes
 * @param state State name or state code
 * @returns State code (2-digit string)
 */
export function normalizeStateToCode(state: string | undefined): string {
  if (!state) return '';
  
  const trimmed = state.trim();
  
  // If already a 2-digit code, return it
  if (/^\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Otherwise, try to look it up as a state name
  const code = STATE_NAME_TO_CODE[trimmed];
  if (code) {
    return code;
  }
  
  // Try case-insensitive match
  for (const [name, code] of Object.entries(STATE_NAME_TO_CODE)) {
    if (name.toLowerCase() === trimmed.toLowerCase()) {
      return code;
    }
  }
  
  return '';
}

/**
 * Get state name from code
 * @param code State code (2-digit string)
 * @returns State name or the code itself if not found
 */
export function getStateNameFromCode(code: string): string {
  if (!code) return '';
  const name = STATE_CODE_TO_NAME[code];
  return name || code;
}

/**
 * Compare two states for equality (handles both names and codes)
 * @param state1 First state (name or code)
 * @param state2 Second state (name or code)
 * @returns true if states are the same
 */
export function statesMatch(state1: string | undefined, state2: string | undefined): boolean {
  if (!state1 || !state2) return false;
  const code1 = normalizeStateToCode(state1);
  const code2 = normalizeStateToCode(state2);
  return code1 === code2 && code1 !== '';
}
