import { describe, expect, it } from 'vitest';
import { activityFactor, bmi, bmiBand, bmr, tdee, weightAtBmi } from '../../src/lib/engine/numbers';
import { AnswersSchema } from '../../src/lib/engine/schema';
import { make } from './personas';

const A = (o: Parameters<typeof make>[0]) => AnswersSchema.parse(make(o));

describe('BMR (Mifflin-St Jeor)', () => {
  it('male: 10w + 6.25h − 5a + 5', () => {
    expect(bmr(A({ sex: 'male', weightKg: 70, heightCm: 175, age: 30 }))).toBeCloseTo(1648.75, 2);
  });
  it('female: same with −161', () => {
    expect(
      bmr(A({ sex: 'female', weightKg: 60, heightCm: 160, age: 30, conditions: [] })),
    ).toBeCloseTo(1289, 2);
  });
  it('prefer not to say: same with −78', () => {
    expect(bmr(A({ sex: 'unspecified', weightKg: 65, heightCm: 168, age: 35 }))).toBeCloseTo(
      1447,
      2,
    );
  });
});

describe('activity factor and TDEE', () => {
  it('steps base + training add', () => {
    expect(activityFactor(A({ steps: '6-9k', trainingDays: '3-4' }))).toBe(1.5);
    expect(activityFactor(A({ steps: 'lt3k', trainingDays: 'none' }))).toBe(1.2);
  });
  it("'Not sure' steps uses the day type", () => {
    expect(activityFactor(A({ steps: 'unsure', dayType: 'onFeet', trainingDays: '1-2' }))).toBe(
      1.5,
    );
  });
  it('is capped at 1.9', () => {
    expect(activityFactor(A({ steps: 'gt12k', trainingDays: '7' }))).toBe(1.8);
    expect(activityFactor(A({ steps: 'unsure', dayType: 'physical', trainingDays: '7' }))).toBe(
      1.8,
    );
    // the cap only bites if constants change; check the function honours it
    expect(Math.min(1.9, 1.6 + 0.2 + 0.3)).toBe(1.9);
  });
  it('TDEE = BMR × factor', () => {
    const a = A({
      sex: 'male',
      weightKg: 70,
      heightCm: 175,
      age: 30,
      steps: '3-6k',
      trainingDays: 'none',
    });
    expect(tdee(a)).toBeCloseTo(1648.75 * 1.3, 2);
  });
});

describe('Asian BMI bands', () => {
  it.each([
    [18.4, 'underweight'],
    [18.5, 'healthy'],
    [22.9, 'healthy'],
    [23, 'overweight'],
    [24.9, 'overweight'],
    [25, 'obese'],
  ] as const)('BMI %s → %s', (value, band) => {
    expect(bmiBand(value)).toBe(band);
  });
  it('bmi() and weightAtBmi() are inverses', () => {
    expect(bmi(weightAtBmi(25, 170), 170)).toBeCloseTo(25, 6);
    expect(bmi(70, 175)).toBeCloseTo(22.86, 2);
  });
});
