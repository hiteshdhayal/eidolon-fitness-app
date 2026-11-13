/**
 * Guidance mode (spec §7.1): under 18, pregnant or kidney disease.
 * Balanced regional meal ideas and tips — no calories, no protein
 * targets, no weight numbers anywhere in the output.
 */
import type { Food } from '../../data/foods/schema';
import { isRegional, preference, type FoodContext } from './filter';
import type { Guidance, SafetyResult } from './types';

const TIPS: Record<string, string[]> = {
  teen: [
    "Eat 3 meals and 1–2 snacks a day, and don't skip breakfast.",
    'Be active for about an hour a day: sport, cycling, dance or brisk walking all count.',
    'Sleep 8 to 10 hours. It matters for growth, mood and focus.',
    'Talk to a parent or doctor before trying to change your weight.',
  ],
  pregnant: [
    'Eat small, regular meals; it helps with nausea and acidity.',
    'Have dal, curd, green leafy vegetables and fruit every day.',
    'Your doctor will guide any iron, folic acid or calcium tablets; take them as advised.',
    'Avoid raw or undercooked eggs, meat and fish, and unpasteurised milk.',
  ],
  kidney: [
    "Don't start a high-protein diet or protein supplements without your doctor's advice.",
    'Ask your doctor about the right limits for salt, potassium and phosphorus for you.',
    "Keep taking your medicines as prescribed; food changes don't replace them.",
  ],
};

const HEADLINES: Record<string, string> = {
  kidney: 'Please see your doctor before changing your diet',
  pregnant: 'Healthy-eating ideas for pregnancy',
  teen: 'Balanced meal ideas from your region',
};

function topNames(foods: Food[], ctx: FoodContext, n: number): Food[] {
  return [...foods]
    .filter((f) => !f.occasional)
    .sort((x, y) => {
      const rx = isRegional(x, ctx) ? 1 : 0;
      const ry = isRegional(y, ctx) ? 1 : 0;
      return ry - rx || preference(y, ctx) - preference(x, ctx) || x.name.localeCompare(y.name);
    })
    .slice(0, n);
}

function withStaple(curry: Food, staples: Food[]): string {
  const staple =
    curry.pairsWith.map((id) => staples.find((s) => s.id === id)).find(Boolean) ?? staples[0];
  return staple ? `${curry.name} with ${staple.name.toLowerCase()}` : curry.name;
}

export function buildGuidance(ctx: FoodContext, safety: SafetyResult): Guidance {
  const allowed = ctx.allowed;
  const codes = safety.reasons.map((r) => r.code).filter((c) => c in TIPS);
  const staples = allowed.filter((f) => f.role === 'staple');

  const breakfast = topNames(
    allowed.filter((f) => f.role === 'complete' && f.slots.includes('breakfast')),
    ctx,
    4,
  ).map((f) => f.name);
  const curries = topNames(
    allowed.filter((f) => f.role === 'curry'),
    ctx,
    8,
  );
  const lunch = curries.slice(0, 4).map((c) => withStaple(c, staples));
  const completes = topNames(
    allowed.filter((f) => f.role === 'complete' && f.slots.includes('dinner')),
    ctx,
    2,
  ).map((f) => f.name);
  const dinner = [...curries.slice(4, 6).map((c) => withStaple(c, staples)), ...completes].slice(
    0,
    4,
  );
  const snack = topNames(
    allowed.filter((f) => f.role === 'snack'),
    ctx,
    4,
  ).map((f) => f.name);

  // With kidney disease, protein is for the doctor to set, so no protein list.
  const proteinFoods = codes.includes('kidney')
    ? []
    : topNames(
        allowed.filter((f) => f.role === 'addon' && f.perServing.protein >= 5),
        ctx,
        6,
      ).map((f) => f.name);

  const headlineCode = ['kidney', 'pregnant', 'teen'].find((c) => codes.includes(c)) ?? 'teen';
  return {
    headline: HEADLINES[headlineCode]!,
    mealIdeas: { breakfast, lunch, dinner, snack },
    proteinFoods,
    tips: [...new Set(codes.flatMap((c) => TIPS[c] ?? []))],
  };
}
