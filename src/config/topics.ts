/**
 * One fixed topic vocabulary (spec §12/§13). Used by reels, articles, the
 * related-content matcher and the filters.
 */
export const TOPICS = {
  'fat-loss': 'Fat loss',
  muscle: 'Muscle',
  protein: 'Protein',
  pcos: 'PCOS',
  diabetes: 'Diabetes',
  thyroid: 'Thyroid',
  'veg-protein': 'Veg protein',
  budget: 'Budget food',
  'regional-food': 'Regional food',
  hostel: 'Hostel & eating out',
  supplements: 'Supplements',
  workouts: 'Workouts',
  myths: 'Myths',
} as const;

export type Topic = keyof typeof TOPICS;

export const TOPIC_KEYS = Object.keys(TOPICS) as [Topic, ...Topic[]];

export function topicLabel(topic: Topic): string {
  return TOPICS[topic];
}
