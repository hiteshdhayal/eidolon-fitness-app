/**
 * Pure formulas (spec §7.2). No rounding to display values here except
 * where the spec says so; targets.ts rounds for display.
 */
import {
  BMI_CUTOFFS,
  BMR_SEX_CONSTANT,
  DAY_TYPE_FACTOR,
  MAX_ACTIVITY_FACTOR,
  STEPS_BASE_FACTOR,
  TRAINING_ADD,
} from './constants';
import type { Answers, BmiBand } from './types';

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** Asian (WHO Asia-Pacific) bands. */
export function bmiBand(value: number): BmiBand {
  if (value < BMI_CUTOFFS.underweight) return 'underweight';
  if (value < BMI_CUTOFFS.healthy) return 'healthy';
  if (value < BMI_CUTOFFS.overweight) return 'overweight';
  return 'obese';
}

/** Weight (kg) at a given BMI for this height. */
export function weightAtBmi(targetBmi: number, heightCm: number): number {
  const m = heightCm / 100;
  return targetBmi * m * m;
}

/** Mifflin-St Jeor. */
export function bmr(a: Pick<Answers, 'weightKg' | 'heightCm' | 'age' | 'sex'>): number {
  return 10 * a.weightKg + 6.25 * a.heightCm - 5 * a.age + BMR_SEX_CONSTANT[a.sex];
}

export function activityFactor(a: Pick<Answers, 'steps' | 'dayType' | 'trainingDays'>): number {
  const base =
    a.steps === 'unsure' ? DAY_TYPE_FACTOR[a.dayType ?? 'sitting'] : STEPS_BASE_FACTOR[a.steps];
  const factor = base + TRAINING_ADD[a.trainingDays];
  return Math.min(MAX_ACTIVITY_FACTOR, Math.round(factor * 100) / 100);
}

export function tdee(
  a: Pick<Answers, 'weightKg' | 'heightCm' | 'age' | 'sex' | 'steps' | 'dayType' | 'trainingDays'>,
): number {
  return bmr(a) * activityFactor(a);
}

export const roundTo = (value: number, step: number) => Math.round(value / step) * step;
export const floorTo = (value: number, step: number) => Math.floor(value / step) * step;
