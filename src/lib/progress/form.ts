/**
 * Check-in form validation (pure). Kept here so the island only renders.
 */
import { daysBetween } from './dates';

export interface EntryDraft {
  weight: string;
  date: string;
  waist: string;
}

export interface EntryValue {
  date: string;
  weightKg: number;
  waistCm?: number;
}

export interface EntryErrors {
  weight?: string;
  date?: string;
  waist?: string;
}

export const WEIGHT_ERROR = 'Enter a weight between 30 and 250 kg.';
export const DATE_ERROR = 'Pick a date in the last 2 years, not in the future.';
export const WAIST_ERROR = 'Enter a waist between 40 and 200 cm.';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AGE_DAYS = 730;

export function validateEntry(
  draft: EntryDraft,
  today: string,
): { errors: EntryErrors; value?: EntryValue } {
  const errors: EntryErrors = {};

  const weight = Number(draft.weight);
  if (draft.weight.trim() === '' || !Number.isFinite(weight) || weight < 30 || weight > 250) {
    errors.weight = WEIGHT_ERROR;
  }

  if (!DATE_RE.test(draft.date)) {
    errors.date = DATE_ERROR;
  } else {
    const age = daysBetween(draft.date, today);
    if (age < 0 || daysBetween(today, draft.date) > MAX_AGE_DAYS) errors.date = DATE_ERROR;
  }

  let waist: number | undefined;
  if (draft.waist.trim() !== '') {
    waist = Number(draft.waist);
    if (!Number.isFinite(waist) || waist < 40 || waist > 200) errors.waist = WAIST_ERROR;
  }

  if (Object.keys(errors).length > 0) return { errors };
  return { errors, value: { date: draft.date, weightKg: weight, waistCm: waist } };
}
