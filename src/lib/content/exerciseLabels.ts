/** Human-readable labels for the exercise/workout enums (spec §11). */
export const MUSCLE_LABELS: Record<string, string> = {
  quads: 'Quads',
  glutes: 'Glutes',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  chest: 'Chest',
  back: 'Back',
  lats: 'Lats',
  shoulders: 'Shoulders',
  triceps: 'Triceps',
  biceps: 'Biceps',
  core: 'Core',
  'full-body': 'Full body',
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  none: 'No equipment',
  dumbbells: 'Dumbbells',
  barbell: 'Barbell',
  machine: 'Machine',
  band: 'Band',
};

export const LEVEL_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export const WHERE_LABELS: Record<string, string> = {
  home: 'Home',
  gym: 'Gym',
  anywhere: 'Anywhere',
};

export function muscleLabel(key: string): string {
  return MUSCLE_LABELS[key] ?? key;
}

export function equipmentLabel(key: string): string {
  return EQUIPMENT_LABELS[key] ?? key;
}

export function levelLabel(key: string): string {
  return LEVEL_LABELS[key] ?? key;
}

export function whereLabel(key: string): string {
  return WHERE_LABELS[key] ?? key;
}
