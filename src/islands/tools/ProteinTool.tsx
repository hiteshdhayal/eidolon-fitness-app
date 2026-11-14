import { useMemo, useState } from 'preact/hooks';
import {
  PROTEIN_G_PER_KG,
  PROTEIN_FAT_LOSS_ADD,
  PROTEIN_MAX_G_PER_KG,
  PROTEIN_MIN_G_PER_KG_50_PLUS,
  PROTEIN_FLOOR_AGE,
  PROTEIN_ROUND_TO,
} from '../../lib/engine/constants';
import { roundTo } from '../../lib/engine/numbers';

type Goal = 'lose' | 'muscle' | 'healthier' | 'gain';
type TrainingDays = 'none' | '1-2' | '3-4' | '5-6' | '7';

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'healthier', label: 'Eat healthier' },
  { value: 'lose', label: 'Lose fat' },
  { value: 'muscle', label: 'Build muscle' },
  { value: 'gain', label: 'Gain weight' },
];

const TRAINING_OPTIONS: { value: TrainingDays; label: string }[] = [
  { value: 'none', label: 'No training' },
  { value: '1-2', label: '1–2 days/week' },
  { value: '3-4', label: '3–4 days/week' },
  { value: '5-6', label: '5–6 days/week' },
  { value: '7', label: 'Every day' },
];

/** Mirrors src/lib/engine/targets.ts proteinPerKg, with the same constants. */
function proteinPerKg(trainingDays: TrainingDays, goal: Goal, age: number): number {
  let g: number;
  if (trainingDays === '5-6' || trainingDays === '7' || goal === 'muscle') g = PROTEIN_G_PER_KG.high;
  else if (trainingDays === '3-4') g = PROTEIN_G_PER_KG['3-4'];
  else if (trainingDays === '1-2') g = PROTEIN_G_PER_KG['1-2'];
  else g = PROTEIN_G_PER_KG.none;
  if (goal === 'lose') g += PROTEIN_FAT_LOSS_ADD;
  g = Math.min(g, PROTEIN_MAX_G_PER_KG);
  if (age >= PROTEIN_FLOOR_AGE) g = Math.max(g, PROTEIN_MIN_G_PER_KG_50_PLUS);
  return Math.round(g * 100) / 100;
}

export default function ProteinTool() {
  const [weightKg, setWeightKg] = useState<number | undefined>(65);
  const [age, setAge] = useState<number | undefined>(28);
  const [goal, setGoal] = useState<Goal>('healthier');
  const [trainingDays, setTrainingDays] = useState<TrainingDays>('none');

  const result = useMemo(() => {
    if (!weightKg || !age || weightKg <= 0 || age <= 0) return null;
    const gPerKg = proteinPerKg(trainingDays, goal, age);
    const grams = roundTo(weightKg * gPerKg, PROTEIN_ROUND_TO);
    return { gPerKg, grams };
  }, [weightKg, age, goal, trainingDays]);

  return (
    <div class="tool-card">
      <div class="tool-fields">
        <label class="tool-field">
          <span class="eyebrow">Weight (kg)</span>
          <input
            class="tool-input"
            type="number"
            inputMode="decimal"
            min={0}
            value={weightKg ?? ''}
            onInput={(e) => setWeightKg(e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))}
          />
        </label>
        <label class="tool-field">
          <span class="eyebrow">Age</span>
          <input
            class="tool-input"
            type="number"
            inputMode="numeric"
            min={0}
            value={age ?? ''}
            onInput={(e) => setAge(e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))}
          />
        </label>
        <label class="tool-field">
          <span class="eyebrow">Goal</span>
          <select class="tool-input" value={goal} onChange={(e) => setGoal(e.currentTarget.value as Goal)}>
            {GOAL_OPTIONS.map((opt) => (
              <option value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        <label class="tool-field">
          <span class="eyebrow">Training</span>
          <select
            class="tool-input"
            value={trainingDays}
            onChange={(e) => setTrainingDays(e.currentTarget.value as TrainingDays)}
          >
            {TRAINING_OPTIONS.map((opt) => (
              <option value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div class="tool-result" role="status" aria-live="polite">
        {result ? (
          <>
            <p class="tool-result-value">
              {result.grams} <span class="tool-result-unit">g protein/day</span>
            </p>
            <p class="small text-muted">
              About {result.gPerKg} g per kg of body weight. Dal, curd, paneer, chana, sprouts,
              eggs or meat get you there from food — no powder required.
            </p>
          </>
        ) : (
          <p class="small text-muted">Fill in your weight and age.</p>
        )}
      </div>
    </div>
  );
}
