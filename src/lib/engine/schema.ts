/**
 * zod schemas for everything the engine reads or returns (spec §7.5).
 * Answers are validated before the engine runs; Plan is validated when it
 * is read back from localStorage in Phase 3.
 *
 * Written against the zod 3 API that also works in zod 4.
 */
import { z } from 'zod';
import { STATE_CODES } from './regions';

// ---------------------------------------------------------------------------
// Answers (spec §6.2). Ids match the questionnaire question ids.
// ---------------------------------------------------------------------------

export const GOALS = ['lose', 'muscle', 'healthier', 'gain'] as const;
export const SEXES = ['male', 'female', 'unspecified'] as const;

export const FEMALE_CONDITIONS = [
  'pcos',
  'hypothyroid',
  'hyperthyroid',
  'anaemia',
  'vitaminDB12',
  'diabetes',
  'highBP',
  'cholesterol',
  'fattyLiver',
  'acidityIBS',
  'menopause',
  'pregnant',
  'breastfeeding',
  'kidney',
  'heart',
] as const;
export const MALE_CONDITIONS = [
  'diabetes',
  'highBP',
  'cholesterol',
  'fattyLiver',
  'uricAcid',
  'thyroid',
  'vitaminDB12',
  'acidityIBS',
  'kidney',
  'heart',
] as const;
/** Union of both lists ("Prefer not to say" sees all of these). */
export const CONDITIONS = [
  'pcos',
  'hypothyroid',
  'hyperthyroid',
  'anaemia',
  'vitaminDB12',
  'diabetes',
  'highBP',
  'cholesterol',
  'fattyLiver',
  'acidityIBS',
  'menopause',
  'pregnant',
  'breastfeeding',
  'kidney',
  'heart',
  'uricAcid',
  'thyroid',
] as const;

export const DIABETES_TYPES = ['pre', 'type2', 'type1', 'unsure'] as const;
export const MEDICATIONS = [
  'diabetesTablets',
  'insulin',
  'thyroid',
  'bp',
  'cholesterol',
  'other',
] as const;
export const TRAINING_DAYS = ['none', '1-2', '3-4', '5-6', '7'] as const;
export const TRAINING_TYPES = ['gym', 'home', 'cardio', 'sports', 'yoga'] as const;
export const STEP_BANDS = ['lt3k', '3-6k', '6-9k', '9-12k', 'gt12k', 'unsure'] as const;
export const DAY_TYPES = ['sitting', 'someWalking', 'onFeet', 'physical'] as const;
export const CUISINE_MIX = ['mostlyMine', 'mixIn'] as const;
export const DIET_TYPES = ['veg', 'eggetarian', 'nonveg', 'vegan', 'jain'] as const;
export const MEATS = ['chicken', 'fish', 'eggs', 'mutton', 'pork', 'beef'] as const;
export const RESTRICTIONS = [
  'lactose',
  'noDairy',
  'glutenFree',
  'peanut',
  'treeNut',
  'soy',
  'noOnionGarlic',
] as const;
export const FOOD_SOURCES = ['self', 'family', 'hostel', 'eatOut'] as const;
export const MEAL_PATTERNS = ['3', '3+snacks', '2'] as const;
export const BUDGETS = ['cheap', 'moderate', 'flexible'] as const;
export const SUPPLEMENTS = ['foodOnly', 'open'] as const;

const stateEnum = z.enum(STATE_CODES);

export const AnswersSchema = z
  .object({
    goal: z.enum(GOALS),
    sex: z.enum(SEXES),
    age: z.number().int().min(13).max(90),
    heightCm: z.number().min(120).max(220),
    /** Only remembers which unit the person typed in; the engine uses heightCm. */
    heightUnit: z.enum(['cm', 'ftin']).optional(),
    weightKg: z.number().min(30).max(250),
    targetWeightKg: z.number().min(30).max(250).optional(),

    conditions: z.array(z.enum(CONDITIONS)), // [] = "None of these"
    diabetesType: z.enum(DIABETES_TYPES).optional(),
    medications: z.array(z.enum(MEDICATIONS)), // [] = "None"

    trainingDays: z.enum(TRAINING_DAYS),
    trainingType: z.array(z.enum(TRAINING_TYPES)).default([]),
    steps: z.enum(STEP_BANDS),
    dayType: z.enum(DAY_TYPES).optional(),

    state: z.union([stateEnum, z.literal('OUT')]),
    homeRegion: stateEnum.optional(),
    cuisineMix: z.enum(CUISINE_MIX),
    dietType: z.enum(DIET_TYPES),
    meats: z.array(z.enum(MEATS)).default([]),
    restrictions: z.array(z.enum(RESTRICTIONS)).default([]),
    foodSource: z.enum(FOOD_SOURCES),
    mealPattern: z.enum(MEAL_PATTERNS),
    budget: z.enum(BUDGETS),
    supplements: z.enum(SUPPLEMENTS).default('foodOnly'),
    firstName: z.string().trim().max(40).optional(),
  })
  .superRefine((a, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    // weight has one decimal place at most
    if (Math.round(a.weightKg * 10) !== a.weightKg * 10)
      issue('weightKg', 'Use at most one decimal place.');

    if (a.conditions.includes('diabetes') && !a.diabetesType)
      issue('diabetesType', 'Required when diabetes is picked.');
    if (a.steps === 'unsure' && !a.dayType) issue('dayType', 'Required when steps = Not sure.');
    if (a.state === 'OUT' && !a.homeRegion)
      issue('homeRegion', 'Required when living outside India.');
    if (a.dietType === 'nonveg' && a.meats.length === 0) issue('meats', 'Pick at least one.');

    const allowed: readonly string[] =
      a.sex === 'male' ? MALE_CONDITIONS : a.sex === 'female' ? FEMALE_CONDITIONS : CONDITIONS;
    for (const c of a.conditions)
      if (!allowed.includes(c)) issue('conditions', `"${c}" isn't offered for this sex option.`);
  });

// ---------------------------------------------------------------------------
// Engine outputs
// ---------------------------------------------------------------------------

export const MODES = ['full', 'gentle', 'guidance'] as const;

export const SafetyReasonSchema = z.object({
  code: z.string(),
  message: z.string(),
});

export const SafetyResultSchema = z.object({
  mode: z.enum(MODES),
  reasons: z.array(SafetyReasonSchema),
  /** Largest calorie deficit allowed, as a fraction of TDEE (0 = maintenance only). */
  maxDeficitPct: z.number().min(0).max(0.2),
  /** Goal after safety rules; may differ from what the person picked. */
  effectiveGoal: z.enum(GOALS),
  goalChanged: z.boolean(),
  targetWeightRejected: z.boolean(),
  minHealthyWeightKg: z.number(),
  spreadCarbsEvenly: z.boolean(),
  showProteinTarget: z.boolean(),
  showNumbers: z.boolean(),
});

export const BMI_BANDS = ['underweight', 'healthy', 'overweight', 'obese'] as const;

export const ExplainStepSchema = z.object({ title: z.string(), text: z.string() });

export const TargetsSchema = z.object({
  bmi: z.number(),
  bmiBand: z.enum(BMI_BANDS),
  bmr: z.number(),
  activityFactor: z.number(),
  tdee: z.number(),
  goalAdjustmentKcal: z.number(),
  kcal: z.number(),
  protein: z.number(),
  proteinPerKg: z.number(),
  referenceWeightKg: z.number(),
  fat: z.number(),
  carbs: z.number(),
  carbPct: z.number(),
  fiber: z.number(),
  waterMl: z.number(),
  waterMlTrainingDay: z.number(),
  saltG: z.number(),
  stepsTarget: z.number(),
  lowerCarb: z.boolean(),
  /** Protein the formula asked for, before the food-feasibility check. */
  proteinRequested: z.number(),
  proteinLowered: z.boolean(),
  explain: z.array(ExplainStepSchema),
});

export const MealItemSchema = z.object({
  foodId: z.string(),
  name: z.string(),
  gloss: z.string(),
  role: z.string(),
  multiplier: z.number(),
  measure: z.string(),
  grams: z.number(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  notes: z.array(z.string()),
});

export const MEAL_SLOTS = [
  'breakfast',
  'midMorning',
  'brunch',
  'lunch',
  'eveningSnack',
  'dinner',
] as const;

export const MealSchema = z.object({
  slot: z.enum(MEAL_SLOTS),
  label: z.string(),
  time: z.string(),
  targetKcal: z.number(),
  items: z.array(MealItemSchema),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
});

export const DayPlanSchema = z.object({
  index: z.number().int().min(0).max(6),
  label: z.string(),
  meals: z.array(MealSchema),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  /** Bumped by "Shuffle day" so the same day can be regenerated deterministically. */
  shuffle: z.number().int().min(0),
});

export const GROCERY_CATEGORIES = [
  'grains',
  'dals',
  'dairy',
  'vegetables',
  'fruits',
  'protein',
  'spicesOil',
] as const;

export const GroceryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(GROCERY_CATEGORIES),
  /** e.g. "about 1.2 kg"; empty when only the ingredient is known. */
  amount: z.string(),
  uses: z.number().int().min(1),
});

export const GroceryListSchema = z.object({
  categories: z.array(
    z.object({
      id: z.enum(GROCERY_CATEGORIES),
      label: z.string(),
      items: z.array(GroceryItemSchema),
    }),
  ),
});

export const PlateGuideSchema = z.object({
  baseRule: z.string(),
  portions: z.array(z.string()),
  messTips: z.array(z.string()),
  orderingGuide: z.array(z.object({ place: z.string(), tip: z.string() })),
  proteinTips: z.array(z.string()),
});

export const GuidanceSchema = z.object({
  headline: z.string(),
  mealIdeas: z.object({
    breakfast: z.array(z.string()),
    lunch: z.array(z.string()),
    dinner: z.array(z.string()),
    snack: z.array(z.string()),
  }),
  proteinFoods: z.array(z.string()),
  tips: z.array(z.string()),
});

export const PlanSchema = z.object({
  version: z.literal(1),
  seed: z.number().int(),
  createdAt: z.string(),
  kind: z.enum(['recipes', 'plateRules', 'guidance']),
  safety: SafetyResultSchema,
  /** null in guidance mode: no numbers are shown. */
  targets: TargetsSchema.nullable(),
  days: z.array(DayPlanSchema),
  plateGuide: PlateGuideSchema.nullable(),
  guidance: GuidanceSchema.nullable(),
  regionShare: z.number().nullable(),
  healthNoteIds: z.array(z.string()),
  notes: z.array(z.string()),
  disclaimer: z.string(),
});
