/**
 * All 28 states and 8 union territories, each mapped to one food region.
 * Spec §8 "Region map". The questionnaire's state picker reads STATES;
 * the engine uses regionOf() to weight dishes.
 *
 * Region choices that are a judgement call are noted inline and in
 * docs/DECISIONS.md.
 */

export const REGIONS = ['north', 'west', 'south', 'east', 'northeast', 'central'] as const;
export type Region = (typeof REGIONS)[number];

/** "pan" = eaten across India; never counts toward the regional share. */
export type FoodRegion = Region | 'pan';

export const STATE_CODES = [
  // States (28)
  'AP',
  'AR',
  'AS',
  'BR',
  'CG',
  'GA',
  'GJ',
  'HR',
  'HP',
  'JH',
  'KA',
  'KL',
  'MP',
  'MH',
  'MN',
  'ML',
  'MZ',
  'NL',
  'OD',
  'PB',
  'RJ',
  'SK',
  'TN',
  'TS',
  'TR',
  'UP',
  'UK',
  'WB',
  // Union territories (8)
  'AN',
  'CH',
  'DH',
  'DL',
  'JK',
  'LA',
  'LD',
  'PY',
] as const;
export type StateCode = (typeof STATE_CODES)[number];

export interface StateInfo {
  code: StateCode;
  name: string;
  kind: 'state' | 'ut';
  region: Region;
}

export const STATES: readonly StateInfo[] = [
  { code: 'AP', name: 'Andhra Pradesh', kind: 'state', region: 'south' },
  { code: 'AR', name: 'Arunachal Pradesh', kind: 'state', region: 'northeast' },
  { code: 'AS', name: 'Assam', kind: 'state', region: 'northeast' },
  { code: 'BR', name: 'Bihar', kind: 'state', region: 'east' },
  { code: 'CG', name: 'Chhattisgarh', kind: 'state', region: 'central' },
  { code: 'GA', name: 'Goa', kind: 'state', region: 'west' },
  { code: 'GJ', name: 'Gujarat', kind: 'state', region: 'west' },
  { code: 'HR', name: 'Haryana', kind: 'state', region: 'north' },
  { code: 'HP', name: 'Himachal Pradesh', kind: 'state', region: 'north' },
  { code: 'JH', name: 'Jharkhand', kind: 'state', region: 'east' },
  { code: 'KA', name: 'Karnataka', kind: 'state', region: 'south' },
  { code: 'KL', name: 'Kerala', kind: 'state', region: 'south' },
  { code: 'MP', name: 'Madhya Pradesh', kind: 'state', region: 'central' },
  { code: 'MH', name: 'Maharashtra', kind: 'state', region: 'west' },
  { code: 'MN', name: 'Manipur', kind: 'state', region: 'northeast' },
  { code: 'ML', name: 'Meghalaya', kind: 'state', region: 'northeast' },
  { code: 'MZ', name: 'Mizoram', kind: 'state', region: 'northeast' },
  { code: 'NL', name: 'Nagaland', kind: 'state', region: 'northeast' },
  { code: 'OD', name: 'Odisha', kind: 'state', region: 'east' },
  { code: 'PB', name: 'Punjab', kind: 'state', region: 'north' },
  // Rajasthan is grouped with the West, as in spec §8.
  { code: 'RJ', name: 'Rajasthan', kind: 'state', region: 'west' },
  { code: 'SK', name: 'Sikkim', kind: 'state', region: 'northeast' },
  { code: 'TN', name: 'Tamil Nadu', kind: 'state', region: 'south' },
  { code: 'TS', name: 'Telangana', kind: 'state', region: 'south' },
  { code: 'TR', name: 'Tripura', kind: 'state', region: 'northeast' },
  { code: 'UP', name: 'Uttar Pradesh', kind: 'state', region: 'north' },
  { code: 'UK', name: 'Uttarakhand', kind: 'state', region: 'north' },
  { code: 'WB', name: 'West Bengal', kind: 'state', region: 'east' },
  // Andaman & Nicobar: large Bengali and Tamil populations; rice-and-fish
  // home cooking fits the East pool best.
  { code: 'AN', name: 'Andaman and Nicobar Islands', kind: 'ut', region: 'east' },
  { code: 'CH', name: 'Chandigarh', kind: 'ut', region: 'north' },
  { code: 'DH', name: 'Dadra and Nagar Haveli and Daman and Diu', kind: 'ut', region: 'west' },
  { code: 'DL', name: 'Delhi', kind: 'ut', region: 'north' },
  { code: 'JK', name: 'Jammu and Kashmir', kind: 'ut', region: 'north' },
  { code: 'LA', name: 'Ladakh', kind: 'ut', region: 'north' },
  // Lakshadweep cooking is close to Kerala's (coconut, fish, rice).
  { code: 'LD', name: 'Lakshadweep', kind: 'ut', region: 'south' },
  { code: 'PY', name: 'Puducherry', kind: 'ut', region: 'south' },
];

const BY_CODE = new Map<StateCode, StateInfo>(STATES.map((s) => [s.code, s]));

export function stateInfo(code: StateCode): StateInfo {
  const info = BY_CODE.get(code);
  if (!info) throw new Error(`Unknown state code: ${code}`);
  return info;
}

export function regionOf(code: StateCode): Region {
  return stateInfo(code).region;
}
