/**
 * Short-hand for writing foods. Region files list FoodInput objects;
 * define() fills defaults and derives the diet flags from `has`, so
 * "vegan" can never be set by hand on a dish that contains curd.
 *
 * How to add a food (for a non-developer):
 *   1. Copy an existing entry in the right region file.
 *   2. Change id (lowercase-with-dashes), name, gloss, serving and n.
 *   3. n = [kcal, protein g, carbs g, fat g, fiber g] for ONE serving.
 *      Round kcal to the nearest 10.
 *   4. List what it contains in `has` (e.g. ["dairy", "gluten"]).
 *   5. Run `pnpm test` — it tells you if anything doesn't add up.
 */
import type { StateCode } from '../../lib/engine/regions';
import type { ContainsKey, Food, FoodSlot, Role, Tag, Unit } from './schema';
import { CONTAINS_KEYS } from './schema';

export interface FoodInput {
  id: string;
  name: string;
  gloss: string;
  local?: string[];
  role: Role;
  slots: FoodSlot[];
  states?: StateCode[];
  /** Ingredient flags that are true. */
  has?: ContainsKey[];
  /** Flags a cook can leave out (Jain-style). */
  skip?: ('onionGarlic' | 'rootVeg')[];
  /** [measure text for 1 serving, grams, qty, unit] */
  serving: [string, number, number, Unit];
  /** [step, min, max] as multiples of one serving. */
  scale?: [number, number, number];
  /** [kcal, protein, carbs, fat, fiber] per serving. */
  n: [number, number, number, number, number];
  gi: 'low' | 'med' | 'high';
  budget: 1 | 2 | 3;
  occasional?: boolean;
  eatOut?: boolean;
  prep: number;
  tags?: Tag[];
  pairs?: string[];
  /** Comma-separated key ingredients. */
  buys?: string;
  raw?: [string, number, 'g' | 'ml' | 'pcs'];
  note?: string;
}

const DEFAULT_SCALE: Record<Role, [number, number, number]> = {
  complete: [0.5, 0.5, 2],
  curry: [0.5, 0.5, 2],
  staple: [0.5, 0.5, 2],
  side: [0.5, 0.5, 1.5],
  snack: [0.5, 0.5, 2],
  addon: [0.5, 0.5, 2],
};

export function define(region: Food['region'], i: FoodInput): Food {
  const contains = Object.fromEntries(CONTAINS_KEYS.map((k) => [k, false])) as Record<
    ContainsKey,
    boolean
  >;
  for (const k of i.has ?? []) contains[k] = true;

  const meatFish =
    contains.fish ||
    contains.shellfish ||
    contains.chicken ||
    contains.mutton ||
    contains.pork ||
    contains.beef;
  const veg = !meatFish && !contains.egg;
  const skip = i.skip ?? [];
  const [step, min, max] = i.scale ?? DEFAULT_SCALE[i.role];
  const [kcal, protein, carbs, fat, fiber] = i.n;

  return {
    id: i.id,
    name: i.name,
    gloss: i.gloss,
    localNames: i.local ?? [],
    role: i.role,
    slots: i.slots,
    states: i.states ?? [],
    region,
    diet: {
      veg,
      egg: !meatFish,
      nonveg: true,
      vegan: veg && !contains.dairy && !contains.honey,
      jainSafe:
        veg &&
        !contains.honey &&
        (!contains.onionGarlic || skip.includes('onionGarlic')) &&
        (!contains.rootVeg || skip.includes('rootVeg')),
    },
    contains,
    canSkip: skip,
    serving: { measure: i.serving[0], grams: i.serving[1], qty: i.serving[2], unit: i.serving[3] },
    scale: { step, min, max },
    perServing: { kcal, protein, carbs, fat, fiber },
    gi: i.gi,
    budget: i.budget,
    occasional: i.occasional ?? false,
    eatOutFriendly: i.eatOut ?? false,
    prepMinutes: i.prep,
    tags: i.tags ?? [],
    pairsWith: i.pairs ?? [],
    buys: (i.buys ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    raw: i.raw ? { item: i.raw[0], amount: i.raw[1], unit: i.raw[2] } : null,
    note: i.note ?? null,
    // Values are estimates computed from standard ingredient values; none has
    // been checked line-by-line against IFCT 2017 yet. See docs/DECISIONS.md.
    source: 'computed from ingredients',
    verified: false,
  };
}

export const defineAll = (region: Food['region'], items: FoodInput[]): Food[] =>
  items.map((i) => define(region, i));
