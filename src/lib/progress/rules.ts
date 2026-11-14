/**
 * Gentle suggestions (spec §10) and the weekly check-in nudge. At most one
 * suggestion card shows at a time. Nothing here judges a gain or a loss.
 */
import { addDays, daysBetween, todayLocal } from './dates';
import { smoothed, valueNear } from './stats';
import type { Entry } from './schema';

export type RuleId = 'fastLoss' | 'bigChange' | 'plateau';

export interface RuleResult {
  id: RuleId;
  title: string;
  body: string;
  suggestions: string[];
  action?: 'updatePlan';
}

export interface RuleInput {
  entries: Entry[];
  today: string;
  /** Saved answers.weightKg — the weight when the plan was made. */
  planWeightKg: number;
  effectiveGoal: 'lose' | 'muscle' | 'healthier' | 'gain';
  mode: 'full' | 'gentle' | 'guidance';
  dismissedRules: Record<string, string>;
}

const DISMISS_DAYS = 14;

function sorted(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function isDismissed(dismissed: Record<string, string>, id: RuleId, today: string): boolean {
  const on = dismissed[id];
  if (!on) return false;
  return daysBetween(on, today) < DISMISS_DAYS;
}

function fastLoss(entries: Entry[], latestDate: string): RuleResult | null {
  const a = valueNear(entries, addDays(latestDate, -14));
  const b = valueNear(entries, addDays(latestDate, -7));
  const c = smoothed(entries, latestDate);
  if (a === undefined || b === undefined || c === undefined) return null;
  if (!(a - b > 0.01 * a && b - c > 0.01 * b)) return null;

  return {
    id: 'fastLoss',
    title: "You're losing faster than you need to",
    body: "For two weeks in a row you've lost more than 1% of your weight a week. Slower loss is easier to keep and protects your muscle. Add a little food — about 200 kcal a day:",
    suggestions: [
      '1 more roti or ½ katori more rice at lunch',
      'A katori of curd or dal with dinner',
      'A fruit or a small handful of roasted chana at your evening snack',
      "If you're feeling tired or dizzy, talk to a doctor.",
    ],
    action: 'updatePlan',
  };
}

function bigChange(latestWeight: number, planWeightKg: number): RuleResult | null {
  const difference = latestWeight - planWeightKg;
  if (Math.abs(difference) < 3) return null;
  const word = difference < 0 ? 'lost' : 'gained';
  const amount = Math.abs(difference).toFixed(1);
  return {
    id: 'bigChange',
    title: 'Your weight has changed since this plan was made',
    body: `You've ${word} ${amount} kg since your plan was made. Update your plan so your numbers match the body you have now.`,
    suggestions: [],
    action: 'updatePlan',
  };
}

function plateau(
  entries: Entry[],
  latestDate: string,
  effectiveGoal: RuleInput['effectiveGoal'],
): RuleResult | null {
  if (effectiveGoal !== 'lose') return null;
  const past = valueNear(entries, addDays(latestDate, -21));
  const now = smoothed(entries, latestDate);
  if (past === undefined || now === undefined) return null;
  if (Math.abs(now - past) > 0.3) return null;
  const windowStart = addDays(latestDate, -21);
  const within = entries.filter((entry) => entry.date >= windowStart && entry.date <= latestDate);
  if (within.length < 3) return null;

  return {
    id: 'plateau',
    title: 'Your weight has held steady for 3 weeks',
    body: "That's normal now and then. If you'd like it moving again, pick one of these for the next two weeks:",
    suggestions: [
      'Add 1,000 steps a day',
      'Measure rice, dal and oil for a week — portions creep up without us noticing',
      'Keep oil to about 3–4 teaspoons a day across all meals',
      'Weigh at the same time on the same day each week, before breakfast',
    ],
  };
}

export function evaluateRules(input: RuleInput): RuleResult | null {
  const { entries, today, planWeightKg, effectiveGoal, mode, dismissedRules } = input;
  if (mode === 'guidance') return null;

  const list = sorted(entries);
  const latest = list[list.length - 1];
  if (!latest) return null;

  const candidates: (RuleResult | null)[] = [
    fastLoss(list, latest.date),
    bigChange(latest.weightKg, planWeightKg),
    plateau(list, latest.date, effectiveGoal),
  ];

  for (const candidate of candidates) {
    if (candidate && !isDismissed(dismissedRules, candidate.id, today)) return candidate;
  }
  return null;
}

/** Is the weekly check-in nudge due today? */
export function isNudgeDue(input: {
  savedAt: string;
  entries: Entry[];
  nudgeDismissedOn?: string;
  today: string;
}): boolean {
  const { savedAt, entries, nudgeDismissedOn, today } = input;

  const savedDate = todayLocal(new Date(savedAt));
  if (daysBetween(savedDate, today) < 7) return false;

  const list = sorted(entries);
  const latest = list[list.length - 1];
  if (latest && daysBetween(latest.date, today) <= 7) return false;

  if (nudgeDismissedOn && daysBetween(nudgeDismissedOn, today) <= 7) return false;

  return true;
}
