/**
 * Export / import of everything on the device (spec §9). Pure apart from the
 * Blob download helper. Import always replaces — it never merges.
 */
import { z } from 'zod';
import {
  clearPlan,
  GroceriesSchema,
  migrate,
  readPlan,
  readProgress,
  readStoredGroceries,
  SavedPlanSchema,
  writePlan,
  writeProgress,
  writeStoredGroceries,
  type Groceries,
  type SavedPlan,
} from '../storage';
import { ProgressSchema, type Progress } from './schema';

export const MAX_IMPORT_BYTES = 1_000_000;

export const ExportSchema = z.object({
  app: z.literal('eidolon'),
  exportVersion: z.literal(1),
  exportedAt: z.string(),
  plan: SavedPlanSchema.nullable(),
  progress: ProgressSchema,
  groceries: GroceriesSchema.nullable(),
});

export type ExportBundle = z.infer<typeof ExportSchema>;

export function buildExport(now: Date = new Date()): ExportBundle {
  return {
    app: 'eidolon',
    exportVersion: 1,
    exportedAt: now.toISOString(),
    plan: readPlan(),
    progress: readProgress(),
    groceries: readStoredGroceries(),
  };
}

export function isTooBig(bytes: number): boolean {
  return bytes > MAX_IMPORT_BYTES;
}

export function parseExport(text: string): ExportBundle | null {
  try {
    const raw = JSON.parse(text) as Record<string, unknown> | null;
    if (!raw || typeof raw !== 'object') return null;
    // The bundle itself has no `v`; migrate the versioned sub-objects.
    const migrated = {
      ...raw,
      plan: migrate(raw.plan),
      progress: migrate(raw.progress),
      groceries: migrate(raw.groceries),
    };
    const parsed = ExportSchema.safeParse(migrated);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Replace all three keys (or remove them when the bundle has none). */
export function applyImport(bundle: ExportBundle): void {
  if (bundle.plan) writePlan(bundle.plan);
  else clearPlan();
  writeProgress(bundle.progress);
  writeStoredGroceries(bundle.groceries);
}

export function downloadExport(bundle: ExportBundle, today: string): void {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `eidolon-data-${today}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoke a beat later so the download is not cancelled.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type { Groceries, Progress, SavedPlan };
