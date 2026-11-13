/**
 * Which foods a person can eat, and how strongly each is preferred
 * (spec §7.3 "Filtering", "Region weighting").
 */
import type { Food } from '../../data/foods/schema';
import { BUDGET_COMFORT, BUDGET_MAX, WEIGHTS } from './constants';
import { regionOf, type Region, type StateCode } from './regions';
import { isLowerCarb } from './targets';
import type { Answers } from './types';

export interface FoodContext {
  answers: Answers;
  state: StateCode;
  region: Region;
  lowerCarb: boolean;
  /** Foods this person may eat, with the notes to show when they're used. */
  allowed: Food[];
  notes: Map<string, string[]>;
}

export type RegionClass = 'state' | 'region' | 'pan' | 'other';

export function homeState(a: Answers): StateCode {
  if (a.state === 'OUT') {
    if (!a.homeRegion) throw new Error('homeRegion is required when state is OUT');
    return a.homeRegion;
  }
  return a.state;
}

export const NOTE = {
  jain: 'Jain-style: leave out onion and garlic.',
  jainRoot: 'Jain-style: leave out potato and other root vegetables.',
  noOnionGarlic: 'Make it without onion and garlic.',
  lactose: 'Curd is usually fine with lactose intolerance; skip it if it bothers you.',
  occasional: 'A richer dish: once a week is plenty.',
} as const;

/** Returns null if the food is not allowed, otherwise the notes to attach. */
export function checkFood(f: Food, a: Answers): string[] | null {
  const c = f.contains;
  const notes: string[] = [];

  // ---- diet type -------------------------------------------------------
  switch (a.dietType) {
    case 'veg':
      if (!f.diet.veg) return null;
      break;
    case 'eggetarian':
      if (!f.diet.egg) return null;
      break;
    case 'vegan':
      if (!f.diet.vegan) return null;
      break;
    case 'jain':
      if (!f.diet.jainSafe) return null;
      if (c.onionGarlic) notes.push(NOTE.jain);
      if (c.rootVeg) notes.push(NOTE.jainRoot);
      break;
    case 'nonveg': {
      const m = a.meats;
      if (c.chicken && !m.includes('chicken')) return null;
      if ((c.fish || c.shellfish) && !m.includes('fish')) return null;
      if (c.egg && !m.includes('eggs')) return null;
      if (c.mutton && !m.includes('mutton')) return null;
      if (c.pork && !m.includes('pork')) return null;
      if (c.beef && !m.includes('beef')) return null;
      break;
    }
  }

  // ---- restrictions and allergies --------------------------------------
  const r = a.restrictions;
  if (r.includes('noDairy') && c.dairy) return null;
  if (r.includes('lactose')) {
    if (c.lactoseHigh) return null;
    if (c.dairy && (f.id === 'curd' || f.buys.includes('curd'))) notes.push(NOTE.lactose);
  }
  if (r.includes('glutenFree') && c.gluten) return null;
  if (r.includes('peanut') && c.peanut) return null;
  if (r.includes('treeNut') && c.treeNut) return null;
  if (r.includes('soy') && c.soy) return null;
  if (r.includes('noOnionGarlic') && c.onionGarlic) {
    if (!f.canSkip.includes('onionGarlic')) return null;
    if (a.dietType !== 'jain') notes.push(NOTE.noOnionGarlic);
  }

  // ---- budget ------------------------------------------------------------
  if (f.budget > BUDGET_MAX[a.budget]) return null;

  // ---- conditions ------------------------------------------------------
  // High uric acid / gout: leave out red meat and shellfish (§7.4).
  if (a.conditions.includes('uricAcid') && (c.mutton || c.pork || c.beef || c.shellfish))
    return null;

  if (f.occasional) notes.push(NOTE.occasional);
  if (f.note) notes.push(f.note);
  return notes;
}

export function buildContext(a: Answers, foods: readonly Food[]): FoodContext {
  const state = homeState(a);
  const allowed: Food[] = [];
  const notes = new Map<string, string[]>();
  for (const f of foods) {
    const n = checkFood(f, a);
    if (n) {
      allowed.push(f);
      notes.set(f.id, n);
    }
  }
  return { answers: a, state, region: regionOf(state), lowerCarb: isLowerCarb(a), allowed, notes };
}

export function regionClass(f: Food, ctx: Pick<FoodContext, 'state' | 'region'>): RegionClass {
  if (f.states.includes(ctx.state)) return 'state';
  if (f.region === ctx.region) return 'region';
  if (f.region === 'pan') return 'pan';
  return 'other';
}

export const isRegional = (f: Food, ctx: Pick<FoodContext, 'state' | 'region'>) => {
  const rc = regionClass(f, ctx);
  return rc === 'state' || rc === 'region';
};

/** Roles that count as "dishes" for the regional share (staples and add-ons don't). */
export const DISH_ROLES = new Set(['complete', 'curry', 'side', 'snack']);

/** Relative preference for a food, before region tiering. */
export function preference(f: Food, ctx: FoodContext): number {
  const a = ctx.answers;
  let w = 1;
  const rc = regionClass(f, ctx);
  w *=
    rc === 'state'
      ? WEIGHTS.stateMatch
      : rc === 'region'
        ? WEIGHTS.regionMatch
        : rc === 'pan'
          ? WEIGHTS.pan
          : WEIGHTS.otherRegion;
  if (f.budget > BUDGET_COMFORT[a.budget]) w *= WEIGHTS.budgetStretch;
  if (ctx.lowerCarb && f.gi === 'high') w *= WEIGHTS.highGiLowerCarb;
  const heart = a.conditions.some(
    (c) => c === 'cholesterol' || c === 'fattyLiver' || c === 'heart',
  );
  if (heart && f.tags.includes('fried')) w *= WEIGHTS.friedForHeart;
  return w;
}
