/**
 * Button order for /links/ (spec §15). Edit this array to reorder; each key
 * is resolved to a real button only when it has somewhere to go — an empty
 * key (e.g. no published reel yet) is skipped, never shown broken.
 */
export type LinkButtonKey = 'plan' | 'latest' | 'picks' | 'learn' | 'instagram';

export const LINKS_ORDER: readonly LinkButtonKey[] = [
  'plan',
  'latest',
  'picks',
  'learn',
  'instagram',
];
