/**
 * Engine types (spec §7.5). Each type is inferred from its zod schema in
 * schema.ts, so the runtime check and the compile-time type can't drift.
 */
import type { z } from 'zod';
import type {
  AnswersSchema,
  DayPlanSchema,
  GroceryItemSchema,
  GroceryListSchema,
  GuidanceSchema,
  MealItemSchema,
  MealSchema,
  PlanSchema,
  PlateGuideSchema,
  SafetyResultSchema,
  TargetsSchema,
  CONDITIONS,
  DIET_TYPES,
  GOALS,
  MEAL_SLOTS,
  MEDICATIONS,
  MODES,
  BMI_BANDS,
  GROCERY_CATEGORIES,
} from './schema';

/** What the questionnaire produces (after zod defaults are applied). */
export type Answers = z.output<typeof AnswersSchema>;
/** What a caller may pass in (defaults not yet applied). */
export type AnswersInput = z.input<typeof AnswersSchema>;

export type SafetyResult = z.infer<typeof SafetyResultSchema>;
export type Targets = z.infer<typeof TargetsSchema>;
export type MealItem = z.infer<typeof MealItemSchema>;
export type Meal = z.infer<typeof MealSchema>;
export type DayPlan = z.infer<typeof DayPlanSchema>;
export type GroceryItem = z.infer<typeof GroceryItemSchema>;
export type GroceryList = z.infer<typeof GroceryListSchema>;
export type PlateGuide = z.infer<typeof PlateGuideSchema>;
export type Guidance = z.infer<typeof GuidanceSchema>;
export type Plan = z.infer<typeof PlanSchema>;

export type Goal = (typeof GOALS)[number];
export type Condition = (typeof CONDITIONS)[number];
export type Medication = (typeof MEDICATIONS)[number];
export type DietType = (typeof DIET_TYPES)[number];
export type Mode = (typeof MODES)[number];
export type MealSlot = (typeof MEAL_SLOTS)[number];
export type BmiBand = (typeof BMI_BANDS)[number];
export type GroceryCategory = (typeof GROCERY_CATEGORIES)[number];
