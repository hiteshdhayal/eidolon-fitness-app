import type { AnswersInput } from '../../src/lib/engine/types';

/** A neutral adult used as the base for most tests; override what matters. */
export const BASE: AnswersInput = {
  goal: 'lose',
  sex: 'male',
  age: 28,
  heightCm: 175,
  weightKg: 82,
  conditions: [],
  medications: [],
  trainingDays: '3-4',
  trainingType: ['gym'],
  steps: '6-9k',
  state: 'HR',
  cuisineMix: 'mostlyMine',
  dietType: 'veg',
  meats: [],
  restrictions: [],
  foodSource: 'family',
  mealPattern: '3+snacks',
  budget: 'moderate',
  supplements: 'foodOnly',
};

export const make = (over: Partial<AnswersInput>): AnswersInput => ({ ...BASE, ...over });

/** The six personas from spec §23, phase 3. */
export const PERSONAS = {
  vegHaryanaMale: BASE,
  keralaPcosNonveg: make({
    sex: 'female',
    age: 31,
    heightCm: 158,
    weightKg: 68,
    state: 'KL',
    dietType: 'nonveg',
    meats: ['fish', 'eggs', 'chicken'],
    conditions: ['pcos'],
    trainingDays: '1-2',
    steps: '3-6k',
    mealPattern: '3',
  }),
  jainGujarat: make({
    sex: 'female',
    age: 40,
    heightCm: 160,
    weightKg: 64,
    state: 'GJ',
    dietType: 'jain',
    goal: 'healthier',
    trainingDays: 'none',
    trainingType: [],
    steps: '3-6k',
  }),
  teen: make({ age: 16, weightKg: 60, heightCm: 170, targetWeightKg: 45 }),
  pregnant: make({
    sex: 'female',
    age: 29,
    heightCm: 160,
    weightKg: 62,
    conditions: ['pregnant'],
    state: 'TN',
  }),
  hostel: make({ foodSource: 'hostel', state: 'KA', age: 20, weightKg: 70 }),
} satisfies Record<string, AnswersInput>;

export const NOW = new Date('2026-11-13T00:00:00Z');
