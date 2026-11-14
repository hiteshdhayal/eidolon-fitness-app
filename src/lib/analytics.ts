/**
 * Safe Umami wrapper (spec §18). Umami itself arrives in Phase 6; until then
 * this is a no-op. Analytics must never break the app.
 *
 * Never pass age, weight, height, conditions, medications or names.
 */
interface Umami {
  track: (event: string, data?: Record<string, string | number>) => void;
}

export function track(event: string, data?: Record<string, string | number>): void {
  try {
    const scope = window as unknown as { umami?: Umami };
    scope.umami?.track(event, data);
  } catch {
    // ignore — analytics is best-effort
  }
}
