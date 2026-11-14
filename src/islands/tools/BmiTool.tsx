import { useMemo, useState } from 'preact/hooks';
import { bmi, bmiBand, weightAtBmi } from '../../lib/engine/numbers';
import { BMI_CUTOFFS } from '../../lib/engine/constants';

const BAND_LABEL: Record<string, string> = {
  underweight: 'Underweight',
  healthy: 'Healthy range',
  overweight: 'Overweight',
  obese: 'Obese',
};

export default function BmiTool() {
  const [heightCm, setHeightCm] = useState<number | undefined>(165);
  const [weightKg, setWeightKg] = useState<number | undefined>(65);

  const result = useMemo(() => {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
    const value = bmi(weightKg, heightCm);
    const band = bmiBand(value);
    const lowKg = weightAtBmi(BMI_CUTOFFS.underweight, heightCm);
    const highKg = weightAtBmi(BMI_CUTOFFS.healthy, heightCm);
    return { value, band, lowKg, highKg };
  }, [heightCm, weightKg]);

  return (
    <div class="tool-card">
      <div class="tool-fields">
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
      </div>

      <div class="tool-result" role="status" aria-live="polite">
        {result ? (
          <>
            <p class="tool-result-value">
              {result.value.toFixed(1)} <span class="tool-result-unit">BMI</span>
            </p>
            <p class="tool-result-band">{BAND_LABEL[result.band]}</p>
            <p class="small text-muted">
              For your height, a healthy-range weight is about {Math.round(result.lowKg)}–
              {Math.round(result.highKg)} kg, using the WHO Asia-Pacific cut-offs used in India.
            </p>
          </>
        ) : (
          <p class="small text-muted">Enter your height and weight.</p>
        )}
      </div>

      <p class="small text-muted tool-note">
        These bands are for adults. If you're under 18, pregnant or an athlete with a lot of
        muscle, BMI alone doesn't tell the full story — talk to a doctor.
      </p>
    </div>
  );
}
