/**
 * Plan engine entry point (spec §7). Pure TypeScript, no DOM, deterministic.
 *
 *   import { buildPlan } from "~/lib/engine";
 *   const { FOODS } = await import("~/data/foods"); // lazy (spec §17)
 *   const plan = buildPlan(answers, FOODS);
 */
import type { Food } from '../../data/foods/schema';
import { DAY_PROTEIN_MIN_RATIO, DISCLAIMER, PROTEIN_ROUND_TO } from './constants';
import { buildContext, type FoodContext } from './filter';
import {
  buildPools,
  fromDayPlan,
  generateWeek,
  regionShare,
  toDayPlan,
  dayTotals,
  type DayDraft,
} from './generate';
import { buildGroceryList } from './grocery';
import { buildGuidance } from './guidance';
import { selectHealthNotes } from './healthNotes';
import { floorTo } from './numbers';
import { buildPlateGuide } from './plate';
import { hashAnswers } from './rng';
import { runSafetyGate } from './safety';
import { AnswersSchema } from './schema';
import { computeTargets, explainTargets } from './targets';
import type { Answers, AnswersInput, GroceryList, Plan, Targets } from './types';

export interface BuildOptions {
  /** Injected for tests; defaults to now. */
  now?: Date;
}

const DIET_WORDS: Record<Answers['dietType'], string> = {
  veg: 'vegetarian',
  eggetarian: 'eggetarian',
  nonveg: 'non-vegetarian',
  vegan: 'vegan',
  jain: 'Jain',
};

/**
 * Feasibility check (§7.2): the protein food alone can reach on this plan,
 * or null if the target is already reachable.
 */
function realisticProtein(t: Targets, days: DayDraft[]): number | null {
  const proteins = days.map((d) => dayTotals(d).protein);
  if (!proteins.some((p) => p < DAY_PROTEIN_MIN_RATIO * t.protein)) return null;
  const avg = proteins.reduce((s, p) => s + p, 0) / proteins.length;
  const min = Math.min(...proteins);
  const realistic = Math.max(
    PROTEIN_ROUND_TO,
    floorTo(Math.min(avg, min / DAY_PROTEIN_MIN_RATIO), PROTEIN_ROUND_TO),
  );
  return realistic < t.protein ? realistic : null;
}

function lowerProtein(t: Targets, realistic: number): Targets {
  const carbs = Math.max(0, Math.round((t.kcal - realistic * 4 - t.fat * 9) / 4));
  return {
    ...t,
    protein: realistic,
    proteinLowered: true,
    carbs,
    carbPct: Math.round(((carbs * 4) / t.kcal) * 100),
  };
}

function feasibilityNote(a: Answers, requested: number, realistic: number): string {
  const budget = a.budget === 'cheap' ? ' on a tight budget' : '';
  let note = `With ${DIET_WORDS[a.dietType]} food${budget}, about ${realistic} g of protein a day is realistic from food alone, so I've set your target there (the formula asked for ${requested} g).`;
  if (a.supplements === 'open') {
    note +=
      " If you want to close the gap, one scoop of whey or plant protein (about 20–25 g) a day would do it. It's optional.";
  }
  return note;
}

function basePlan(
  seed: number,
  now: Date,
): Pick<Plan, 'version' | 'seed' | 'createdAt' | 'disclaimer'> {
  return { version: 1, seed, createdAt: now.toISOString(), disclaimer: DISCLAIMER };
}

export function buildPlan(
  input: AnswersInput,
  foods: readonly Food[],
  opts: BuildOptions = {},
): Plan {
  const a = AnswersSchema.parse(input);
  const seed = hashAnswers(a);
  const now = opts.now ?? new Date();
  const safety = runSafetyGate(a);
  const ctx = buildContext(a, foods);
  const healthNoteIds = selectHealthNotes(a);
  const notes: string[] = [];
  const base = basePlan(seed, now);

  if (safety.mode === 'guidance') {
    return {
      ...base,
      kind: 'guidance',
      safety,
      targets: null,
      days: [],
      plateGuide: null,
      guidance: buildGuidance(ctx, safety),
      regionShare: null,
      healthNoteIds,
      notes,
    };
  }

  let targets = computeTargets(a, safety);
  if (safety.spreadCarbsEvenly)
    notes.push(
      'Keep your meal times regular and your carbs spread across the day, as this plan does.',
    );

  if (a.foodSource === 'hostel' || a.foodSource === 'eatOut') {
    return {
      ...base,
      kind: 'plateRules',
      safety,
      targets,
      days: [],
      plateGuide: buildPlateGuide(ctx, targets),
      guidance: null,
      regionShare: null,
      healthNoteIds,
      notes,
    };
  }

  const pools = buildPools(ctx);
  let drafts = generateWeek(ctx, pools, { kcal: targets.kcal, protein: targets.protein }, seed);
  // If food can't reach the protein target, lower it and re-plan against the
  // realistic number (so portions aren't pushed past the calorie goal).
  for (let round = 0; round < 3; round++) {
    const realistic = realisticProtein(targets, drafts);
    if (realistic === null) break;
    targets = lowerProtein(targets, realistic);
    drafts = generateWeek(ctx, pools, { kcal: targets.kcal, protein: targets.protein }, seed);
  }
  if (targets.proteinLowered) {
    notes.push(feasibilityNote(a, targets.proteinRequested, targets.protein));
    targets.explain = explainTargets(
      a,
      safety,
      targets,
      Math.round(((targets.fat * 9) / targets.kcal) * 100),
    );
  }

  return {
    ...base,
    kind: 'recipes',
    safety,
    targets,
    days: drafts.map((d, i) => toDayPlan(d, i, 0, ctx)),
    plateGuide: null,
    guidance: null,
    regionShare: Math.round(regionShare(drafts, ctx) * 100) / 100,
    healthNoteIds,
    notes,
  };
}

/** Grocery list for a stored plan (Groceries tab). */
export function groceryListFor(
  plan: Plan,
  answers: AnswersInput,
  foods: readonly Food[],
): GroceryList {
  const a = AnswersSchema.parse(answers);
  const byId = new Map(foods.map((f) => [f.id, f]));
  return buildGroceryList(
    plan.days.map((d) => fromDayPlan(d, byId)),
    a,
  );
}

/** Context for UI helpers that need the filtered food list (e.g. the home-page sample day). */
export function foodContext(answers: AnswersInput, foods: readonly Food[]): FoodContext {
  return buildContext(AnswersSchema.parse(answers), foods);
}

export { runSafetyGate } from './safety';
export { computeTargets } from './targets';
export { bmi, bmiBand, bmr, activityFactor, tdee } from './numbers';
export { getSwaps, applySwap, shuffleDay, primaryItemIndex, type SwapOption } from './swap';
export { selectHealthNotes, matchesAppliesTo, HEALTH_NOTE_RULES } from './healthNotes';
export { STATES, REGIONS, regionOf, stateInfo } from './regions';
export { AnswersSchema, PlanSchema } from './schema';
export type * from './types';
