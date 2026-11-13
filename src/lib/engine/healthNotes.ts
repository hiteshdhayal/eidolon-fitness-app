/**
 * Which health notes (src/content/health-notes/*.md) apply to a person
 * (spec §7.4). The `appliesTo` rules here mirror each note's frontmatter;
 * a test keeps the two in sync.
 *
 * Rule syntax: "condition:pcos", "medication:thyroid", "restriction:lactose".
 * Join terms with "+" for AND. A note applies if ANY of its rules match.
 * "condition:hypothyroid|thyroid" means either condition.
 */
import type { Answers } from './types';

export interface HealthNoteRule {
  id: string;
  appliesTo: string[];
  priority: number;
}

export const HEALTH_NOTE_RULES: readonly HealthNoteRule[] = [
  { id: 'diabetes', appliesTo: ['condition:diabetes'], priority: 10 },
  { id: 'metformin', appliesTo: ['medication:diabetesTablets'], priority: 15 },
  { id: 'pcos', appliesTo: ['condition:pcos'], priority: 20 },
  {
    id: 'hypothyroid',
    appliesTo: ['condition:hypothyroid|thyroid+medication:thyroid'],
    priority: 25,
  },
  { id: 'high-bp', appliesTo: ['condition:highBP'], priority: 30 },
  {
    id: 'cholesterol-liver',
    appliesTo: ['condition:cholesterol', 'condition:fattyLiver'],
    priority: 35,
  },
  { id: 'gout', appliesTo: ['condition:uricAcid'], priority: 40 },
  { id: 'anaemia', appliesTo: ['condition:anaemia'], priority: 45 },
  { id: 'vitamin-d-b12', appliesTo: ['condition:vitaminDB12'], priority: 50 },
  { id: 'acidity-ibs', appliesTo: ['condition:acidityIBS'], priority: 55 },
  { id: 'menopause', appliesTo: ['condition:menopause'], priority: 60 },
  { id: 'lactose', appliesTo: ['restriction:lactose'], priority: 70 },
];

function termMatches(term: string, a: Answers): boolean {
  const [kind, values] = term.split(':') as [string, string | undefined];
  const options = (values ?? '').split('|');
  const list: readonly string[] =
    kind === 'condition'
      ? a.conditions
      : kind === 'medication'
        ? a.medications
        : kind === 'restriction'
          ? a.restrictions
          : [];
  return options.some((o) => list.includes(o));
}

export function matchesAppliesTo(appliesTo: readonly string[], a: Answers): boolean {
  return appliesTo.some((rule) => rule.split('+').every((term) => termMatches(term.trim(), a)));
}

/** Note ids for this person, most important first. */
export function selectHealthNotes(
  a: Answers,
  rules: readonly HealthNoteRule[] = HEALTH_NOTE_RULES,
): string[] {
  return rules
    .filter((r) => matchesAppliesTo(r.appliesTo, a))
    .sort((x, y) => x.priority - y.priority)
    .map((r) => r.id);
}
