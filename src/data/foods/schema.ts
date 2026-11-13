/**
 * Food database schema (spec §8). Every region file is parsed with
 * FoodSchema when it loads, so a bad entry fails the build and the tests.
 *
 * Additions beyond the spec's field list (logged in docs/DECISIONS.md):
 *   gloss, role, canSkip, scale, tags, pairsWith, buys, raw, note,
 *   contains.honey, serving.qty / serving.unit.
 */
import { z } from 'zod';
import { STATE_CODES } from '../../lib/engine/regions';

export const FOOD_REGIONS = [
  'north',
  'west',
  'south',
  'east',
  'northeast',
  'central',
  'pan',
] as const;

/**
 * How a food is used when building a meal:
 *  complete – a dish that is a meal on its own (poha, khichdi, idli with sambar)
 *  curry    – eaten with a staple (dal, rajma, fish curry)
 *  staple   – roti, rice, bhakri
 *  side     – sabzi, raita, salad, rasam, chaas
 *  snack    – between-meal item
 *  addon    – single protein or dairy item used to reach the protein target
 */
export const ROLES = ['complete', 'curry', 'staple', 'side', 'snack', 'addon'] as const;
export const FOOD_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

export const CONTAINS_KEYS = [
  'dairy',
  'lactoseHigh',
  'gluten',
  'peanut',
  'treeNut',
  'soy',
  'egg',
  'fish',
  'shellfish',
  'chicken',
  'mutton',
  'pork',
  'beef',
  'onionGarlic',
  'rootVeg',
  'honey',
] as const;

/** Ingredients a cook can simply leave out (Jain-style / no onion-garlic). */
export const SKIPPABLE = ['onionGarlic', 'rootVeg'] as const;

export const UNITS = {
  katori: { one: 'katori', many: 'katori', count: false, hint: '150 ml' },
  bowl: { one: 'bowl', many: 'bowls', count: false, hint: '250 ml' },
  plate: { one: 'plate', many: 'plates', count: false, hint: '' },
  glass: { one: 'glass', many: 'glasses', count: false, hint: '250 ml' },
  tbsp: { one: 'tbsp', many: 'tbsp', count: false, hint: '' },
  handful: { one: 'handful', many: 'handfuls', count: false, hint: '' },
  g: { one: 'g', many: 'g', count: false, hint: '' },
  roti: { one: 'roti', many: 'rotis', count: true, hint: '' },
  paratha: { one: 'paratha', many: 'parathas', count: true, hint: '' },
  bhakri: { one: 'bhakri', many: 'bhakris', count: true, hint: '' },
  thepla: { one: 'thepla', many: 'theplas', count: true, hint: '' },
  chilla: { one: 'chilla', many: 'chillas', count: true, hint: '' },
  dosa: { one: 'dosa', many: 'dosas', count: true, hint: '' },
  idli: { one: 'idli', many: 'idlis', count: true, hint: '' },
  appam: { one: 'appam', many: 'appams', count: true, hint: '' },
  piece: { one: 'piece', many: 'pieces', count: true, hint: '' },
  slice: { one: 'slice', many: 'slices', count: true, hint: '' },
  egg: { one: 'egg', many: 'eggs', count: true, hint: '' },
  litti: { one: 'litti', many: 'littis', count: true, hint: '' },
  cob: { one: 'cob', many: 'cobs', count: true, hint: '' },
  pav: { one: 'pav', many: 'pav', count: true, hint: '' },
} as const;
export type Unit = keyof typeof UNITS;
const UNIT_KEYS = Object.keys(UNITS) as [Unit, ...Unit[]];

export const TAGS = [
  'fried',
  'highSalt',
  'spicy',
  'fermented',
  'ironRich',
  'calciumRich',
  'sweet',
] as const;

const ContainsSchema = z.object(
  Object.fromEntries(CONTAINS_KEYS.map((k) => [k, z.boolean()])) as Record<
    (typeof CONTAINS_KEYS)[number],
    z.ZodBoolean
  >,
);

const isInt = (n: number) => Number.isInteger(Math.round(n * 1e6) / 1e6);

export const FoodSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: z.string().min(2),
    gloss: z.string().min(2),
    localNames: z.array(z.string()),
    role: z.enum(ROLES),
    slots: z.array(z.enum(FOOD_SLOTS)).min(1),
    states: z.array(z.enum(STATE_CODES)),
    region: z.enum(FOOD_REGIONS),
    diet: z.object({
      veg: z.boolean(),
      egg: z.boolean(),
      nonveg: z.boolean(),
      vegan: z.boolean(),
      jainSafe: z.boolean(),
    }),
    contains: ContainsSchema,
    canSkip: z.array(z.enum(SKIPPABLE)),
    serving: z.object({
      measure: z.string(),
      grams: z.number().positive(),
      qty: z.number().positive(),
      unit: z.enum(UNIT_KEYS),
    }),
    /** Portion multipliers allowed, in units of one serving. */
    scale: z.object({
      step: z.number().positive(),
      min: z.number().positive(),
      max: z.number().positive(),
    }),
    perServing: z.object({
      kcal: z.number().int().nonnegative(),
      protein: z.number().int().nonnegative(),
      carbs: z.number().int().nonnegative(),
      fat: z.number().int().nonnegative(),
      fiber: z.number().int().nonnegative(),
    }),
    gi: z.enum(['low', 'med', 'high']),
    budget: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    occasional: z.boolean(),
    eatOutFriendly: z.boolean(),
    prepMinutes: z.number().int().nonnegative(),
    tags: z.array(z.enum(TAGS)),
    /** Preferred staple ids for a curry. */
    pairsWith: z.array(z.string()),
    /** Key ingredients for the grocery list. */
    buys: z.array(z.string()),
    /** For single-ingredient foods: raw amount per serving, for grocery quantities. */
    raw: z
      .object({ item: z.string(), amount: z.number().positive(), unit: z.enum(['g', 'ml', 'pcs']) })
      .nullable(),
    note: z.string().nullable(),
    source: z.enum(['IFCT 2017', 'computed from ingredients']),
    verified: z.boolean(),
  })
  .superRefine((f, ctx) => {
    const bad = (message: string) =>
      ctx.addIssue({ code: 'custom', message: `${f.id}: ${message}` });
    const p = f.perServing;

    if (p.kcal % 10 !== 0) bad('kcal must be rounded to the nearest 10');
    const fromMacros = 4 * p.protein + 4 * p.carbs + 9 * p.fat;
    if (p.kcal >= 50 && Math.abs(fromMacros - p.kcal) / p.kcal > 0.2) {
      bad(`kcal ${p.kcal} doesn't match macros (${fromMacros})`);
    }

    // Diet flags must follow from `contains`.
    const c = f.contains;
    const meatFish = c.fish || c.shellfish || c.chicken || c.mutton || c.pork || c.beef;
    const veg = !meatFish && !c.egg;
    const skipOG = f.canSkip.includes('onionGarlic');
    const skipRoot = f.canSkip.includes('rootVeg');
    const expected = {
      veg,
      egg: !meatFish,
      nonveg: true,
      vegan: veg && !c.dairy && !c.honey,
      jainSafe: veg && !c.honey && (!c.onionGarlic || skipOG) && (!c.rootVeg || skipRoot),
    };
    for (const k of Object.keys(expected) as (keyof typeof expected)[]) {
      if (f.diet[k] !== expected[k]) bad(`diet.${k} should be ${expected[k]}`);
    }
    if (skipOG && !c.onionGarlic) bad("canSkip onionGarlic but doesn't contain it");
    if (skipRoot && !c.rootVeg) bad("canSkip rootVeg but doesn't contain it");
    if (c.lactoseHigh && !c.dairy) bad('lactoseHigh without dairy');

    // Portion steps must give whole rotis / idlis / eggs.
    const { step, min, max } = f.scale;
    if (min > max) bad('scale.min > scale.max');
    if (UNITS[f.serving.unit].count) {
      for (const v of [step, min, max])
        if (!isInt(v * f.serving.qty)) bad(`scale ${v} gives a fractional ${f.serving.unit}`);
    }

    // Role ↔ slot sanity.
    const allowedSlots: Record<(typeof ROLES)[number], readonly string[]> = {
      complete: ['breakfast', 'lunch', 'dinner', 'snack'],
      curry: ['lunch', 'dinner'],
      staple: ['breakfast', 'lunch', 'dinner'],
      side: ['lunch', 'dinner', 'snack'],
      snack: ['snack', 'breakfast'],
      addon: ['breakfast', 'lunch', 'dinner', 'snack'],
    };
    for (const s of f.slots)
      if (!allowedSlots[f.role].includes(s)) bad(`role ${f.role} can't use slot ${s}`);
    if (f.region !== 'pan' && f.states.length === 0) bad('regional food needs at least one state');
  });

export type Food = z.infer<typeof FoodSchema>;
export type Role = (typeof ROLES)[number];
export type FoodSlot = (typeof FOOD_SLOTS)[number];
export type ContainsKey = (typeof CONTAINS_KEYS)[number];
export type Tag = (typeof TAGS)[number];
