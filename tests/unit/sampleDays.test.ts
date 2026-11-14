import { describe, expect, it } from 'vitest';
import { KITCHEN_SAMPLES } from '../../src/lib/home/sampleDays';
import { buildPlan } from '../../src/lib/engine';
import { STATE_CODES } from '../../src/lib/engine/regions';
import { FOODS } from '../../src/data/foods';
import type { AnswersInput } from '../../src/lib/engine/types';

const HR_VEG_ANSWERS: AnswersInput = {
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
  state: 'HR',
  dietType: 'veg',
  meats: [],
};

const NON_VEG_NAMES = new Set(FOODS.filter((f) => !f.diet.veg).map((f) => f.name));

describe('sampleDays (home kitchen)', () => {
  it('covers all 36 states', () => {
    expect(Object.keys(KITCHEN_SAMPLES)).toHaveLength(36);
    for (const code of STATE_CODES) expect(KITCHEN_SAMPLES[code]).toBeDefined();
  });

  it('produces 3 meals for every state, in both diets', () => {
    for (const code of STATE_CODES) {
      expect(KITCHEN_SAMPLES[code].veg.meals).toHaveLength(3);
      expect(KITCHEN_SAMPLES[code].nonveg.meals).toHaveLength(3);
    }
  });

  it('veg days contain no non-veg items', () => {
    for (const code of STATE_CODES) {
      for (const meal of KITCHEN_SAMPLES[code].veg.meals) {
        for (const item of meal.items) {
          expect(NON_VEG_NAMES.has(item.name)).toBe(false);
        }
      }
    }
  });

  it('every item has a non-empty name and measure, and kcal rounds to 50', async () => {
    for (const code of STATE_CODES) {
      for (const diet of ['veg', 'nonveg'] as const) {
        const day = KITCHEN_SAMPLES[code][diet];
        expect(day.kcal % 50).toBe(0);
        for (const meal of day.meals) {
          expect(meal.label.length).toBeGreaterThan(0);
          for (const item of meal.items) {
            expect(item.name.length).toBeGreaterThan(0);
            expect(item.measure.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('is deterministic across runs', () => {
    // The module itself is computed once at import time; re-running the same
    // engine call with the same persona (what the module does per state) must
    // give byte-identical output, with no clock- or Math.random-driven drift.
    const first = buildPlan(HR_VEG_ANSWERS, FOODS);
    const second = buildPlan(HR_VEG_ANSWERS, FOODS);
    expect(JSON.stringify(first.days[0])).toBe(JSON.stringify(second.days[0]));
  });
});
