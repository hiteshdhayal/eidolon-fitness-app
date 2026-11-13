import { describe, expect, it } from 'vitest';
import { runSafetyGate } from '../../src/lib/engine/safety';
import { AnswersSchema } from '../../src/lib/engine/schema';
import { make } from './personas';

const gate = (o: Parameters<typeof make>[0]) => runSafetyGate(AnswersSchema.parse(make(o)));
const codes = (o: Parameters<typeof make>[0]) => gate(o).reasons.map((r) => r.code);

describe('safety gate: guidance mode', () => {
  it('under 18 → guidance, no numbers', () => {
    const s = gate({ age: 17 });
    expect(s.mode).toBe('guidance');
    expect(s.showNumbers).toBe(false);
    expect(s.reasons[0]?.message).toMatch(/parent or doctor/);
  });
  it('pregnant → guidance, gynaecologist note', () => {
    const s = gate({ sex: 'female', conditions: ['pregnant'] });
    expect(s.mode).toBe('guidance');
    expect(s.reasons.find((r) => r.code === 'pregnant')?.message).toMatch(
      /gynaecologist or a registered dietitian/,
    );
  });
  it('kidney disease → guidance, no protein target', () => {
    const s = gate({ conditions: ['kidney'] });
    expect(s.mode).toBe('guidance');
    expect(s.showProteinTarget).toBe(false);
  });
  it("a teen's too-low target weight gets no 'aim for X kg' number", () => {
    const s = gate({ age: 16, heightCm: 170, weightKg: 60, targetWeightKg: 45 });
    expect(s.targetWeightRejected).toBe(true);
    expect(s.reasons.map((r) => r.message).join(' ')).not.toMatch(/\d+ kg/);
  });
});

describe('safety gate: gentle mode', () => {
  it('breastfeeding → gentle, maintenance only', () => {
    const s = gate({ sex: 'female', conditions: ['breastfeeding'] });
    expect(s.mode).toBe('gentle');
    expect(s.maxDeficitPct).toBe(0);
  });
  const cases: [string, Parameters<typeof make>[0]][] = [
    ['type 1 diabetes', { conditions: ['diabetes'], diabetesType: 'type1' }],
    ['insulin', { conditions: ['diabetes'], diabetesType: 'type2', medications: ['insulin'] }],
    [
      'diabetes tablets',
      { conditions: ['diabetes'], diabetesType: 'type2', medications: ['diabetesTablets'] },
    ],
  ];
  it.each(cases)('%s → gentle, ≤10%% deficit, low-sugar note, carbs spread', (_, o) => {
    const s = gate(o);
    expect(s.mode).toBe('gentle');
    expect(s.maxDeficitPct).toBe(0.1);
    expect(s.spreadCarbsEvenly).toBe(true);
    expect(s.reasons.find((r) => r.code === 'diabetesMeds')?.message).toContain(
      'insulin or glimepiride',
    );
  });
  it('heart condition → gentle ≤10%', () => {
    expect(gate({ conditions: ['heart'] })).toMatchObject({ mode: 'gentle', maxDeficitPct: 0.1 });
  });
  it('age 65+ → gentle ≤10%', () => {
    expect(gate({ age: 66 })).toMatchObject({ mode: 'gentle', maxDeficitPct: 0.1 });
  });
  it('type 2 without medicines stays in full mode', () => {
    expect(gate({ conditions: ['diabetes'], diabetesType: 'type2' }).mode).toBe('full');
  });
});

describe('safety gate: rules in every mode', () => {
  it("BMI under 18.5 + 'lose fat' switches to 'eat healthier'", () => {
    const s = gate({ heightCm: 180, weightKg: 58, goal: 'lose' });
    expect(s.effectiveGoal).toBe('healthier');
    expect(s.goalChanged).toBe(true);
    expect(codes({ heightCm: 180, weightKg: 58, goal: 'lose' })).toContain('lowBmiLose');
  });
  it('target weight below BMI 18.5 is rejected with the right number', () => {
    const s = gate({ heightCm: 165, weightKg: 70, targetWeightKg: 48 });
    expect(s.targetWeightRejected).toBe(true);
    // 18.5 × 1.65² = 50.37 → round up to 51
    expect(s.reasons.find((r) => r.code === 'targetTooLow')?.message).toBe(
      "That's below a healthy weight for your height. Let's aim for 51 kg or above.",
    );
  });
  it('a sensible target weight is accepted', () => {
    expect(gate({ heightCm: 165, weightKg: 70, targetWeightKg: 62 }).targetWeightRejected).toBe(
      false,
    );
  });
});

describe('answers validation', () => {
  it('rejects a male picking a female-only condition', () => {
    expect(() => AnswersSchema.parse(make({ sex: 'male', conditions: ['pregnant'] }))).toThrow();
  });
  it('requires diabetesType when diabetes is picked', () => {
    expect(() => AnswersSchema.parse(make({ conditions: ['diabetes'] }))).toThrow(
      /diabetesType|Required/,
    );
  });
  it('requires homeRegion when living outside India', () => {
    expect(() => AnswersSchema.parse(make({ state: 'OUT' }))).toThrow();
    expect(() => AnswersSchema.parse(make({ state: 'OUT', homeRegion: 'KL' }))).not.toThrow();
  });
});
