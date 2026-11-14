/** Shared dist-directory resolution for every build guard (spec Phase 6). */
export function distDir() {
  if (process.env.LH_AUDIT === '1') return 'dist-audit';
  if (process.env.SHOW_DRAFTS === '1') return 'dist-drafts';
  return 'dist';
}
