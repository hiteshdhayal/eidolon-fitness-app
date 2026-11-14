import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { track } from '../lib/analytics';
import { clearDraft, readDraft, readPlan, writeDraft, writePlan } from '../lib/storage';
import {
  INTRO,
  REVIEW,
  applyWeightParam,
  describeAnswer,
  ftInFromCm,
  heightCmFromFtIn,
  isStepComplete,
  minHealthyWeightKg,
  toEngineAnswers,
  toggleMultiValue,
  validate,
  visibleSteps,
} from '../lib/questionnaire/flow';
import { questionById, type DraftAnswers, type QuestionDef } from '../lib/questionnaire/questions';
import { regionOf, type StateCode } from '../lib/engine/regions';
import type { Answers } from '../lib/engine/types';
import OptionCard from './ui/OptionCard';
import StateCombobox from './ui/StateCombobox';
import TopBar from './ui/TopBar';
import Callout from './ui/Callout';

const FIRST_STEP_FALLBACK = REVIEW;

function firstStep(answers: DraftAnswers): string {
  return visibleSteps(answers)[0] ?? FIRST_STEP_FALLBACK;
}

function AlertIcon() {
  return (
    <svg
      class="qc-error-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

interface NumberFieldProps {
  id: string;
  value: number | undefined;
  placeholder: string;
  step: number | 'any';
  describedBy?: string;
  invalid: boolean;
  onValue: (value: number | undefined) => void;
}

function NumberField({
  id,
  value,
  placeholder,
  step,
  describedBy,
  invalid,
  onValue,
}: NumberFieldProps) {
  return (
    <div class="qc-field-row">
      <input
        id={id}
        class="qc-input"
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        placeholder={placeholder}
        value={value ?? ''}
        aria-describedby={describedBy}
        aria-invalid={invalid ? 'true' : undefined}
        onInput={(event) => {
          const raw = event.currentTarget.value;
          onValue(raw === '' ? undefined : Number(raw));
        }}
      />
    </div>
  );
}

interface HeightFieldProps {
  initialCm?: number;
  initialUnit?: 'cm' | 'ftin';
  invalid: boolean;
  describedBy?: string;
  onChange: (cm: number | undefined, unit: 'cm' | 'ftin') => void;
}

function HeightField({ initialCm, initialUnit, invalid, describedBy, onChange }: HeightFieldProps) {
  const startUnit = initialUnit ?? 'ftin';
  const derived = initialCm !== undefined ? ftInFromCm(initialCm) : undefined;
  const [unit, setUnit] = useState<'cm' | 'ftin'>(startUnit);
  const [feet, setFeet] = useState<number | undefined>(derived?.feet);
  const [inches, setInches] = useState<number | undefined>(derived?.inches);
  const [cm, setCm] = useState<number | undefined>(startUnit === 'cm' ? initialCm : undefined);

  function chooseUnit(next: 'cm' | 'ftin') {
    if (next === unit) return;
    if (next === 'cm') {
      const value =
        feet !== undefined || inches !== undefined ? heightCmFromFtIn(feet ?? 0, inches ?? 0) : cm;
      setCm(value);
      setUnit('cm');
      onChange(value, 'cm');
    } else {
      const parts = cm !== undefined ? ftInFromCm(cm) : { feet: feet ?? 0, inches: inches ?? 0 };
      setFeet(parts.feet);
      setInches(parts.inches);
      setUnit('ftin');
      onChange(
        feet !== undefined || inches !== undefined
          ? heightCmFromFtIn(parts.feet, parts.inches)
          : cm,
        'ftin',
      );
    }
  }

  function updateFeet(value: number | undefined) {
    setFeet(value);
    if (value === undefined && inches === undefined) onChange(undefined, 'ftin');
    else onChange(heightCmFromFtIn(value ?? 0, inches ?? 0), 'ftin');
  }

  function updateInches(value: number | undefined) {
    setInches(value);
    if (value === undefined && feet === undefined) onChange(undefined, 'ftin');
    else onChange(heightCmFromFtIn(feet ?? 0, value ?? 0), 'ftin');
  }

  return (
    <div class="qc-height">
      <div class="qc-segment" role="group" aria-label="Height units">
        <button
          type="button"
          class={unit === 'ftin' ? 'is-active' : ''}
          aria-pressed={unit === 'ftin'}
          onClick={() => chooseUnit('ftin')}
        >
          ft · in
        </button>
        <button
          type="button"
          class={unit === 'cm' ? 'is-active' : ''}
          aria-pressed={unit === 'cm'}
          onClick={() => chooseUnit('cm')}
        >
          cm
        </button>
      </div>
      <div class="qc-height-inputs">
        {unit === 'cm' ? (
          <div class="qc-field-row">
            <label class="qc-field-label" for="height-cm">
              Centimetres
            </label>
            <input
              id="height-cm"
              class="qc-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={cm ?? ''}
              aria-describedby={describedBy}
              aria-invalid={invalid ? 'true' : undefined}
              onInput={(event) => {
                const raw = event.currentTarget.value;
                const value = raw === '' ? undefined : Number(raw);
                setCm(value);
                onChange(value, 'cm');
              }}
            />
          </div>
        ) : (
          <>
            <div class="qc-field-row">
              <label class="qc-field-label" for="height-feet">
                Feet
              </label>
              <input
                id="height-feet"
                class="qc-input"
                type="number"
                inputMode="numeric"
                step="1"
                value={feet ?? ''}
                aria-describedby={describedBy}
                aria-invalid={invalid ? 'true' : undefined}
                onInput={(event) => {
                  const raw = event.currentTarget.value;
                  updateFeet(raw === '' ? undefined : Number(raw));
                }}
              />
            </div>
            <div class="qc-field-row">
              <label class="qc-field-label" for="height-inches">
                Inches
              </label>
              <input
                id="height-inches"
                class="qc-input"
                type="number"
                inputMode="numeric"
                step="1"
                value={inches ?? ''}
                aria-describedby={describedBy}
                aria-invalid={invalid ? 'true' : undefined}
                onInput={(event) => {
                  const raw = event.currentTarget.value;
                  updateInches(raw === '' ? undefined : Number(raw));
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const TYPING_KINDS = new Set(['number', 'height', 'text']);

function attemptReason(question: QuestionDef): string {
  if (question.id === 'meats') return 'Pick at least one to continue.';
  if (question.kind === 'number' || question.kind === 'height') {
    return 'Enter a value to continue.';
  }
  return 'Pick one to continue.';
}

export default function Questionnaire() {
  const [answers, setAnswers] = useState<DraftAnswers>({ supplements: 'foodOnly' });
  const [stepId, setStepId] = useState<string>(INTRO);
  const [resumeStep, setResumeStep] = useState<string | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildError, setBuildError] = useState(false);
  const [notice, setNotice] = useState('');
  const [ready, setReady] = useState(false);

  const legendRef = useRef<HTMLLegendElement>(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const nextRef = useRef<() => void>(() => {});

  const steps = useMemo(() => visibleSteps(answers), [answers]);
  const currentQuestion = stepId !== INTRO && stepId !== REVIEW ? questionById(stepId) : undefined;
  const questionIndex = Math.max(0, steps.indexOf(stepId));
  const counterIndex = stepId === REVIEW ? steps.length : questionIndex + 1;
  const isLastQuestion = stepId === (steps[steps.length - 1] ?? REVIEW);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('edit') === '1') {
      const saved = readPlan();
      if (saved) {
        // "Update my plan" passes the latest logged weight as ?weight=.
        setAnswers(applyWeightParam(saved.answers as DraftAnswers, params));
        setStepId(REVIEW);
        setReady(true);
        return;
      }
    }
    const draft = readDraft();
    const requested = params.get('step');
    if (draft) {
      const visible = visibleSteps(draft.answers);
      const target =
        requested && (visible.includes(requested) || requested === REVIEW)
          ? requested
          : draft.stepId;
      setAnswers({ supplements: 'foodOnly', ...draft.answers });
      setResumeStep(
        visible.includes(target) || target === REVIEW ? target : (visible[0] ?? REVIEW),
      );
    }
    setReady(true);
  }, []);

  // If branching hides the current step, fall back to the last visible one.
  useEffect(() => {
    if (!ready || stepId === INTRO || stepId === REVIEW) return;
    if (!steps.includes(stepId)) setStepId(steps[steps.length - 1] ?? REVIEW);
  }, [ready, steps, stepId]);

  useEffect(() => {
    if (!ready || stepId === INTRO) return;
    writeDraft({ v: 1, answers, stepId, updatedAt: new Date().toISOString() });
  }, [answers, stepId, ready]);

  // Any change to the answers clears the "you must pick something" notice.
  useEffect(() => {
    setNotice('');
  }, [answers, stepId]);

  // Typing steps open the phone keyboard straight away; choice steps keep the
  // legend focused and still announce the question.
  useEffect(() => {
    if (!ready || !currentQuestion) return;
    track('plan_step', { step: questionIndex + 1 });
    if (TYPING_KINDS.has(currentQuestion.kind)) {
      focusField(currentQuestion);
    } else {
      legendRef.current?.focus();
    }
  }, [ready, stepId, currentQuestion, questionIndex]);

  useEffect(() => {
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get('step');
      const visible = visibleSteps(answersRef.current);
      setStepId(
        requested && (visible.includes(requested) || requested === REVIEW) ? requested : INTRO,
      );
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function pushStep(id: string) {
    try {
      const url = new URL(window.location.href);
      if (id === INTRO) url.searchParams.delete('step');
      else url.searchParams.set('step', id);
      window.history.pushState({ step: id }, '', url);
    } catch {
      // history is best-effort
    }
  }

  function go(id: string) {
    setStepId(id);
    pushStep(id);
  }

  function next() {
    const index = steps.indexOf(stepId);
    if (index === -1) {
      go(steps[0] ?? REVIEW);
      return;
    }
    if (returnToReview && isStepComplete(stepId, answers)) {
      setReturnToReview(false);
      go(REVIEW);
      return;
    }
    if (index >= steps.length - 1) go(REVIEW);
    else go(steps[index + 1] ?? REVIEW);
  }
  nextRef.current = next;

  function focusField(question: QuestionDef) {
    const selector = question.kind === 'height' ? '.qc-height input' : `#${question.id}-input`;
    const element = document.querySelector<HTMLElement>(selector);
    if (element) element.focus();
    else legendRef.current?.focus();
  }

  function back() {
    if (stepId === INTRO) return;
    try {
      if (window.history.state && typeof window.history.state.step === 'string') {
        window.history.back();
        return;
      }
    } catch {
      // fall through to a direct move
    }
    const index = stepId === REVIEW ? steps.length : steps.indexOf(stepId);
    if (index <= 0) go(INTRO);
    else go(steps[index - 1] ?? INTRO);
  }

  function setValue(id: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [id]: value }) as DraftAnswers);
  }

  function selectSingle(question: QuestionDef, value: unknown, viaPointer: boolean) {
    setValue(question.id, value);
    if (viaPointer) window.setTimeout(() => nextRef.current(), 150);
  }

  function toggleMulti(question: QuestionDef, value: string) {
    setAnswers((prev) => {
      const current = prev[question.id as keyof DraftAnswers] as string[] | undefined;
      return { ...prev, [question.id]: toggleMultiValue(current, value) } as DraftAnswers;
    });
  }

  function startFresh() {
    track('plan_start');
    setAnswers({ supplements: 'foodOnly' });
    setResumeStep(null);
    go(visibleSteps({})[0] ?? REVIEW);
  }

  function startOver() {
    clearDraft();
    startFresh();
  }

  function continueDraft() {
    track('plan_start');
    go(resumeStep ?? firstStep(answers));
  }

  function skipStep() {
    setValue(stepId, undefined);
    nextRef.current();
  }

  async function build() {
    if (building) return;
    setBuilding(true);
    setBuildError(false);
    try {
      const engineAnswers = toEngineAnswers(answers);
      const [{ buildPlan, groceryListFor }, { FOODS }] = await Promise.all([
        import('../lib/engine/index'),
        import('../data/foods/index'),
      ]);
      const plan = buildPlan(engineAnswers, FOODS);
      const groceries = groceryListFor(plan, engineAnswers, FOODS);
      const regionCode =
        engineAnswers.state === 'OUT' ? engineAnswers.homeRegion : engineAnswers.state;
      track('plan_complete', {
        goal: engineAnswers.goal,
        region: regionCode ? regionOf(regionCode as StateCode) : '',
        dietType: engineAnswers.dietType,
      });
      writePlan({
        v: 1,
        answers: engineAnswers as unknown as Answers,
        plan,
        groceries,
        savedAt: new Date().toISOString(),
      });
      clearDraft();
      window.location.assign('/my-plan/');
    } catch {
      setBuildError(true);
      setBuilding(false);
    }
  }

  function renderOptions(question: QuestionDef) {
    const base = question.optionsFor?.(answers) ?? question.options ?? [];
    const options = question.noneLabel ? [...base, { value: '', label: question.noneLabel }] : base;
    const selectedList = answers[question.id as keyof DraftAnswers] as string[] | undefined;

    if (question.kind === 'single') {
      return (
        <ul class="qc-options">
          {options.map((option) => (
            <li key={String(option.value)}>
              <OptionCard
                type="radio"
                name={question.id}
                value={String(option.value)}
                checked={answers[question.id as keyof DraftAnswers] === option.value}
                label={option.label}
                sublabel={option.sublabel}
                onSelect={(value, viaPointer) => selectSingle(question, value, viaPointer)}
              />
            </li>
          ))}
        </ul>
      );
    }

    return (
      <ul class="qc-options">
        {options.map((option) => {
          const isNone = option.value === '';
          const checked = isNone
            ? Array.isArray(selectedList) && selectedList.length === 0
            : (selectedList ?? []).includes(String(option.value));
          return (
            <li key={String(option.value)}>
              <OptionCard
                type="checkbox"
                name={question.id}
                value={String(option.value)}
                checked={checked}
                label={option.label}
                sublabel={option.sublabel}
                onSelect={(value) => toggleMulti(question, value)}
              />
            </li>
          );
        })}
      </ul>
    );
  }

  function renderQuestion(question: QuestionDef) {
    const value = answers[question.id as keyof DraftAnswers];
    const message = validate(question.id, answers);
    const describedBy = message ? `${question.id}-error` : undefined;

    if (question.kind === 'number') {
      const key =
        question.id === 'weight'
          ? 'weightKg'
          : question.id === 'targetWeight'
            ? 'targetWeightKg'
            : question.id;
      return (
        <NumberField
          id={`${question.id}-input`}
          value={answers[key as keyof DraftAnswers] as number | undefined}
          placeholder={question.placeholder ?? ''}
          step={question.id === 'age' ? 1 : 0.1}
          describedBy={describedBy}
          invalid={!!message}
          onValue={(next) => setValue(key, next)}
        />
      );
    }

    if (question.kind === 'height') {
      return (
        <HeightField
          initialCm={answers.heightCm}
          initialUnit={answers.heightUnit}
          invalid={!!message}
          describedBy={describedBy}
          onChange={(cm, unit) => {
            setValue('heightCm', cm);
            setAnswers((prev) => ({ ...prev, heightUnit: unit }));
          }}
        />
      );
    }

    if (question.kind === 'state') {
      return (
        <StateCombobox
          id={`${question.id}-input`}
          legend={question.legend}
          value={value as string | undefined}
          includeOutside={question.id === 'state'}
          onChange={(code) => setValue(question.id, code)}
        />
      );
    }

    if (question.kind === 'text') {
      return (
        <div class="qc-field-row">
          <input
            id={`${question.id}-input`}
            class="qc-input"
            type="text"
            maxLength={40}
            placeholder={question.placeholder ?? ''}
            value={(value as string | undefined) ?? ''}
            onInput={(event) => setValue(question.id, event.currentTarget.value)}
          />
        </div>
      );
    }

    return renderOptions(question);
  }

  const complete = currentQuestion ? isStepComplete(currentQuestion.id, answers) : false;
  const message = currentQuestion ? validate(currentQuestion.id, answers) : null;
  const targetWarning =
    currentQuestion?.id === 'targetWeight' &&
    typeof answers.targetWeightKg === 'number' &&
    typeof answers.heightCm === 'number' &&
    answers.targetWeightKg < minHealthyWeightKg(answers.heightCm)
      ? `That's below a healthy weight for your height. Let's aim for ${minHealthyWeightKg(
          answers.heightCm,
        )} kg or above.`
      : null;
  const skipVisible =
    !!currentQuestion?.skippable &&
    ((answers[currentQuestion.id as keyof DraftAnswers] as string | number | undefined) ===
      undefined ||
      (answers[currentQuestion.id as keyof DraftAnswers] as string | number | undefined) === '');

  if (!ready) {
    return (
      <section class="qc-section" aria-busy="true">
        <h1 class="sr-only">Build your plan</h1>
      </section>
    );
  }

  if (stepId === INTRO) {
    return (
      <section class="qc-hero" data-surface="obsidian">
        <div class="container">
          <p class="sr-only" aria-live="polite" />
          <p class="eyebrow-row">
            <span class="speed-bar" aria-hidden="true" />
            <span class="eyebrow">Free · 2 minutes · No sign-up</span>
          </p>
          <h1 class="display qc-intro-title">
            Build your <em class="accent-italic">plan.</em>
          </h1>
          <p class="qc-lede">
            Takes about 2 minutes. Your answers stay on your phone — nothing is sent to a server.
          </p>
          <p class="qc-disclaimer">
            This is general guidance, not medical advice. <a href="/disclaimer/">Read more →</a>
          </p>
          <div class="qc-actions">
            {resumeStep ? (
              <>
                <button type="button" class="qc-next" onClick={continueDraft}>
                  Continue where you left off
                </button>
                <button type="button" class="qc-secondary" onClick={startOver}>
                  Start over
                </button>
              </>
            ) : (
              <button type="button" class="qc-next" onClick={startFresh}>
                Start
                <span aria-hidden="true"> →</span>
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  function attemptNext() {
    if (!currentQuestion) return;
    if (complete) {
      next();
      return;
    }
    if (!message) setNotice(attemptReason(currentQuestion));
    focusField(currentQuestion);
  }

  return (
    <section class="qc-section section" data-surface="ice">
      <div class="container">
        <TopBar
          index={counterIndex}
          total={steps.length}
          canBack={stepId !== INTRO}
          onBack={back}
        />

        <p class="sr-only" aria-live="polite">
          {currentQuestion
            ? `Question ${questionIndex + 1} of ${steps.length}: ${currentQuestion.legend}`
            : ''}
        </p>

        <div class="qc-shell" data-step={stepId}>
          <h1 class="sr-only">Build your plan</h1>

          {stepId === REVIEW ? (
            <div class="qc-step-anim" key="review">
              <fieldset class="qc-step">
                <legend class="qc-legend" tabIndex={-1} ref={legendRef}>
                  Check your answers
                </legend>
              </fieldset>
              <ul class="qc-review">
                {steps
                  .filter(
                    (id) =>
                      isStepComplete(id, answers) &&
                      !(id === 'trainingType' && (answers.trainingType ?? []).length === 0) &&
                      !(id === 'firstName' && !answers.firstName?.trim()),
                  )
                  .map((id) => {
                    const question = questionById(id);
                    return (
                      <li class="qc-review-row" key={id}>
                        <div>
                          <p class="qc-review-question">{question?.legend ?? id}</p>
                          <p class="qc-review-answer">{describeAnswer(id, answers)}</p>
                        </div>
                        <button
                          type="button"
                          class="qc-edit"
                          onClick={() => {
                            setReturnToReview(true);
                            go(id);
                          }}
                        >
                          Edit
                        </button>
                      </li>
                    );
                  })}
              </ul>

              {buildError ? (
                <Callout tone="warning">
                  Something went wrong building your plan. Your answers are saved — please try
                  again.
                </Callout>
              ) : null}

              <div class="qc-next-wrap">
                <button
                  type="button"
                  class="qc-next"
                  aria-disabled={building ? 'true' : undefined}
                  onClick={build}
                >
                  {building ? (
                    'Building your plan…'
                  ) : (
                    <>
                      Build my plan
                      <span aria-hidden="true"> →</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : currentQuestion ? (
            <div
              class="qc-step-anim"
              key={currentQuestion.id}
              onKeyDown={(event) => {
                // Enter advances from a focused radio; the Next button handles the rest.
                if (
                  event.key === 'Enter' &&
                  event.target instanceof HTMLInputElement &&
                  event.target.type === 'radio' &&
                  complete
                ) {
                  event.preventDefault();
                  next();
                }
              }}
            >
              <fieldset class="qc-step">
                <legend
                  class="qc-legend"
                  tabIndex={-1}
                  id={`${currentQuestion.id}-legend`}
                  ref={legendRef}
                >
                  {currentQuestion.legend}
                </legend>

                {currentQuestion.helper ? (
                  <p class="qc-helper" id={`${currentQuestion.id}-helper`}>
                    {currentQuestion.helper}
                  </p>
                ) : null}

                {renderQuestion(currentQuestion)}

                {skipVisible ? (
                  <button type="button" class="qc-skip qc-skip-inline" onClick={skipStep}>
                    Skip this question
                  </button>
                ) : null}

                {message ? (
                  <p class="qc-error" id={`${currentQuestion.id}-error`} role="alert">
                    <AlertIcon />
                    <span>{message}</span>
                  </p>
                ) : null}

                {notice ? (
                  <p class="qc-notice" role="status">
                    {notice}
                  </p>
                ) : null}

                {targetWarning ? <Callout tone="warning">{targetWarning}</Callout> : null}
              </fieldset>

              <div class="qc-next-wrap">
                <button
                  type="button"
                  class="qc-next"
                  aria-disabled={complete ? undefined : 'true'}
                  onClick={attemptNext}
                >
                  {isLastQuestion ? 'Review answers' : 'Next'}
                  <span aria-hidden="true"> →</span>
                </button>
                {skipVisible ? (
                  <button type="button" class="qc-skip qc-skip-desktop" onClick={skipStep}>
                    Skip this question
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
