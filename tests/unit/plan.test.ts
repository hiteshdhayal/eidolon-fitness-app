import { describe, expect, it } from 'vitest';
import { FOODS } from '../../src/data/foods/index';
import {
  applySwap,
  buildPlan,
  getSwaps,
  groceryListFor,
  PlanSchema,
  primaryItemIndex,
  shuffleDay,
} from '../../src/lib/engine/index';
import { checkFood } from '../../src/lib/engine/filter';
import { AnswersSchema } from '../../src/lib/engine/schema';
import type { AnswersInput, Plan } from '../../src/lib/engine/types';
import { make, NOW, PERSONAS } from './personas';

const build = (a: AnswersInput) => buildPlan(a, FOODS, { now: NOW });
const byId = new Map(FOODS.map((f) => [f.id, f]));
const MAIN_ROLES = new Set(['complete', 'curry']);

function expectWindows(plan: Plan) {
  const t = plan.targets!;
  for (const d of plan.days) {
    expect(
      Math.abs(d.kcal - t.kcal) / t.kcal,
      `${d.label} kcal ${d.kcal} vs ${t.kcal}`,
    ).toBeLessThanOrEqual(0.07 + 0.005);
    expect(d.protein, `${d.label} protein`).toBeGreaterThanOrEqual(Math.floor(0.9 * t.protein) - 1);
  }
}

function expectVariety(plan: Plan) {
  const week = new Map<string, number>();
  let occasional = 0;
  for (const d of plan.days) {
    const today = new Set<string>();
    for (const m of d.meals) {
      if (m.slot === 'midMorning' || m.slot === 'eveningSnack') continue;
      for (const it of m.items) {
        if (!MAIN_ROLES.has(it.role)) continue;
        expect(today.has(it.foodId), `${it.foodId} twice on ${d.label}`).toBe(false);
        today.add(it.foodId);
        week.set(it.foodId, (week.get(it.foodId) ?? 0) + 1);
      }
    }
    for (const m of d.meals)
      for (const it of m.items)
        if (byId.get(it.foodId)!.occasional && it.role !== 'addon') occasional++;
  }
  for (const [id, n] of week) expect(n, `${id} ${n}× in the week`).toBeLessThanOrEqual(2);
  expect(occasional).toBeLessThanOrEqual(1);
}

describe('personas (spec §23)', () => {
  it('veg male from Haryana: 7 days, windows, regional, all veg', () => {
    const plan = build(PERSONAS.vegHaryanaMale);
    expect(plan.kind).toBe('recipes');
    expect(plan.days).toHaveLength(7);
    expect(plan.days[0]!.meals.map((m) => m.slot)).toEqual([
      'breakfast',
      'midMorning',
      'lunch',
      'eveningSnack',
      'dinner',
    ]);
    expectWindows(plan);
    expectVariety(plan);
    expect(plan.regionShare!).toBeGreaterThanOrEqual(0.7);
    for (const d of plan.days)
      for (const m of d.meals)
        for (const it of m.items) expect(byId.get(it.foodId)!.diet.veg).toBe(true);
  });

  it('non-veg woman from Kerala with PCOS: lower-carb targets, PCOS note, only picked meats', () => {
    const plan = build(PERSONAS.keralaPcosNonveg);
    expect(plan.targets!.lowerCarb).toBe(true);
    expect(plan.targets!.carbPct).toBeLessThanOrEqual(45);
    expect(plan.healthNoteIds).toContain('pcos');
    expectWindows(plan);
    expectVariety(plan);
    expect(plan.regionShare!).toBeGreaterThanOrEqual(0.7);
    for (const d of plan.days)
      for (const m of d.meals)
        for (const it of m.items) {
          const f = byId.get(it.foodId)!;
          expect(f.contains.mutton || f.contains.pork || f.contains.beef).toBe(false);
        }
  });

  it('Jain from Gujarat: Jain-safe foods only, with Jain-style notes', () => {
    const plan = build(PERSONAS.jainGujarat);
    expectWindows(plan);
    expect(plan.regionShare!).toBeGreaterThanOrEqual(0.7);
    const items = plan.days.flatMap((d) => d.meals.flatMap((m) => m.items));
    for (const it of items) expect(byId.get(it.foodId)!.diet.jainSafe).toBe(true);
    const withOnion = items.filter((it) => byId.get(it.foodId)!.contains.onionGarlic);
    for (const it of withOnion)
      expect(it.notes).toContain('Jain-style: leave out onion and garlic.');
  });

  it('a teen gets guidance with no calorie, protein or weight numbers', () => {
    const plan = build(PERSONAS.teen);
    expect(plan.kind).toBe('guidance');
    expect(plan.targets).toBeNull();
    expect(plan.days).toEqual([]);
    expect(plan.guidance!.mealIdeas.breakfast.length).toBeGreaterThan(0);
    const text = JSON.stringify({ g: plan.guidance, r: plan.safety.reasons, n: plan.notes });
    expect(text).not.toMatch(/kcal|calorie target|\d+\s?g protein|\d+\s?kg/i);
    expect(text).toMatch(/parent or doctor/);
  });

  it('a pregnant user gets guidance only, with the gynaecologist note', () => {
    const plan = build(PERSONAS.pregnant);
    expect(plan.kind).toBe('guidance');
    expect(plan.targets).toBeNull();
    expect(plan.safety.reasons.map((r) => r.message).join(' ')).toMatch(/gynaecologist/);
    expect(plan.guidance!.tips.join(' ')).toMatch(/undercooked/);
  });

  it('hostel mode: plate rules instead of recipes', () => {
    const plan = build(PERSONAS.hostel);
    expect(plan.kind).toBe('plateRules');
    expect(plan.days).toEqual([]);
    expect(plan.targets).not.toBeNull();
    const g = plan.plateGuide!;
    expect(g.baseRule).toMatch(
      /^½ plate sabzi\/salad, ¼ .+, ¼ roti or rice — 2 rotis or 1 katori rice\.$/,
    );
    expect(g.orderingGuide[0]).toEqual({
      place: 'South Indian restaurant',
      tip: '2 idli + extra sambar instead of a masala dosa.',
    });
    expect(g.messTips.length).toBeGreaterThanOrEqual(4);
    expect(g.proteinTips.length).toBeGreaterThan(0);
  });
});

describe('plan engine behaviour', () => {
  it('is deterministic: same answers → identical plan', () => {
    expect(build(PERSONAS.keralaPcosNonveg)).toEqual(build(PERSONAS.keralaPcosNonveg));
  });
  it("answer key order doesn't change the plan", () => {
    const a = PERSONAS.vegHaryanaMale;
    const reversed = Object.fromEntries(Object.entries(a).reverse()) as AnswersInput;
    expect(build(reversed).days).toEqual(build(a).days);
  });
  it('different answers → a different plan', () => {
    expect(build(make({ weightKg: 83 })).seed).not.toBe(build(PERSONAS.vegHaryanaMale).seed);
  });
  it('output validates against PlanSchema (safe to store)', () => {
    for (const p of Object.values(PERSONAS)) expect(() => PlanSchema.parse(build(p))).not.toThrow();
  });
  it("'mix in' still keeps at least 50% regional", () => {
    expect(
      build(make({ cuisineMix: 'mixIn', state: 'WB', dietType: 'nonveg', meats: ['fish', 'eggs'] }))
        .regionShare!,
    ).toBeGreaterThanOrEqual(0.5);
  });
  it('2-meal pattern: brunch, evening snack, dinner', () => {
    const plan = build(make({ mealPattern: '2', state: 'MH' }));
    expect(plan.days[0]!.meals.map((m) => m.slot)).toEqual(['brunch', 'eveningSnack', 'dinner']);
    expectWindows(plan);
  });
  it('lowers an unreachable protein target and says so; supplements only if open', () => {
    const strict = make({
      dietType: 'vegan',
      restrictions: ['soy', 'glutenFree'],
      budget: 'cheap',
      trainingDays: '5-6',
      weightKg: 90,
      heightCm: 182,
    });
    const plan = build(strict);
    expect(plan.targets!.proteinLowered).toBe(true);
    expect(plan.targets!.protein).toBeLessThan(plan.targets!.proteinRequested);
    expect(plan.notes.join(' ')).toMatch(/realistic from food alone/);
    expect(plan.notes.join(' ')).not.toMatch(/whey|scoop/);
    expect(build({ ...strict, supplements: 'open' }).notes.join(' ')).toMatch(/scoop/);
    expectWindows(plan);
  });
  it('gentle mode adds the carbs-spread note for diabetes medicines', () => {
    const plan = build(
      make({ conditions: ['diabetes'], diabetesType: 'type2', medications: ['diabetesTablets'] }),
    );
    expect(plan.safety.mode).toBe('gentle');
    expect(plan.healthNoteIds).toEqual(expect.arrayContaining(['diabetes', 'metformin']));
    expect(plan.notes.join(' ')).toMatch(/carbs spread/);
  });
  it('hypothyroid note needs both the condition and the medicine', () => {
    const f = (o: Parameters<typeof make>[0]) => build(make({ sex: 'female', ...o })).healthNoteIds;
    expect(f({ conditions: ['hypothyroid'], medications: ['thyroid'] })).toContain('hypothyroid');
    expect(f({ conditions: ['hypothyroid'], medications: [] })).not.toContain('hypothyroid');
  });
  it('every plan carries the medical disclaimer', () => {
    expect(build(PERSONAS.vegHaryanaMale).disclaimer).toMatch(/not medical advice/);
  });
});

describe('swap and shuffle', () => {
  const answers = PERSONAS.vegHaryanaMale;
  const plan = build(answers);

  it('offers 3 alternatives with similar calories', () => {
    const lunch = plan.days[0]!.meals.findIndex((m) => m.slot === 'lunch');
    const idx = primaryItemIndex(plan, 0, lunch);
    const current = plan.days[0]!.meals[lunch]!.items[idx]!;
    const opts = getSwaps(plan, answers, FOODS, 0, lunch, idx);
    expect(opts).toHaveLength(3);
    for (const o of opts) {
      expect(o.foodId).not.toBe(current.foodId);
      expect(Math.abs(o.kcal - current.kcal) / current.kcal).toBeLessThan(0.35);
      expect(checkFood(byId.get(o.foodId)!, AnswersSchema.parse(answers))).not.toBeNull();
    }
  });
  it('applying a swap replaces the item and updates the day totals', () => {
    const opts = getSwaps(plan, answers, FOODS, 1, 0);
    const swapped = applySwap(plan, answers, FOODS, 1, 0, primaryItemIndex(plan, 1, 0), opts[0]!);
    expect(swapped.days[1]!.meals[0]!.items.some((it) => it.foodId === opts[0]!.foodId)).toBe(true);
    expect(swapped.days[0]).toEqual(plan.days[0]);
    expect(plan.days[1]!.meals[0]!.items.some((it) => it.foodId === opts[0]!.foodId)).toBe(false); // original untouched
  });
  it('shuffle day regenerates only that day, deterministically', () => {
    const s1 = shuffleDay(plan, answers, FOODS, 3);
    const s2 = shuffleDay(plan, answers, FOODS, 3);
    expect(s1).toEqual(s2);
    expect(s1.days[3]!.shuffle).toBe(1);
    expect(s1.days[3]).not.toEqual(plan.days[3]);
    expect(s1.days[2]).toEqual(plan.days[2]);
    const t = plan.targets!;
    expect(Math.abs(s1.days[3]!.kcal - t.kcal) / t.kcal).toBeLessThanOrEqual(0.075);
  });
});

describe('grocery list', () => {
  it('groups the week by category with stable ids', () => {
    const answers = PERSONAS.vegHaryanaMale;
    const list = groceryListFor(build(answers), answers, FOODS);
    const cats = list.categories.map((c) => c.id);
    expect(cats).toEqual(
      expect.arrayContaining(['grains', 'dals', 'dairy', 'vegetables', 'spicesOil']),
    );
    for (const c of list.categories)
      for (const it of c.items) expect(it.id).toMatch(/^[a-z0-9-]+$/);
  });
  it('leaves onion, garlic and potato off a Jain list', () => {
    const answers = PERSONAS.jainGujarat;
    const names = groceryListFor(build(answers), answers, FOODS).categories.flatMap((c) =>
      c.items.map((i) => i.name.toLowerCase()),
    );
    for (const n of names) expect(n).not.toMatch(/\bonion|garlic|potato/);
  });
});

describe('sweep: many answer combinations stay inside the windows', () => {
  const states = [
    'HR',
    'PB',
    'UK',
    'GJ',
    'RJ',
    'MH',
    'GA',
    'TN',
    'KL',
    'KA',
    'AP',
    'WB',
    'OD',
    'BR',
    'AS',
    'MN',
    'ML',
    'SK',
    'MP',
    'CG',
  ] as const;
  const diets: Partial<AnswersInput>[] = [
    { dietType: 'veg' },
    { dietType: 'vegan' },
    { dietType: 'jain' },
    { dietType: 'eggetarian' },
    { dietType: 'nonveg', meats: ['chicken', 'fish', 'eggs', 'mutton', 'pork'] },
  ];
  const patterns = ['3', '3+snacks', '2'] as const;
  const people: Partial<AnswersInput>[] = [
    {
      sex: 'female',
      age: 34,
      heightCm: 155,
      weightKg: 58,
      goal: 'lose',
      trainingDays: 'none',
      trainingType: [],
      steps: '3-6k',
    },
    {
      sex: 'male',
      age: 24,
      heightCm: 178,
      weightKg: 66,
      goal: 'muscle',
      trainingDays: '5-6',
      steps: '6-9k',
    },
  ];
  let i = 0;
  const cases: [string, AnswersInput][] = [];
  for (const state of states)
    for (const diet of diets) {
      const pattern = patterns[i % 3]!;
      const person = people[i % 2]!;
      i++;
      cases.push([
        `${state}/${diet.dietType}/${pattern}/${person.sex}`,
        make({ ...person, ...diet, state, mealPattern: pattern }),
      ]);
    }

  it.each(cases)('%s', (_, a) => {
    const plan = build(a);
    expectWindows(plan);
    expectVariety(plan);
    const parsed = AnswersSchema.parse(a);
    for (const d of plan.days)
      for (const m of d.meals)
        for (const it of m.items) expect(checkFood(byId.get(it.foodId)!, parsed)).not.toBeNull();
  });
});
