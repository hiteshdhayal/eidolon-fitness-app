/**
 * Build-time sample days for the home page's "Your state's kitchen" section
 * (spec Phase 6 §5.3). Runs the real plan engine once per state, per diet,
 * at build time — nothing here ships to the browser.
 */
import { buildPlan } from '../engine';
import { FOODS } from '../../data/foods';
import { STATE_CODES, type StateCode } from '../engine/regions';
import type { AnswersInput } from '../engine/types';

export interface KitchenMealItem {
  name: string;
  measure: string;
}

export interface KitchenMeal {
  label: string;
  items: KitchenMealItem[];
}

export interface KitchenDay {
  kcal: number;
  meals: KitchenMeal[];
}

export interface KitchenState {
  veg: KitchenDay;
  nonveg: KitchenDay;
}

function personaFor(state: StateCode, dietType: 'veg' | 'nonveg'): AnswersInput {
  return {
    sex: 'female',
    age: 30,
    heightCm: 160,
    weightKg: 60,
    goal: 'healthier',
    trainingDays: 'none',
    steps: '3-6k',
    mealPattern: '3',
    foodSource: 'family',
    cuisineMix: 'mostlyMine',
    budget: 'moderate',
    supplements: 'foodOnly',
    conditions: [],
    medications: [],
    restrictions: [],
    state,
    dietType,
    meats: dietType === 'nonveg' ? ['chicken', 'fish', 'eggs'] : [],
  };
}

const KCAL_ROUND = 50;

function dayFromPlan(answers: AnswersInput): KitchenDay {
  const plan = buildPlan(answers, FOODS);
  const day = plan.days[0];
  if (!day) {
    throw new Error(`sampleDays: engine returned no days for ${JSON.stringify(answers)}`);
  }
  return {
    kcal: Math.round(day.kcal / KCAL_ROUND) * KCAL_ROUND,
    meals: day.meals.map((meal) => ({
      label: meal.label,
      items: meal.items.map((item) => ({ name: item.name, measure: item.measure })),
    })),
  };
}

function buildKitchen(): Record<StateCode, KitchenState> {
  const result = {} as Record<StateCode, KitchenState>;
  for (const state of STATE_CODES) {
    result[state] = {
      veg: dayFromPlan(personaFor(state, 'veg')),
      nonveg: dayFromPlan(personaFor(state, 'nonveg')),
    };
  }
  return result;
}

/** Keyed by state code; computed once at module load (build time). */
export const KITCHEN_SAMPLES: Record<StateCode, KitchenState> = buildKitchen();
