import { describe, expect, it } from 'vitest';
import { runSafetyGate } from '../../src/lib/engine/safety';
import { AnswersSchema } from '../../src/lib/engine/schema';
import {
  computeTargets,
  maxDeficitForRate,
  proteinPerKg,
  stepsTarget,
} from '../../src/lib/engine/targets';
import { make } from './personas';

const T = (o: Parameters<typeof make>[0]) => {
  const a = AnswersSchema.parse(make(o));
  return { a, t: computeTargets(a, runSafetyGate(a)) };
};

describe('calorie targets', () => {
  it('fat loss: −20%, capped at −500 kcal', () => {
    const { t } = T({
      sex: 'male',
      age: 30,
      heightCm: 180,
      weightKg: 100,
      steps: '9-12k',
      trainingDays: '5-6',
    });
    expect(t.goalAdjustmentKcal).toBeGreaterThanOrEqual(-525); // −500 ± rounding to 50
    expect(t.goalAdjustmentKcal).toBeLessThan(-450);
  });
  it('fat loss with BMI under 23: −15%', () => {
    const { t } = T({
      sex: 'male',
      age: 30,
      heightCm: 178,
      weightKg: 70,
      steps: '3-6k',
      trainingDays: 'none',
    });
    expect(t.goalAdjustmentKcal / t.tdee).toBeCloseTo(-0.15, 1);
  });
  it('gentle mode: −10% at most', () => {
    const { t } = T({ age: 67, steps: '3-6k' });
    expect(t.goalAdjustmentKcal / t.tdee).toBeGreaterThanOrEqual(-0.12);
  });
  it('breastfeeding: maintenance, no deficit', () => {
    const { t } = T({ sex: 'female', conditions: ['breastfeeding'], heightCm: 160, weightKg: 65 });
    expect(Math.abs(t.kcal - t.tdee)).toBeLessThanOrEqual(25);
  });
  it('never below the floor: max(BMR, 1,200 for women)', () => {
    const { t } = T({
      sex: 'female',
      age: 45,
      heightCm: 150,
      weightKg: 50,
      steps: 'lt3k',
      trainingDays: 'none',
    });
    expect(t.kcal).toBeGreaterThanOrEqual(Math.max(t.bmr, 1200));
  });
  it('never below 1,500 for men', () => {
    const { t } = T({
      sex: 'male',
      age: 60,
      heightCm: 158,
      weightKg: 52,
      steps: 'lt3k',
      trainingDays: 'none',
    });
    expect(t.kcal).toBeGreaterThanOrEqual(1500);
  });
  it('rounds to the nearest 50', () => {
    const { t } = T({});
    expect(t.kcal % 50).toBe(0);
  });
  it('never more than 1% of body weight lost per week', () => {
    const { a, t } = T({
      sex: 'female',
      heightCm: 152,
      weightKg: 44,
      age: 25,
      steps: 'gt12k',
      trainingDays: '7',
    });
    expect(-t.goalAdjustmentKcal).toBeLessThanOrEqual(maxDeficitForRate(a.weightKg) + 25);
  });
  it('build muscle: +250 kcal with BMI < 23, maintenance otherwise', () => {
    const lean = T({ goal: 'muscle', heightCm: 178, weightKg: 68 }).t;
    expect(lean.goalAdjustmentKcal).toBeGreaterThan(200);
    const heavier = T({ goal: 'muscle', heightCm: 175, weightKg: 85 }).t;
    expect(Math.abs(heavier.goalAdjustmentKcal)).toBeLessThanOrEqual(25);
  });
  it('gain weight: +15%, capped at +500', () => {
    const { t } = T({
      goal: 'gain',
      heightCm: 185,
      weightKg: 62,
      steps: 'gt12k',
      trainingDays: '5-6',
    });
    expect(t.goalAdjustmentKcal).toBeLessThanOrEqual(525);
    expect(t.goalAdjustmentKcal).toBeGreaterThan(400);
  });
});

describe('protein', () => {
  it('not training: 1.0 g/kg; training 5+ days: 1.6; +0.2 in fat loss; cap 1.8', () => {
    const a = AnswersSchema.parse(make({ trainingDays: 'none' }));
    expect(proteinPerKg(a, 'healthier', false)).toBe(1.0);
    expect(proteinPerKg({ ...a, trainingDays: '5-6' }, 'healthier', false)).toBe(1.6);
    expect(proteinPerKg({ ...a, trainingDays: '5-6' }, 'lose', true)).toBe(1.8);
    expect(proteinPerKg({ ...a, trainingDays: '1-2' }, 'lose', true)).toBe(1.4);
  });
  it('uses the weight at BMI 25 when BMI is above 25', () => {
    const { t } = T({ heightCm: 170, weightKg: 95 });
    expect(t.referenceWeightKg).toBeCloseTo(72.3, 1);
  });
  it('rounds to the nearest 5 g', () => {
    expect(T({}).t.protein % 5).toBe(0);
  });
});

describe('macros and the rest', () => {
  it('lower-carb conditions keep carbs ≤ 45%', () => {
    const { t } = T({
      sex: 'female',
      conditions: ['pcos'],
      heightCm: 158,
      weightKg: 70,
      trainingDays: 'none',
    });
    expect(t.lowerCarb).toBe(true);
    expect(t.carbPct).toBeLessThanOrEqual(45);
  });
  it('fat is 25–30% (≥ 0.6 g/kg) and macros add up to the calories', () => {
    const { t } = T({});
    const fatPct = (t.fat * 9) / t.kcal;
    expect(fatPct).toBeGreaterThanOrEqual(0.24);
    expect(fatPct).toBeLessThanOrEqual(0.36);
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThan(15);
  });
  it('fibre 25–40 g, water 35 ml/kg (+500 on training days), salt < 5 g', () => {
    const { t } = T({ weightKg: 80 });
    expect(t.fiber).toBeGreaterThanOrEqual(25);
    expect(t.fiber).toBeLessThanOrEqual(40);
    expect(t.waterMl).toBe(2800);
    expect(t.waterMlTrainingDay).toBe(3300);
    expect(t.saltG).toBe(5);
  });
  it('steps: band midpoint + 2,000, capped at 10,000; higher stays put', () => {
    const S = (o: Parameters<typeof make>[0]) => stepsTarget(AnswersSchema.parse(make(o)));
    expect(S({ steps: '3-6k' })).toBe(6500);
    expect(S({ steps: '6-9k' })).toBe(9500);
    expect(S({ steps: '9-12k' })).toBe(10500);
    expect(S({ steps: 'unsure', dayType: 'sitting' })).toBe(5000);
  });
  it('explains the numbers in plain language', () => {
    const { t } = T({});
    expect(t.explain.map((e) => e.title)).toEqual([
      'Your body at rest',
      'Your activity',
      'Your goal',
      'Why protein is set here',
      'Carbs and fat',
      'Water, salt and steps',
    ]);
    expect(t.explain[0]!.text).toContain(t.bmr.toLocaleString('en-IN'));
  });
});
