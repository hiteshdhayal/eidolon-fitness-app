/**
 * Meal generation (spec §7.3).
 *
 * For each day:
 *   1. pick dishes for every meal (region-weighted, variety rules)
 *   2. scale portions in household steps toward each meal's calorie share
 *   3. if protein is short, add protein add-ons (curd, paneer, eggs …)
 *      and re-scale
 *   4. if the day still misses ±7% kcal or 90% protein, re-pick it
 * After the week: top up the regional share to ≥ 70% (≥ 50% for "mix in").
 */
import type { Food, FoodSlot } from '../../data/foods/schema';
import {
  CURRY_TEMPLATE_PROB,
  DAY_KCAL_TOLERANCE,
  DAY_LABELS,
  DAY_PROTEIN_MIN_RATIO,
  MAX_ADDONS_PER_DAY,
  MAX_DAY_ATTEMPTS,
  MAX_MAIN_PER_WEEK,
  MAX_OCCASIONAL_PER_WEEK,
  MEAL_LABELS,
  MEAL_SPLITS,
  MEAL_TIMES,
  REGION_PICK_PROB,
  REGION_SHARE_MIN,
  WEIGHTS,
} from './constants';
import { DISH_ROLES, isRegional, preference, regionClass, type FoodContext } from './filter';
import { measureText } from './format';
import { createRng, subSeed, type Rng } from './rng';
import type { Answers, DayPlan, Meal, MealItem, MealSlot } from './types';

// ---------------------------------------------------------------- types
export interface Comp {
  food: Food;
  m: number;
  addon: boolean;
}
export interface MealDraft {
  slot: MealSlot;
  target: number;
  comps: Comp[];
}
export interface DayDraft {
  meals: MealDraft[];
}
export interface WeekState {
  mainCount: Map<string, number>;
  snackCount: Map<string, number>;
  occasional: number;
}
interface DayTargets {
  kcal: number;
  protein: number;
}

export const isMain = (f: Food) => f.role === 'complete' || f.role === 'curry';

/**
 * Animal-protein "family" of a food, so a day never stacks egg breakfast +
 * egg curry + egg roast. Veg foods have no family.
 */
export function proteinFamily(f: Food): string | null {
  const c = f.contains;
  if (c.fish || c.shellfish) return 'fish';
  if (c.chicken) return 'chicken';
  if (c.mutton) return 'mutton';
  if (c.pork) return 'pork';
  if (c.beef) return 'beef';
  if (c.egg) return 'egg';
  return null;
}

function dayFamilies(day: DayDraft | Comp[][]): Set<string> {
  const lists = Array.isArray(day) ? day : day.meals.map((m) => m.comps);
  const out = new Set<string>();
  for (const comps of lists)
    for (const c of comps) {
      const fam = proteinFamily(c.food);
      if (fam) out.add(fam);
    }
  return out;
}

export function foodSlotFor(slot: MealSlot): FoodSlot {
  if (slot === 'breakfast' || slot === 'brunch') return 'breakfast';
  if (slot === 'midMorning' || slot === 'eveningSnack') return 'snack';
  return slot;
}

// ---------------------------------------------------------------- pools
export interface Pools {
  breakfast: Food[];
  curry: Record<'lunch' | 'dinner', Food[]>;
  complete: Record<'lunch' | 'dinner', Food[]>;
  staple: Record<'breakfast' | 'lunch' | 'dinner', Food[]>;
  side: Record<'lunch' | 'dinner', Food[]>;
  snack: Food[];
  addon: Record<FoodSlot, Food[]>;
}

export function buildPools(ctx: FoodContext): Pools {
  const by = (role: Food['role'], slot: FoodSlot) =>
    ctx.allowed.filter((f) => f.role === role && f.slots.includes(slot));
  return {
    breakfast: by('complete', 'breakfast'),
    curry: { lunch: by('curry', 'lunch'), dinner: by('curry', 'dinner') },
    complete: { lunch: by('complete', 'lunch'), dinner: by('complete', 'dinner') },
    staple: {
      breakfast: by('staple', 'breakfast'),
      lunch: by('staple', 'lunch'),
      dinner: by('staple', 'dinner'),
    },
    side: { lunch: by('side', 'lunch'), dinner: by('side', 'dinner') },
    snack: ctx.allowed.filter(
      (f) => f.slots.includes('snack') && f.role !== 'addon' && f.role !== 'staple',
    ),
    addon: {
      breakfast: by('addon', 'breakfast'),
      lunch: by('addon', 'lunch'),
      dinner: by('addon', 'dinner'),
      snack: by('addon', 'snack'),
    },
  };
}

/** The pool a dish was drawn from, used by swaps and the region repair. */
export function poolFor(pools: Pools, slot: MealSlot, f: Food): Food[] {
  const fs = foodSlotFor(slot);
  if (fs === 'snack') return f.role === 'addon' ? pools.addon.snack : pools.snack;
  if (f.role === 'addon') return pools.addon[fs];
  if (fs === 'breakfast') return f.role === 'staple' ? pools.staple.breakfast : pools.breakfast;
  if (f.role === 'curry') return pools.curry[fs];
  if (f.role === 'complete') return pools.complete[fs];
  if (f.role === 'staple') return pools.staple[fs];
  if (f.role === 'side') return pools.side[fs];
  return [];
}

// ---------------------------------------------------------- week state
export const newWeekState = (): WeekState => ({
  mainCount: new Map(),
  snackCount: new Map(),
  occasional: 0,
});

export function recordDay(week: WeekState, day: DayDraft, sign: 1 | -1 = 1): void {
  for (const meal of day.meals) {
    const snackMeal = foodSlotFor(meal.slot) === 'snack';
    for (const c of meal.comps) {
      if (c.addon) continue;
      const f = c.food;
      if (isMain(f) && !snackMeal) week.mainCount.set(f.id, (week.mainCount.get(f.id) ?? 0) + sign);
      if (snackMeal) week.snackCount.set(f.id, (week.snackCount.get(f.id) ?? 0) + sign);
      if (f.occasional) week.occasional += sign;
    }
  }
}

// -------------------------------------------------------------- picking
interface PickOpts {
  dayUsed: Set<string>;
  week: WeekState;
  snackMeal: boolean;
  /** Animal-protein families already on the day. */
  families?: Set<string>;
  /** Occasional (rich/fried) dishes already picked today. */
  dayOccasional?: { n: number };
}

function allowedNow(f: Food, o: PickOpts, limit: number): boolean {
  if (o.dayUsed.has(f.id)) return false;
  const fam = proteinFamily(f);
  if (fam && o.families?.has(fam)) return false;
  if (f.occasional && o.week.occasional + (o.dayOccasional?.n ?? 0) >= MAX_OCCASIONAL_PER_WEEK)
    return false;
  if (o.snackMeal) return (o.week.snackCount.get(f.id) ?? 0) < limit + 1;
  if (isMain(f)) return (o.week.mainCount.get(f.id) ?? 0) < limit;
  return true;
}

function tieredPick(cands: Food[], ctx: FoodContext, rng: Rng): Food | undefined {
  const mix = ctx.answers.cuisineMix;
  const regional = cands.filter((f) => isRegional(f, ctx));
  const nonRegional = cands.filter((f) => {
    if (isRegional(f, ctx)) return false;
    return mix === 'mixIn' || regionClass(f, ctx) === 'pan';
  });
  let tier = rng.next() < REGION_PICK_PROB[mix] ? regional : nonRegional;
  if (tier.length === 0)
    tier = regional.length ? regional : nonRegional.length ? nonRegional : cands;
  return rng.weighted(tier, (f) => preference(f, ctx));
}

/** Pick a dish, relaxing the twice-a-week limit only if nothing else fits. */
function pick(pool: Food[], ctx: FoodContext, rng: Rng, o: PickOpts): Food | undefined {
  for (let limit = MAX_MAIN_PER_WEEK; limit <= MAX_MAIN_PER_WEEK + 3; limit++) {
    const cands = pool.filter((f) => allowedNow(f, o, limit));
    if (cands.length) return tieredPick(cands, ctx, rng);
  }
  return undefined;
}

function pickStaple(
  pool: Food[],
  main: Food,
  ctx: FoodContext,
  rng: Rng,
  dayUsed: Set<string>,
): Food | undefined {
  // A Kerala plate shouldn't get a Haryanvi roti unless the person asked to mix regions.
  const local = pool.filter((f) => regionClass(f, ctx) !== 'other');
  const cands = ctx.answers.cuisineMix === 'mostlyMine' && local.length > 0 ? local : pool;
  return rng.weighted(cands, (f) => {
    let w = preference(f, ctx);
    if (main.pairsWith.includes(f.id)) w *= WEIGHTS.pairsWith;
    if (dayUsed.has(f.id)) w *= 0.5;
    return w;
  });
}

const comp = (food: Food, addon = false): Comp => ({ food, m: clampToGrid(food, 1), addon });

// ---------------------------------------------------------- selection
export function selectDay(
  ctx: FoodContext,
  pools: Pools,
  week: WeekState,
  targetKcal: number,
  pattern: Answers['mealPattern'],
  rng: Rng,
): DayDraft {
  const dayUsed = new Set<string>();
  const families = new Set<string>();
  const dayOccasional = { n: 0 };
  const use = (f: Food | undefined, list: Comp[]) => {
    if (!f) return;
    list.push(comp(f));
    dayUsed.add(f.id);
    if (f.occasional) dayOccasional.n++;
    const fam = proteinFamily(f);
    if (fam) families.add(fam);
  };

  const meals: MealDraft[] = MEAL_SPLITS[pattern].map(([slot, share]) => {
    const comps: Comp[] = [];
    const fs = foodSlotFor(slot);
    const opts = { dayUsed, week, snackMeal: fs === 'snack', families, dayOccasional };

    if (fs === 'breakfast') {
      const main = pick(pools.breakfast, ctx, rng, opts);
      if (main) use(main, comps);
      else use(pick(pools.snack, ctx, rng, { ...opts, snackMeal: true }), comps);
    } else if (fs === 'snack') {
      use(pick(pools.snack, ctx, rng, opts), comps);
    } else {
      const curryFirst = rng.next() < CURRY_TEMPLATE_PROB;
      const order = curryFirst
        ? [pools.curry[fs], pools.complete[fs]]
        : [pools.complete[fs], pools.curry[fs]];
      let main: Food | undefined;
      for (const pool of order) {
        main = pick(pool, ctx, rng, opts);
        if (main) break;
      }
      if (main) {
        use(main, comps);
        if (main.role === 'curry') {
          const staple = pickStaple(pools.staple[fs], main, ctx, rng, dayUsed);
          if (staple) {
            comps.push(comp(staple));
            dayUsed.add(staple.id);
          }
        }
      }
      use(pick(pools.side[fs], ctx, rng, opts), comps);
    }
    return { slot, target: targetKcal * share, comps };
  });
  return { meals };
}

// ------------------------------------------------------------- scaling
export function clampToGrid(f: Food, m: number): number {
  const { step, min, max } = f.scale;
  const k = Math.round((m - min) / step);
  return Math.min(max, Math.max(min, min + k * step));
}

export function dayTotals(day: DayDraft) {
  let kcal = 0,
    protein = 0,
    carbs = 0,
    fat = 0,
    fiber = 0;
  for (const meal of day.meals)
    for (const c of meal.comps) {
      const p = c.food.perServing;
      kcal += p.kcal * c.m;
      protein += p.protein * c.m;
      carbs += p.carbs * c.m;
      fat += p.fat * c.m;
      fiber += p.fiber * c.m;
    }
  return { kcal, protein, carbs, fat, fiber };
}

function objective(day: DayDraft, t: DayTargets): number {
  let j = 0,
    total = 0,
    protein = 0,
    dev = 0;
  for (const meal of day.meals) {
    let k = 0;
    for (const c of meal.comps) {
      k += c.food.perServing.kcal * c.m;
      protein += c.food.perServing.protein * c.m;
      dev += (c.m - 1) ** 2;
    }
    total += k;
    j += ((k - meal.target) / t.kcal) ** 2;
  }
  j += 4 * ((total - t.kcal) / t.kcal) ** 2;
  const short = Math.max(0, 0.97 * t.protein - protein) / Math.max(t.protein, 1);
  j += 6 * short ** 2;
  j += 0.0004 * dev; // prefer normal portions when it costs nothing
  return j;
}

/** Greedy local search over portion steps. Deterministic. */
export function scale(day: DayDraft, t: DayTargets): number {
  const all = day.meals.flatMap((m) => m.comps);
  let best = objective(day, t);
  for (let iter = 0; iter < 400; iter++) {
    let bestMove: { c: Comp; m: number } | null = null;
    let bestJ = best;
    for (const c of all) {
      for (const dir of [1, -1]) {
        const next = Math.round((c.m + dir * c.food.scale.step) * 1000) / 1000;
        if (next < c.food.scale.min - 1e-9 || next > c.food.scale.max + 1e-9) continue;
        const prev = c.m;
        c.m = next;
        const j = objective(day, t);
        c.m = prev;
        if (j < bestJ - 1e-12) {
          bestJ = j;
          bestMove = { c, m: next };
        }
      }
    }
    if (!bestMove) break;
    bestMove.c.m = bestMove.m;
    best = bestJ;
  }
  return best;
}

export function dayOk(day: DayDraft, t: DayTargets): { kcal: boolean; protein: boolean } {
  const tot = dayTotals(day);
  return {
    kcal: Math.abs(tot.kcal - t.kcal) / t.kcal <= DAY_KCAL_TOLERANCE,
    protein: tot.protein >= DAY_PROTEIN_MIN_RATIO * t.protein,
  };
}

function mealProtein(meal: MealDraft) {
  return meal.comps.reduce((s, c) => s + c.food.perServing.protein * c.m, 0);
}

/** Add protein add-ons until the protein target is met (or we run out of room). */
function fillProtein(day: DayDraft, pools: Pools, ctx: FoodContext, t: DayTargets, rng: Rng): void {
  const usedAddons = new Set<string>();
  const families = dayFamilies(day);
  for (let n = 0; n < MAX_ADDONS_PER_DAY; n++) {
    scale(day, t);
    if (dayOk(day, t).protein) return;
    // the meal that is lowest in protein for its size gets the add-on
    const meals = [...day.meals].sort(
      (x, y) => mealProtein(x) / x.target - mealProtein(y) / y.target,
    );
    let added = false;
    for (const meal of meals) {
      const fs = foodSlotFor(meal.slot);
      const inMeal = new Set(meal.comps.map((c) => c.food.id));
      const cands = pools.addon[fs]
        .filter((f) => !inMeal.has(f.id) && !usedAddons.has(f.id) && f.perServing.protein >= 3)
        .filter((f) => {
          const fam = proteinFamily(f);
          return !fam || !families.has(fam);
        })
        .sort(
          (x, y) =>
            y.perServing.protein / y.perServing.kcal - x.perServing.protein / x.perServing.kcal,
        );
      const top = cands.slice(0, 3);
      const choice = rng.weighted(
        top,
        (f) => preference(f, ctx) * (f.perServing.protein / f.perServing.kcal),
      );
      if (choice) {
        meal.comps.push(comp(choice, true));
        usedAddons.add(choice.id);
        const fam = proteinFamily(choice);
        if (fam) families.add(fam);
        added = true;
        break;
      }
    }
    if (!added) break;
  }
  scale(day, t);
}

/** Extra items that can top up a meal that's short on calories, in order of preference. */
function topUpCandidates(meal: MealDraft, pools: Pools, ctx: FoodContext): Food[] {
  const fs = foodSlotFor(meal.slot);
  const inMeal = new Set(meal.comps.map((c) => c.food.id));
  const fruit = pools.snack.filter((f) => f.id === 'banana' || f.id === 'seasonal-fruit');
  const byPref = (list: Food[]) =>
    [...list].sort((x, y) => preference(y, ctx) - preference(x, ctx) || x.id.localeCompare(y.id));
  let list: Food[];
  if (fs === 'lunch' || fs === 'dinner')
    list = [...byPref(pools.staple[fs]), ...byPref(pools.side[fs]), ...byPref(pools.addon[fs])];
  else if (fs === 'breakfast')
    list = [...byPref(pools.staple.breakfast), ...fruit, ...byPref(pools.addon.breakfast)];
  else list = [...fruit, ...byPref(pools.addon.snack), ...byPref(pools.snack)];
  // one staple per meal is enough: don't add rice to a roti meal
  const hasStaple = meal.comps.some((c) => c.food.role === 'staple');
  return list.filter((f) => !inMeal.has(f.id) && !(hasStaple && f.role === 'staple'));
}

/** Last resort for very high or very low targets. */
function fixCalories(day: DayDraft, pools: Pools, ctx: FoodContext, t: DayTargets): void {
  for (let i = 0; i < 8; i++) {
    const tot = dayTotals(day);
    const gap = (t.kcal - tot.kcal) / t.kcal;
    if (Math.abs(gap) <= DAY_KCAL_TOLERANCE * 0.8) return;
    if (gap > 0) {
      // too little food even at max portions: add to the meal furthest under its share
      const meals = [...day.meals].sort(
        (x, y) => (y.target - mealKcal(y)) / y.target - (x.target - mealKcal(x)) / x.target,
      );
      let added = false;
      for (const meal of meals) {
        const extra = topUpCandidates(meal, pools, ctx)[0];
        if (extra) {
          meal.comps.push(comp(extra));
          added = true;
          break;
        }
      }
      if (!added) return;
    } else {
      // too much food even at min portions: drop the lowest-protein side
      const sides = day.meals
        .flatMap((m) => m.comps.map((c) => ({ m, c })))
        .filter(({ c }) => c.food.role === 'side' && !c.addon)
        .sort((x, y) => x.c.food.perServing.protein - y.c.food.perServing.protein);
      const victim = sides[0];
      if (!victim) return;
      victim.m.comps = victim.m.comps.filter((c) => c !== victim.c);
    }
    scale(day, t);
  }
}

const mealKcal = (meal: MealDraft) =>
  meal.comps.reduce((s, c) => s + c.food.perServing.kcal * c.m, 0);

/** Pick and scale one day, retrying until it lands inside the windows. */
export function generateDay(
  ctx: FoodContext,
  pools: Pools,
  week: WeekState,
  t: DayTargets,
  pattern: Answers['mealPattern'],
  seed: number,
  dayIndex: number,
  shuffle: number,
): DayDraft {
  let best: { day: DayDraft; score: number } | null = null;
  for (let attempt = 0; attempt < MAX_DAY_ATTEMPTS; attempt++) {
    const rng = createRng(subSeed(seed, 'day', dayIndex, shuffle, attempt));
    const day = selectDay(ctx, pools, week, t.kcal, pattern, rng);
    fillProtein(day, pools, ctx, t, rng);
    fixCalories(day, pools, ctx, t);
    const ok = dayOk(day, t);
    const score = (ok.kcal ? 0 : 10) + (ok.protein ? 0 : 5) + objective(day, t);
    if (!best || score < best.score) best = { day, score };
    if (ok.kcal && ok.protein) break;
    // protein that can't be reached is a food-feasibility issue, not bad luck
    if (ok.kcal && attempt >= 2) break;
  }
  return best!.day;
}

// ------------------------------------------------------- region share
export function regionShare(days: DayDraft[], ctx: FoodContext): number {
  let total = 0,
    regional = 0;
  for (const d of days)
    for (const meal of d.meals)
      for (const c of meal.comps) {
        if (c.addon || !DISH_ROLES.has(c.food.role)) continue;
        total++;
        if (isRegional(c.food, ctx)) regional++;
      }
  return total === 0 ? 1 : regional / total;
}

/**
 * Swap non-regional dishes for regional ones until the share is met.
 * A swap is kept only if its day still lands inside the kcal/protein windows.
 */
export function repairRegionShare(
  days: DayDraft[],
  ctx: FoodContext,
  pools: Pools,
  week: WeekState,
  t: DayTargets,
): void {
  const min = REGION_SHARE_MIN[ctx.answers.cuisineMix];
  const tried = new Set<string>();
  for (let guard = 0; guard < 200 && regionShare(days, ctx) < min; guard++) {
    let done = false;
    outer: for (let d = 0; d < days.length; d++) {
      const day = days[d]!;
      for (let mi = 0; mi < day.meals.length; mi++) {
        const meal = day.meals[mi]!;
        for (let ci = 0; ci < meal.comps.length; ci++) {
          const c = meal.comps[ci]!;
          const key = `${d}:${mi}:${ci}:${c.food.id}`;
          if (c.addon || !DISH_ROLES.has(c.food.role) || isRegional(c.food, ctx) || tried.has(key))
            continue;
          tried.add(key);
          const dayUsed = new Set(day.meals.flatMap((m) => m.comps.map((x) => x.food.id)));
          const snackMeal = foodSlotFor(meal.slot) === 'snack';
          const others = day.meals.map((m) => m.comps.filter((x) => x !== c));
          const families = dayFamilies(others);
          const cands = poolFor(pools, meal.slot, c.food).filter(
            (f) =>
              f.role === c.food.role &&
              isRegional(f, ctx) &&
              allowedNow(f, { dayUsed, week, snackMeal, families }, MAX_MAIN_PER_WEEK),
          );
          if (cands.length === 0) continue;
          const kcalNow = c.food.perServing.kcal * c.m;
          cands.sort(
            (x, y) => Math.abs(x.perServing.kcal - kcalNow) - Math.abs(y.perServing.kcal - kcalNow),
          );
          for (const f of cands.slice(0, 3)) {
            const replacement: Comp = {
              food: f,
              m: clampToGrid(f, kcalNow / f.perServing.kcal),
              addon: false,
            };
            const snapshot = day.meals.map((m) => m.comps.map((x) => ({ ...x })));
            recordDay(week, day, -1);
            meal.comps[ci] = replacement;
            scale(day, t);
            const ok = dayOk(day, t);
            if (ok.kcal && ok.protein) {
              recordDay(week, day, 1);
              done = true;
              break outer;
            }
            day.meals.forEach((m, i) => (m.comps = snapshot[i]!));
            recordDay(week, day, 1);
          }
        }
      }
    }
    if (!done) break;
  }
}

// --------------------------------------------------------- whole week
export function generateWeek(
  ctx: FoodContext,
  pools: Pools,
  t: DayTargets,
  seed: number,
): DayDraft[] {
  const week = newWeekState();
  const days: DayDraft[] = [];
  for (let d = 0; d < 7; d++) {
    const day = generateDay(ctx, pools, week, t, ctx.answers.mealPattern, seed, d, 0);
    recordDay(week, day);
    days.push(day);
  }
  repairRegionShare(days, ctx, pools, week, t);
  return days;
}

// ------------------------------------------------------------- output
const r10 = (n: number) => Math.round(n / 10) * 10;

export function toMealItem(c: Comp, ctx: FoodContext): MealItem {
  const f = c.food;
  const p = f.perServing;
  return {
    foodId: f.id,
    name: f.name,
    gloss: f.gloss,
    role: c.addon ? 'addon' : f.role,
    multiplier: c.m,
    measure: measureText(f, c.m),
    grams: Math.round(f.serving.grams * c.m),
    kcal: r10(p.kcal * c.m),
    protein: Math.round(p.protein * c.m),
    carbs: Math.round(p.carbs * c.m),
    fat: Math.round(p.fat * c.m),
    fiber: Math.round(p.fiber * c.m),
    notes: ctx.notes.get(f.id) ?? [],
  };
}

export function toMeal(meal: MealDraft, ctx: FoodContext): Meal {
  const items = meal.comps.map((c) => toMealItem(c, ctx));
  const sum = (k: 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber') =>
    meal.comps.reduce((s, c) => s + c.food.perServing[k] * c.m, 0);
  return {
    slot: meal.slot,
    label: MEAL_LABELS[meal.slot],
    time: MEAL_TIMES[meal.slot],
    targetKcal: r10(meal.target),
    items,
    kcal: r10(sum('kcal')),
    protein: Math.round(sum('protein')),
    carbs: Math.round(sum('carbs')),
    fat: Math.round(sum('fat')),
    fiber: Math.round(sum('fiber')),
  };
}

export function toDayPlan(
  day: DayDraft,
  index: number,
  shuffle: number,
  ctx: FoodContext,
): DayPlan {
  const tot = dayTotals(day);
  return {
    index,
    label: DAY_LABELS[index]!,
    meals: day.meals.map((m) => toMeal(m, ctx)),
    kcal: r10(tot.kcal),
    protein: Math.round(tot.protein),
    carbs: Math.round(tot.carbs),
    fat: Math.round(tot.fat),
    fiber: Math.round(tot.fiber),
    shuffle,
  };
}

/** Rebuild drafts from a stored plan (for swap / shuffle). */
export function fromDayPlan(day: DayPlan, foodsById: ReadonlyMap<string, Food>): DayDraft {
  return {
    meals: day.meals.map((m) => ({
      slot: m.slot,
      target: m.targetKcal,
      comps: m.items.map((it) => {
        const food = foodsById.get(it.foodId);
        if (!food) throw new Error(`Unknown food in saved plan: ${it.foodId}`);
        return { food, m: it.multiplier, addon: it.role === 'addon' };
      }),
    })),
  };
}
