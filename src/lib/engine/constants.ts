/**
 * Every number the engine uses, in one place (spec §7).
 * Each constant says where it comes from so a dietitian can tune it.
 * Change values here, then run `pnpm test`; the tests check behaviour,
 * not these exact numbers, unless the spec fixes them.
 */
import type { Goal } from './types';

// ---------------------------------------------------------------- BMI (§7.2)
/** WHO Asia-Pacific cut-offs, the ones used in India. Upper bounds, exclusive. */
export const BMI_CUTOFFS = {
  underweight: 18.5, // < 18.5
  healthy: 23, // 18.5 – 22.9
  overweight: 25, // 23 – 24.9
  // 25 and above: obese
} as const;

/** Lowest BMI a target weight may imply (§7.1). */
export const MIN_TARGET_BMI = 18.5;

/** Above this BMI, protein is based on the weight at this BMI (§7.2). */
export const REFERENCE_WEIGHT_BMI = 25;

// ---------------------------------------------------------------- BMR (§7.2)
/** Mifflin-St Jeor: 10w + 6.25h − 5a + s. "unspecified" is the midpoint. */
export const BMR_SEX_CONSTANT = { male: 5, female: -161, unspecified: -78 } as const;

// ------------------------------------------------------- Activity (§7.2)
/** Base factor from the person's weekly average step count. */
export const STEPS_BASE_FACTOR = {
  lt3k: 1.2,
  '3-6k': 1.3,
  '6-9k': 1.4,
  '9-12k': 1.5,
  gt12k: 1.6,
} as const;

/** Used when steps = "Not sure". */
export const DAY_TYPE_FACTOR = {
  sitting: 1.2,
  someWalking: 1.3,
  onFeet: 1.45,
  physical: 1.6,
} as const;

/** Added on top of the steps factor for planned training. */
export const TRAINING_ADD = { none: 0, '1-2': 0.05, '3-4': 0.1, '5-6': 0.15, '7': 0.2 } as const;

/** Activity factor never goes above this. */
export const MAX_ACTIVITY_FACTOR = 1.9;

// ------------------------------------------------ Goal adjustment (§7.2)
export const FAT_LOSS_DEFICIT_PCT = 0.2; // −20% of TDEE …
export const FAT_LOSS_DEFICIT_PCT_LEAN = 0.15; // … −15% if BMI < 23
export const GENTLE_MAX_DEFICIT_PCT = 0.1; // gentle mode: at most −10%
export const MAX_DEFICIT_KCAL = 500; // never more than −500 kcal/day
export const MUSCLE_SURPLUS_KCAL = 250; // build muscle with BMI < 23
export const GAIN_SURPLUS_PCT = 0.15; // gain weight: +15% …
export const MAX_SURPLUS_KCAL = 500; // … capped at +500

/**
 * Loss-rate cap (§7.1): never more than 1% of body weight a week.
 * About 7,700 kcal per kg of body fat, so the daily deficit is capped at
 * weight × 0.01 × 7700 / 7 ≈ 11 kcal per kg of body weight.
 */
export const KCAL_PER_KG_FAT = 7700;
export const MAX_WEEKLY_LOSS_PCT = 0.01;

/** Calorie floor: never below max(BMR, this). */
export const KCAL_FLOOR = { female: 1200, male: 1500, unspecified: 1350 } as const;
export const KCAL_ROUND_TO = 50;

// ------------------------------------------------------- Protein (§7.2)
/** g per kg of reference weight. */
export const PROTEIN_G_PER_KG = {
  none: 1.0,
  '1-2': 1.2,
  '3-4': 1.4,
  high: 1.6, // training 5+ days, or goal = build muscle
} as const;
export const PROTEIN_FAT_LOSS_ADD = 0.2;
export const PROTEIN_MAX_G_PER_KG = 1.8;
export const PROTEIN_MIN_G_PER_KG_50_PLUS = 1.0;
export const PROTEIN_ROUND_TO = 5;

// ----------------------------------------------------- Fat / carbs (§7.2)
export const FAT_PCT_DEFAULT = 0.25; // spec range 25–30%
export const FAT_PCT_LOWER_CARB = 0.3; // top of the range, so carbs stay ≤ 45%
/** Soft ceiling for fat when carbs are held at 45%; exceeded only when protein is low. */
export const FAT_PCT_MAX_LOWER_CARB = 0.35;
export const FAT_MIN_G_PER_KG = 0.6;
export const LOWER_CARB_MAX_PCT = 0.45;
/** Conditions that get the lower-carb, low-GI treatment. */
export const LOWER_CARB_CONDITIONS = ['pcos', 'diabetes', 'fattyLiver', 'cholesterol'] as const;

// ------------------------------------------------------- Fiber, water, salt
/** 14 g per 1,000 kcal (common guideline), clamped to the spec's 25–40 g. */
export const FIBER_G_PER_1000_KCAL = 14;
export const FIBER_MIN_G = 25;
export const FIBER_MAX_G = 40;
export const WATER_ML_PER_KG = 35;
export const WATER_TRAINING_DAY_EXTRA_ML = 500;
export const WATER_ROUND_TO = 100;
/** ICMR-NIN 2024 and WHO: under 5 g salt a day. */
export const SALT_MAX_G = 5;

// --------------------------------------------------------- Steps (§7.2)
/** Midpoint of each band; "gt12k" uses its lower edge. */
export const STEPS_MIDPOINT = {
  lt3k: 2000,
  '3-6k': 4500,
  '6-9k': 7500,
  '9-12k': 10500,
  gt12k: 12000,
} as const;
/** Rough current steps when the person isn't sure. */
export const DAY_TYPE_STEPS = {
  sitting: 3000,
  someWalking: 5000,
  onFeet: 8000,
  physical: 10000,
} as const;
export const STEPS_INCREASE = 2000;
export const STEPS_TARGET_CAP = 10000;

// --------------------------------------------------------- Safety (§7.1)
export const ADULT_AGE = 18;
export const OLDER_ADULT_AGE = 65;
export const PROTEIN_FLOOR_AGE = 50;

// ------------------------------------------------- Meal split (§7.3)
export const MEAL_SPLITS = {
  '3': [
    ['breakfast', 0.3],
    ['lunch', 0.4],
    ['dinner', 0.3],
  ],
  '3+snacks': [
    ['breakfast', 0.25],
    ['midMorning', 0.1],
    ['lunch', 0.3],
    ['eveningSnack', 0.1],
    ['dinner', 0.25],
  ],
  '2': [
    ['brunch', 0.45],
    ['eveningSnack', 0.15],
    ['dinner', 0.4],
  ],
} as const;

export const MEAL_LABELS = {
  breakfast: 'Breakfast',
  midMorning: 'Mid-morning',
  brunch: 'Brunch',
  lunch: 'Lunch',
  eveningSnack: 'Evening snack',
  dinner: 'Dinner',
} as const;

/** Suggested times. Dinner leaves 2–3 hours before a typical 11 pm bedtime. */
export const MEAL_TIMES = {
  breakfast: '8:00 am',
  midMorning: '11:00 am',
  brunch: '11:00 am',
  lunch: '1:30 pm',
  eveningSnack: '5:00 pm',
  dinner: '8:00 pm',
} as const;

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

// ----------------------------------------- Meal generation (§7.3)
/** Daily kcal must land within ±7% of target. */
export const DAY_KCAL_TOLERANCE = 0.07;
/** Daily protein must reach at least 90% of target. */
export const DAY_PROTEIN_MIN_RATIO = 0.9;
/** Share of dishes from the person's state/region. */
export const REGION_SHARE_MIN = { mostlyMine: 0.7, mixIn: 0.5 } as const;
/** Chance each pick is regional, before the repair pass tops it up. */
export const REGION_PICK_PROB = { mostlyMine: 0.8, mixIn: 0.55 } as const;
export const MAX_MAIN_PER_WEEK = 2;
export const MAX_OCCASIONAL_PER_WEEK = 1;
/** Protein add-ons the engine may add per day to reach the protein target. */
export const MAX_ADDONS_PER_DAY = 4;
/** Re-pick attempts for a day that misses the kcal/protein window. */
export const MAX_DAY_ATTEMPTS = 8;
/** Lunch/dinner: chance of "curry + staple + side" vs "one-pot dish + side". */
export const CURRY_TEMPLATE_PROB = 0.7;

/** Selection weights (relative). */
export const WEIGHTS = {
  stateMatch: 4,
  regionMatch: 1.5,
  pan: 1,
  /** Dishes from a different region (only picked for "mix in", or as a last resort). */
  otherRegion: 0.4,
  /** Budget levels above the person's comfort zone. */
  budgetStretch: 0.3,
  /** High-GI items for lower-carb conditions. */
  highGiLowerCarb: 0.25,
  /** Preferred staple for a curry (e.g. makki roti with sarson saag). */
  pairsWith: 5,
  /** Fried/rich items for cholesterol, fatty liver or heart conditions. */
  friedForHeart: 0.2,
} as const;

/** Max budget level allowed per budget answer; the level just below is fully weighted. */
export const BUDGET_MAX = { cheap: 2, moderate: 3, flexible: 3 } as const;
export const BUDGET_COMFORT = { cheap: 1, moderate: 2, flexible: 3 } as const;

export const GOAL_LABELS: Record<Goal, string> = {
  lose: 'Lose fat',
  muscle: 'Build muscle',
  healthier: 'Eat healthier and get fitter',
  gain: 'Gain weight',
};

export const DISCLAIMER =
  'This plan is general guidance, not medical advice. Check with your doctor, especially if you have a medical condition or take medicines.';
