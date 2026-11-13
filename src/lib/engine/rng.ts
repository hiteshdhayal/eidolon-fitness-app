/**
 * Deterministic randomness (spec §7.3): the same answers always give the
 * same plan. No Math.random anywhere in the engine.
 */

/** JSON with sorted keys, so key order never changes the hash. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

/** cyrb53-style 32-bit string hash. Stable across browsers and Node. */
export function hashString(str: string, seed = 0): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

export function hashAnswers(answers: unknown): number {
  return hashString(canonicalJson(answers));
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Pick one item, weighted. Returns undefined for an empty list. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T | undefined;
}

/** mulberry32: tiny, fast, good enough for picking dishes. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    weighted(items, weight) {
      if (items.length === 0) return undefined;
      const ws = items.map((it) => Math.max(0, weight(it)));
      const total = ws.reduce((s, w) => s + w, 0);
      if (total <= 0) return items[Math.floor(next() * items.length)];
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= ws[i]!;
        if (r < 0) return items[i];
      }
      return items[items.length - 1];
    },
  };
}

/** Derive an independent seed for a sub-task (a day, a shuffle). */
export function subSeed(seed: number, ...parts: (string | number)[]): number {
  return hashString(parts.join('|'), seed);
}
