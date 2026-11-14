/**
 * Draft gate (rule 3). One helper used by every collection query so drafts
 * never leak into production pages, the sitemap, RSS, /links or related lists.
 */

export interface PublishEnv {
  dev: boolean;
  showDrafts: boolean;
  /** LH_AUDIT=1 (spec Phase 6 Part E): drafts render without the DRAFT tag or noindex. */
  lhAudit: boolean;
}

export interface DraftableEntry {
  data: { draft?: boolean };
}

export function currentEnv(): PublishEnv {
  const viteEnv = import.meta.env as unknown as Record<string, unknown>;
  const nodeEnv =
    typeof process !== 'undefined' ? (process.env as Record<string, string | undefined>) : {};
  return {
    dev: Boolean(viteEnv.DEV),
    showDrafts: viteEnv.SHOW_DRAFTS === '1' || nodeEnv.SHOW_DRAFTS === '1',
    lhAudit: viteEnv.LH_AUDIT === '1' || nodeEnv.LH_AUDIT === '1',
  };
}

/**
 * Whether a draft page should still look and behave like a draft (the
 * DRAFT tag, noindex). False in LH_AUDIT mode, so Lighthouse can score the
 * page as if it shipped — the content itself is unchanged.
 */
export function showDraftTag(draft: boolean | undefined, env: PublishEnv = currentEnv()): boolean {
  return Boolean(draft) && !env.lhAudit;
}

/** True for non-drafts, or for everything in dev / SHOW_DRAFTS mode. */
export function isPublished(entry: DraftableEntry, env: PublishEnv = currentEnv()): boolean {
  if (!entry.data.draft) return true;
  return env.dev || env.showDrafts;
}

/** Filter a collection down to what may ship. */
export function publishedOnly<T extends DraftableEntry>(
  entries: readonly T[],
  env: PublishEnv = currentEnv(),
): T[] {
  return entries.filter((entry) => isPublished(entry, env));
}
