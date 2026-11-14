/**
 * Progress log schema (spec §10). One localStorage key, `eidolon:progress:v1`,
 * versioned and validated like the other keys. The tracker only ever reads the
 * saved plan; it never recalculates targets.
 */
import { z } from 'zod';

export const EntrySchema = z.object({
  /** crypto.randomUUID() with a fallback; see storage.ts. */
  id: z.string().min(1),
  /** Local calendar date, YYYY-MM-DD. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weightKg: z.number().min(30).max(250),
  waistCm: z.number().min(40).max(200).optional(),
  /** ISO timestamp. */
  createdAt: z.string(),
});

export const ProgressSchema = z.object({
  v: z.literal(1),
  entries: z.array(EntrySchema).max(2000),
  /** YYYY-MM-DD the weekly nudge was last dismissed. */
  nudgeDismissedOn: z.string().optional(),
  /** Rule ids the person closed, with the date. A closed rule stays hidden for 14 days. */
  dismissedRules: z.record(z.string(), z.string()).default({}),
});

export type Entry = z.infer<typeof EntrySchema>;
export type Progress = z.infer<typeof ProgressSchema>;
