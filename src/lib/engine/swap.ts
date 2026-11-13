/**
 * "Swap" and "Shuffle day" (spec §7.3). Both are pure: they take a plan
 * and return a new one; nothing is mutated.
 */
import type { Food } from '../../data/foods/schema';
import { MAX_MAIN_PER_WEEK } from './constants';
import { buildContext, isRegional, preference, type FoodContext } from './filter';
import {
  buildPools,
  clampToGrid,
  fromDayPlan,
  generateDay,
  isMain,
  newWeekState,
  poolFor,
  recordDay,
  scale,
  toDayPlan,
  type DayDraft,
} from './generate';
import { measureText } from './format';
import { AnswersSchema } from './schema';
import type { AnswersInput, Plan } from './types';

export interface SwapOption {
  foodId: string;
  name: string;
  gloss: string;
  measure: string;
  multiplier: number;
  kcal: number;
  protein: number;
}

function setup(answers: AnswersInput, foods: readonly Food[]) {
  const a = AnswersSchema.parse(answers);
  const ctx = buildContext(a, foods);
  const byId = new Map(foods.map((f) => [f.id, f]));
  return { a, ctx, byId, pools: buildPools(ctx) };
}

/** The item a meal-level swap replaces: the main dish, or the first item. */
export function primaryItemIndex(plan: Plan, dayIndex: number, mealIndex: number): number {
  const items = plan.days[dayIndex]?.meals[mealIndex]?.items ?? [];
  const i = items.findIndex((it) => it.role === 'complete' || it.role === 'curry');
  return i >= 0 ? i : 0;
}

/**
 * Three alternatives with similar calories and protein for one item.
 * Defaults to the meal's main dish.
 */
export function getSwaps(
  plan: Plan,
  answers: AnswersInput,
  foods: readonly Food[],
  dayIndex: number,
  mealIndex: number,
  itemIndex = primaryItemIndex(plan, dayIndex, mealIndex),
): SwapOption[] {
  const { ctx, byId, pools } = setup(answers, foods);
  const day = plan.days[dayIndex];
  const meal = day?.meals[mealIndex];
  const item = meal?.items[itemIndex];
  if (!day || !meal || !item) return [];
  const current = byId.get(item.foodId);
  if (!current) return [];

  const usedToday = new Set(day.meals.flatMap((m) => m.items.map((it) => it.foodId)));
  const weekMains = new Map<string, number>();
  for (const d of plan.days)
    for (const m of d.meals)
      for (const it of m.items) weekMains.set(it.foodId, (weekMains.get(it.foodId) ?? 0) + 1);

  const kcalNow = current.perServing.kcal * item.multiplier;
  const protNow = current.perServing.protein * item.multiplier;
  const pool =
    item.role === 'addon'
      ? pools.addon[current.slots.includes('snack') ? 'snack' : 'lunch']
      : poolFor(pools, meal.slot, current);

  return pool
    .filter((f) => f.id !== current.id && !usedToday.has(f.id))
    .filter((f) =>
      item.role === 'addon' ? true : f.role === current.role || (isMain(f) && isMain(current)),
    )
    .filter((f) => !isMain(f) || (weekMains.get(f.id) ?? 0) < MAX_MAIN_PER_WEEK)
    .map((f) => {
      const m = clampToGrid(f, kcalNow / f.perServing.kcal);
      const k = f.perServing.kcal * m;
      const p = f.perServing.protein * m;
      let score =
        Math.abs(k - kcalNow) / kcalNow + (0.6 * Math.abs(p - protNow)) / Math.max(protNow, 8);
      if (isRegional(f, ctx)) score *= 0.85;
      score /= Math.sqrt(preference(f, ctx));
      return { f, m, k, p, score };
    })
    .sort((x, y) => x.score - y.score || x.f.id.localeCompare(y.f.id))
    .slice(0, 3)
    .map(({ f, m, k, p }) => ({
      foodId: f.id,
      name: f.name,
      gloss: f.gloss,
      measure: measureText(f, m),
      multiplier: m,
      kcal: Math.round(k / 10) * 10,
      protein: Math.round(p),
    }));
}

function rebuildDayTotals(plan: Plan, dayIndex: number, draft: DayDraft, ctx: FoodContext): Plan {
  const days = plan.days.map((d, i) =>
    i === dayIndex ? toDayPlan(draft, d.index, d.shuffle, ctx) : d,
  );
  return { ...plan, days };
}

/** Replace one item with a chosen swap option. */
export function applySwap(
  plan: Plan,
  answers: AnswersInput,
  foods: readonly Food[],
  dayIndex: number,
  mealIndex: number,
  itemIndex: number,
  option: Pick<SwapOption, 'foodId' | 'multiplier'>,
): Plan {
  const { ctx, byId } = setup(answers, foods);
  const day = plan.days[dayIndex];
  const food = byId.get(option.foodId);
  if (!day || !food) return plan;
  const draft = fromDayPlan(day, byId);
  const meal = draft.meals[mealIndex];
  const old = meal?.comps[itemIndex];
  if (!meal || !old) return plan;
  meal.comps[itemIndex] = { food, m: option.multiplier, addon: old.addon };
  return rebuildDayTotals(plan, dayIndex, draft, ctx);
}

/** Regenerate one day with a new seed, keeping the week's variety rules. */
export function shuffleDay(
  plan: Plan,
  answers: AnswersInput,
  foods: readonly Food[],
  dayIndex: number,
): Plan {
  const { a, ctx, byId, pools } = setup(answers, foods);
  if (plan.kind !== 'recipes' || !plan.targets) return plan;
  const day = plan.days[dayIndex];
  if (!day) return plan;

  const week = newWeekState();
  plan.days.forEach((d, i) => {
    if (i !== dayIndex) recordDay(week, fromDayPlan(d, byId));
  });
  const t = { kcal: plan.targets.kcal, protein: plan.targets.protein };
  const shuffle = day.shuffle + 1;
  const draft = generateDay(ctx, pools, week, t, a.mealPattern, plan.seed, dayIndex, shuffle);
  scale(draft, t);
  const days = plan.days.map((d, i) =>
    i === dayIndex ? toDayPlan(draft, dayIndex, shuffle, ctx) : d,
  );
  return { ...plan, days };
}
