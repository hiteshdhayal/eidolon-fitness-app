import { useMemo, useState } from 'preact/hooks';
import { bmr, activityFactor, tdee } from '../../lib/engine/numbers';

type Sex = 'male' | 'female' | 'unspecified';
type Steps = 'lt3k' | '3-6k' | '6-9k' | '9-12k' | 'gt12k' | 'unsure';
type DayType = 'sitting' | 'someWalking' | 'onFeet' | 'physical';
type TrainingDays = 'none' | '1-2' | '3-4' | '5-6' | '7';

const STEP_OPTIONS: { value: Steps; label: string }[] = [
  { value: 'lt3k', label: 'Under 3,000 steps/day' },
  { value: '3-6k', label: '3,000–6,000 steps/day' },
  { value: '6-9k', label: '6,000–9,000 steps/day' },
  { value: '9-12k', label: '9,000–12,000 steps/day' },
  { value: 'gt12k', label: 'Over 12,000 steps/day' },
  { value: 'unsure', label: "I'm not sure" },
];

const DAY_TYPE_OPTIONS: { value: DayType; label: string }[] = [
  { value: 'sitting', label: 'Mostly sitting' },
  { value: 'someWalking', label: 'Some walking' },
  { value: 'onFeet', label: 'On my feet most of the day' },
  { value: 'physical', label: 'Physically active work' },
];

const TRAINING_OPTIONS: { value: TrainingDays; label: string }[] = [
  { value: 'none', label: 'No training' },
  { value: '1-2', label: '1–2 days/week' },
  { value: '3-4', label: '3–4 days/week' },
  { value: '5-6', label: '5–6 days/week' },
  { value: '7', label: 'Every day' },
];

export default function CalorieTool() {
  const [sex, setSex] = useState<Sex>('female');
  const [age, setAge] = useState<number | undefined>(28);
  const [heightCm, setHeightCm] = useState<number | undefined>(165);
  const [weightKg, setWeightKg] = useState<number | undefined>(65);
  const [steps, setSteps] = useState<Steps>('3-6k');
  const [dayType, setDayType] = useState<DayType>('sitting');
  const [trainingDays, setTrainingDays] = useState<TrainingDays>('none');

  const result = useMemo(() => {
    if (!age || !heightCm || !weightKg || age <= 0 || heightCm <= 0 || weightKg <= 0) return null;
    const answers = { sex, age, heightCm, weightKg, steps, dayType, trainingDays };
    const rest = bmr(answers);
    const af = activityFactor(answers);
    const maintenance = tdee(answers);
    return { rest: Math.round(rest), af, maintenance: Math.round(maintenance) };
  }, [sex, age, heightCm, weightKg, steps, dayType, trainingDays]);

  const isMinor = age !== undefined && age > 0 && age < 18;

  return (
    <div class="tool-card">
      <div class="tool-fields">
        <label class="tool-field">
          <span class="eyebrow">Sex</span>
          <select class="tool-input" value={sex} onChange={(e) => setSex(e.currentTarget.value as Sex)}>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="unspecified">Prefer not to say</option>
          </select>
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
          <span class="eyebrow">Height (cm)</span>
          <input
            class="tool-input"
            type="number"
            inputMode="decimal"
            min={0}
            value={heightCm ?? ''}
            onInput={(e) => setHeightCm(e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))}
          />
        </label>
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
          <span class="eyebrow">Daily steps</span>
          <select class="tool-input" value={steps} onChange={(e) => setSteps(e.currentTarget.value as Steps)}>
            {STEP_OPTIONS.map((opt) => (
              <option value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </label>
        {steps === 'unsure' && (
          <label class="tool-field">
            <span class="eyebrow">Most days I'm</span>
            <select class="tool-input" value={dayType} onChange={(e) => setDayType(e.currentTarget.value as DayType)}>
              {DAY_TYPE_OPTIONS.map((opt) => (
                <option value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}
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
        {isMinor ? (
          <p class="small text-muted">
            I don't show exact calorie numbers for under-18s here — bodies that are still growing
            need a doctor or dietitian's judgement, not a formula. Eat regular, balanced meals
            built around dal, vegetables, curd, roti or rice, and a protein source at each meal.
          </p>
        ) : result ? (
          <>
            <p class="tool-result-value">
              {result.maintenance} <span class="tool-result-unit">kcal/day to maintain weight</span>
            </p>
            <p class="small text-muted">
              That's your resting burn (about {result.rest} kcal) times an activity factor of{' '}
              {result.af.toFixed(2)}. To lose fat at a safe, steady rate, most people eat
              roughly 300–500 kcal below this. To build muscle, roughly 200–300 above. The full
              plan works out your exact number, adjusted for your health and goal.
            </p>
          </>
        ) : (
          <p class="small text-muted">Fill in your details.</p>
        )}
      </div>
    </div>
  );
}
