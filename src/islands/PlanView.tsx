import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren, ComponentType } from 'preact';
import { track } from '../lib/analytics';
import {
  readGroceries,
  readPlan,
  readProgress,
  setProgressFields,
  writeGroceries,
  writePlan,
  type SavedPlan,
} from '../lib/storage';
import type { Progress } from '../lib/progress/schema';
import { todayLocal } from '../lib/progress/dates';
import { isNudgeDue } from '../lib/progress/rules';
import { STATES } from '../lib/engine/regions';
import { capitalize, itemMeta } from '../lib/plan/format';
import { formatNumber } from '../lib/utils/format';
import type { Plan } from '../lib/engine/types';
import Callout from './ui/Callout';
import Stat from './ui/Stat';
import Tabs from './ui/Tabs';
import Sheet from './ui/Sheet';
import DataControls from './progress/DataControls';
import type { ProgressTabProps } from './progress/ProgressTab';

export interface HealthNoteProp {
  id: string;
  title: string;
  reviewedBy: string;
  html: string;
}

interface Props {
  notes: HealthNoteProp[];
}

type EngineModule = typeof import('../lib/engine/index');
type FoodsModule = typeof import('../data/foods/index');
type SwapOption = Awaited<ReturnType<EngineModule['getSwaps']>>[number];

const GOAL_LABELS: Record<string, string> = {
  lose: 'Lose fat',
  muscle: 'Build muscle',
  healthier: 'Eat healthier',
  gain: 'Gain weight',
};

const DIET_LABELS: Record<string, string> = {
  veg: 'Vegetarian',
  eggetarian: 'Eggetarian',
  nonveg: 'Non-vegetarian',
  vegan: 'Vegan',
  jain: 'Jain',
};

const MEAL_LABELS: Record<string, string> = {
  '3': '3 meals',
  '3+snacks': '3 meals + snacks',
  '2': '2 meals',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function todayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

function stateName(code?: string): string {
  if (!code) return '—';
  if (code === 'OUT') return 'Outside India';
  return STATES.find((state) => state.code === code)?.name ?? '—';
}

function regionCodeOf(answers: SavedPlan['answers']): string | undefined {
  return answers.state === 'OUT' ? answers.homeRegion : answers.state;
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function heroSub(plan: Plan, answers: SavedPlan['answers']): string {
  const goal = GOAL_LABELS[answers.goal] ?? answers.goal;
  const region = stateName(regionCodeOf(answers));
  if (plan.kind === 'guidance') return `Balanced meal ideas from ${region} food.`;
  if (plan.kind === 'plateRules') {
    const where = answers.foodSource === 'eatOut' ? 'out' : 'at the mess';
    return `Your plate rules for eating ${where}, built for your goal: ${goal}.`;
  }
  return `A 7-day plan from ${region} food, built for your goal: ${goal}.`;
}

interface PlanHeaderProps {
  number: string;
  eyebrow: string;
  intro?: string;
  children: ComponentChildren;
}

function PlanHeader({ number, eyebrow, intro, children }: PlanHeaderProps) {
  return (
    <header class="pv-sechead">
      <p class="eyebrow-row">
        <span class="speed-bar" aria-hidden="true" />
        <span class="eyebrow">
          <span class="section-header-number">{number}</span> — {eyebrow}
        </span>
      </p>
      <div class="pv-sechead-grid">
        <h2>{children}</h2>
        {intro ? <p class="pv-sechead-intro">{intro}</p> : null}
      </div>
    </header>
  );
}

interface DataSectionProps {
  number: string;
  today: string;
  onReplaced: () => void;
  onAnnounce: (message: string) => void;
}

function DataSection({ number, today, onReplaced, onAnnounce }: DataSectionProps) {
  return (
    <section class="section pv-data-section" data-surface="obsidian">
      <div class="container">
        <PlanHeader
          number={number}
          eyebrow="Your data"
          intro="Everything — your answers, plan, check-ins and grocery ticks — stays on this phone. Nothing is sent to a server."
        >
          Your data <em class="accent-italic">stays here.</em>
        </PlanHeader>
        <DataControls today={today} onReplaced={onReplaced} onAnnounce={onAnnounce} />
      </div>
    </section>
  );
}

export default function PlanView({ notes }: Props) {
  const [saved, setSaved] = useState<SavedPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('plan');
  const [day, setDay] = useState(0);
  const [swapFor, setSwapFor] = useState<{ dayIndex: number; mealIndex: number } | null>(null);
  const [swapOptions, setSwapOptions] = useState<SwapOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [progress, setProgress] = useState<Progress>({ v: 1, entries: [], dismissedRules: {} });
  const [ProgressTab, setProgressTab] = useState<ComponentType<ProgressTabProps> | null>(null);
  const [focusSignal, setFocusSignal] = useState(0);
  const [focusEmpty, setFocusEmpty] = useState(false);
  const engineRef = useRef<Promise<[EngineModule, FoodsModule]> | null>(null);
  const progressLoadingRef = useRef(false);
  const today = useMemo(() => todayLocal(), []);

  /** Load the Progress tab island the first time it is needed (§17). */
  function loadProgressTab() {
    if (progressLoadingRef.current) return;
    progressLoadingRef.current = true;
    import('./progress/ProgressTab').then((module) => setProgressTab(() => module.default));
  }

  /** Re-read everything after an import or "Delete everything". */
  function reloadFromStorage() {
    const plan = readPlan();
    const stored = readProgress();
    setProgress(stored);
    if (plan) {
      setSaved(plan);
      setChecked(readGroceries(plan.plan.seed).checked);
      if (plan.plan.kind === 'recipes') setDay(todayIndex());
    } else {
      setSaved(null);
      setFocusEmpty(true);
    }
  }

  useEffect(() => {
    const plan = readPlan();
    setProgress(readProgress());
    if (plan) {
      setSaved(plan);
      setChecked(readGroceries(plan.plan.seed).checked);
      if (plan.plan.kind === 'recipes') setDay(todayIndex());
      if (plan.plan.kind === 'plateRules') loadProgressTab();
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (focusEmpty && !saved && loaded) document.getElementById('pv-empty-title')?.focus();
  }, [focusEmpty, saved, loaded]);

  function openTab(id: string) {
    setTab(id);
    if (id === 'progress') loadProgressTab();
  }

  function dismissNudge() {
    setProgress(setProgressFields({ nudgeDismissedOn: today }));
  }

  function logFromNudge() {
    openTab('progress');
    setFocusSignal((value) => value + 1);
    document.getElementById('pv-week')?.scrollIntoView({ block: 'start' });
    dismissNudge();
  }

  function loadEngine() {
    engineRef.current ??= Promise.all([
      import('../lib/engine/index'),
      import('../data/foods/index'),
    ]);
    return engineRef.current;
  }

  function persist(next: SavedPlan) {
    writePlan(next);
    setSaved(next);
  }

  async function openSwap(dayIndex: number, mealIndex: number) {
    if (!saved) return;
    setSwapFor({ dayIndex, mealIndex });
    setSwapOptions(null);
    setBusy(true);
    try {
      const [engine, foods] = await loadEngine();
      setSwapOptions(engine.getSwaps(saved.plan, saved.answers, foods.FOODS, dayIndex, mealIndex));
    } finally {
      setBusy(false);
    }
  }

  async function chooseSwap(option: SwapOption) {
    if (!saved || !swapFor) return;
    setBusy(true);
    try {
      const [engine, foods] = await loadEngine();
      const primary = engine.primaryItemIndex(saved.plan, swapFor.dayIndex, swapFor.mealIndex);
      const plan = engine.applySwap(
        saved.plan,
        saved.answers,
        foods.FOODS,
        swapFor.dayIndex,
        swapFor.mealIndex,
        primary,
        option,
      );
      const groceries = engine.groceryListFor(plan, saved.answers, foods.FOODS);
      persist({ ...saved, plan, groceries });
      setAnnounce(`Swapped to ${option.name}.`);
      setSwapFor(null);
    } finally {
      setBusy(false);
    }
  }

  async function shuffle(dayIndex: number) {
    if (!saved) return;
    setBusy(true);
    try {
      const [engine, foods] = await loadEngine();
      const plan = engine.shuffleDay(saved.plan, saved.answers, foods.FOODS, dayIndex);
      const groceries = engine.groceryListFor(plan, saved.answers, foods.FOODS);
      persist({ ...saved, plan, groceries });
      setAnnounce(`New meals for ${FULL_DAYS[dayIndex] ?? 'the day'}.`);
    } finally {
      setBusy(false);
    }
  }

  function toggleGrocery(id: string) {
    if (!saved) return;
    const next = checked.includes(id) ? checked.filter((item) => item !== id) : [...checked, id];
    setChecked(next);
    writeGroceries(saved.plan.seed, next);
  }

  function clearTicks() {
    if (!saved) return;
    setChecked([]);
    writeGroceries(saved.plan.seed, []);
  }

  function printPlan() {
    track('pdf_download');
    window.print();
  }

  const dayTabs = useMemo(
    () => DAY_LABELS.map((label, index) => ({ id: String(index), label })),
    [],
  );

  if (!loaded) {
    return <div class="pv-shell" aria-busy="true" />;
  }

  if (!saved) {
    return (
      <div class="pv-shell">
        <div class="pv-screen">
          <section class="pv-hero pv-hero-empty pv-empty" data-surface="obsidian">
            <div class="container">
              <p class="eyebrow-row">
                <span class="speed-bar" aria-hidden="true" />
                <span class="eyebrow">Your plan</span>
              </p>
              <h1 class="display pv-title" id="pv-empty-title" tabIndex={-1}>
                No plan <em class="accent-italic">yet.</em>
              </h1>
              <p class="pv-sub">It takes about 2 minutes, and your answers stay on your phone.</p>
              <div class="pv-actions-row">
                <a class="qc-next" href="/plan/">
                  Build my plan →
                </a>
              </div>
            </div>
          </section>

          <DataSection
            number="01"
            today={today}
            onReplaced={reloadFromStorage}
            onAnnounce={setAnnounce}
          />
        </div>
      </div>
    );
  }

  const { plan, answers, groceries } = saved;
  const targets = plan.targets;
  const canPdf = plan.kind === 'recipes' || plan.kind === 'plateRules';
  const noteMap = new Map(notes.map((note) => [note.id, note]));
  const healthNotes = plan.healthNoteIds
    .map((id) => noteMap.get(id))
    .filter((note): note is HealthNoteProp => Boolean(note));
  const activeDay = plan.days[day];

  const chips = [
    GOAL_LABELS[answers.goal] ?? answers.goal,
    DIET_LABELS[answers.dietType] ?? answers.dietType,
    stateName(regionCodeOf(answers)),
    MEAL_LABELS[answers.mealPattern] ?? answers.mealPattern,
  ];

  const healthPresent = plan.notes.length > 0 || healthNotes.length > 0;

  // Section numbers: "How I worked this out" (numbers only), "For your health"
  // (when there is anything to show), then the main content.
  let counter = 0;
  const nextNumber = () => String((counter += 1)).padStart(2, '0');
  const howNumber = targets ? nextNumber() : null;
  const healthNumber = plan.kind !== 'guidance' && healthPresent ? nextNumber() : null;
  const mainNumber = plan.kind === 'guidance' ? '01' : nextNumber();
  const dataNumber = nextNumber();

  const targetKg =
    answers.targetWeightKg !== undefined && !plan.safety.targetWeightRejected
      ? answers.targetWeightKg
      : undefined;

  const nudgeDue =
    plan.kind !== 'guidance' &&
    isNudgeDue({
      savedAt: saved.savedAt,
      entries: progress.entries,
      nudgeDismissedOn: progress.nudgeDismissedOn,
      today,
    });

  const progressPanel = ProgressTab ? (
    <ProgressTab
      progress={progress}
      onChange={setProgress}
      onAnnounce={setAnnounce}
      planWeightKg={answers.weightKg}
      effectiveGoal={plan.safety.effectiveGoal}
      mode={plan.safety.mode}
      targetKg={targetKg}
      today={today}
      focusSignal={focusSignal}
    />
  ) : (
    <p class="pv-body-text">Loading…</p>
  );

  const safetyCallouts = plan.safety.reasons.map((reason) => (
    <Callout tone="warning" key={reason.code}>
      {reason.message}
    </Callout>
  ));

  return (
    <div class="pv-shell" data-kind={plan.kind}>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>

      <div class="pv-screen">
        {/* 1. Plan hero (obsidian) */}
        <section class="pv-hero" data-surface="obsidian">
          <div class="container">
            <p class="eyebrow-row">
              <span class="speed-bar" aria-hidden="true" />
              <span class="eyebrow">Your plan · {formatDate(saved.savedAt)}</span>
            </p>
            <h1 class="display pv-title">
              {answers.firstName ? `${capitalize(answers.firstName)}'s ` : 'Your '}
              <em class="accent-italic">Plan.</em>
            </h1>
            <p class="pv-sub">{heroSub(plan, answers)}</p>
            <div class="pv-chips">
              {chips.map((chip) => (
                <span class="tag" key={chip}>
                  {chip}
                </span>
              ))}
            </div>
            <div class="pv-links">
              <a class="pv-link" href="/plan/?edit=1">
                Edit answers
              </a>
              {canPdf ? (
                <button type="button" class="pv-link" onClick={printPlan}>
                  Download as PDF
                </button>
              ) : null}
            </div>
            {nudgeDue ? (
              <div class="pv-nudge">
                <Callout tone="info">
                  <p>{"It's been a week. Want to log a quick check-in?"}</p>
                  <div class="pv-nudge-actions">
                    <button type="button" class="qc-next qc-next-sm" onClick={logFromNudge}>
                      Log weight
                    </button>
                    <button type="button" class="pv-link" onClick={dismissNudge}>
                      Not now
                    </button>
                  </div>
                </Callout>
              </div>
            ) : null}
            {safetyCallouts.length > 0 ? <div class="pv-callouts">{safetyCallouts}</div> : null}
          </div>
        </section>

        {/* 2. Key numbers — same obsidian surface, one rule above */}
        {targets ? (
          <section class="pv-numbers" data-surface="obsidian">
            <div class="container">
              <div class="pv-stat-grid">
                <Stat value={formatNumber(targets.kcal)} label="Calories" accent />
                <Stat value={`${targets.protein} g`} label="Protein" accent />
                <Stat value={`${targets.carbs} g`} label="Carbs" />
                <Stat value={`${targets.fat} g`} label="Fat" />
                <Stat value={`${targets.fiber} g`} label="Fibre" />
                <Stat value={`${(targets.waterMl / 1000).toFixed(1)} L`} label="Water" />
                <Stat value={targets.stepsTarget.toLocaleString('en-IN')} label="Steps" />
              </div>
              <p class="pv-numbers-note">Approximate daily targets.</p>
            </div>
          </section>
        ) : null}

        {/* 3. How I worked this out (ice) */}
        {targets && howNumber ? (
          <section class="section" data-surface="ice">
            <div class="container">
              <PlanHeader
                number={howNumber}
                eyebrow="How I worked this out"
                intro="Every number above comes from your answers. Open any step to see how."
              >
                The maths, <em class="accent-italic">in plain words.</em>
              </PlanHeader>
              <div class="pv-steps">
                {targets.explain.map((step, index) => (
                  <details class="pv-step step-row" key={step.title}>
                    <summary>
                      <span class="section-number" aria-hidden="true">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <h3 class="pv-step-title">{step.title}</h3>
                    </summary>
                    <p class="pv-step-text">{step.text}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* 4. For your health (obsidian) */}
        {healthNumber ? (
          <section class="section" data-surface="obsidian">
            <div class="container">
              <PlanHeader number={healthNumber} eyebrow="For your health">
                What your <em class="accent-italic">answers</em> change.
              </PlanHeader>
              <div class="pv-callouts pv-callouts-wide">
                {plan.notes.map((note) => (
                  <Callout tone="info" key={note}>
                    {note}
                  </Callout>
                ))}
                {healthNotes.map((note) => (
                  <div class="pv-note" key={note.id}>
                    <Callout tone="info" heading={note.title}>
                      <div class="pv-note-body" dangerouslySetInnerHTML={{ __html: note.html }} />
                    </Callout>
                    {note.reviewedBy ? (
                      <p class="pv-note-by">Reviewed by {note.reviewedBy}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {/* 5. Your week (ice) — recipes */}
        {plan.kind === 'recipes' ? (
          <section class="section" id="pv-week" data-surface="ice">
            <div class="container">
              <PlanHeader number={mainNumber} eyebrow="Your week">
                Seven days, <em class="accent-italic">your food.</em>
              </PlanHeader>

              <Tabs
                label="Plan sections"
                tabs={[
                  { id: 'plan', label: 'Plan' },
                  { id: 'groceries', label: 'Groceries' },
                  { id: 'progress', label: 'Progress' },
                ]}
                active={tab}
                onChange={openTab}
                panelPrefix="panel"
              />

              <div
                class="pv-panel"
                id="panel-plan"
                role="tabpanel"
                aria-labelledby="tab-plan"
                hidden={tab !== 'plan'}
              >
                <div class="pv-daytabs">
                  <Tabs
                    label="Choose a day"
                    tabs={dayTabs}
                    active={String(day)}
                    onChange={(id) => setDay(Number(id))}
                  />
                </div>

                {activeDay ? (
                  <>
                    <div class="pv-dayhead">
                      <h3 class="pv-dayhead-title">{FULL_DAYS[activeDay.index]}</h3>
                      <p class="pv-dayhead-meta">
                        {formatNumber(activeDay.kcal)} kcal · {activeDay.protein} g protein ·
                        approx.
                      </p>
                      <button
                        type="button"
                        class="pv-btn pv-dayhead-shuffle"
                        disabled={busy}
                        onClick={() => shuffle(activeDay.index)}
                      >
                        Shuffle day
                      </button>
                    </div>

                    {activeDay.meals.map((meal, mealIndex) => (
                      <article class="pv-meal" key={`${activeDay.index}-${meal.slot}-${mealIndex}`}>
                        <div class="pv-meal-side">
                          <p class="pv-meal-time">{meal.time}</p>
                          <h3 class="pv-meal-label">{meal.label}</h3>
                        </div>
                        <div class="pv-meal-items">
                          {meal.items.map((item, itemIndex) => (
                            <div class="pv-item" key={`${item.foodId}-${itemIndex}`}>
                              <p class="pv-item-name">
                                {item.name} <span class="pv-item-gloss">{item.gloss}</span>
                              </p>
                              <p class="pv-item-meta">{itemMeta(item)}</p>
                              {item.notes.map((note) => (
                                <p class="pv-item-note" key={note}>
                                  {note}
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                        <div class="pv-meal-foot">
                          <span class="pv-meal-kcal">
                            {formatNumber(meal.kcal)} kcal · {meal.protein} g protein
                          </span>
                          <button
                            type="button"
                            class="pv-btn"
                            onClick={() => openSwap(activeDay.index, mealIndex)}
                          >
                            Swap
                          </button>
                        </div>
                      </article>
                    ))}
                  </>
                ) : null}
              </div>

              <div
                class="pv-panel"
                id="panel-groceries"
                role="tabpanel"
                aria-labelledby="tab-groceries"
                hidden={tab !== 'groceries'}
              >
                <div class="pv-grocery-grid">
                  {groceries.categories.map((category) => (
                    <div class="pv-grocery-group" key={category.id}>
                      <h3 class="pv-grocery-label">{category.label}</h3>
                      {category.items.map((item) => (
                        <label
                          class={`pv-grocery-row${checked.includes(item.id) ? ' is-checked' : ''}`}
                          key={item.id}
                        >
                          <input
                            type="checkbox"
                            checked={checked.includes(item.id)}
                            onChange={() => toggleGrocery(item.id)}
                          />
                          <span class="pv-grocery-name">{item.name}</span>
                          <span class="pv-grocery-amount">{item.amount}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
                {checked.length > 0 ? (
                  <button type="button" class="pv-btn pv-after-grid" onClick={clearTicks}>
                    Clear ticks
                  </button>
                ) : null}
              </div>

              <div
                class="pv-panel"
                id="panel-progress"
                role="tabpanel"
                aria-labelledby="tab-progress"
                hidden={tab !== 'progress'}
              >
                {progressPanel}
              </div>
            </div>
          </section>
        ) : null}

        {/* 6. plateRules (ice) */}
        {plan.kind === 'plateRules' && plan.plateGuide ? (
          <section class="section" data-surface="ice">
            <div class="container">
              <PlanHeader number={mainNumber} eyebrow="Build your plate">
                Half sabzi. <em class="accent-italic">A quarter protein.</em>
              </PlanHeader>
              <p class="pv-statement">{plan.plateGuide.baseRule}</p>
              <div class="pv-rows">
                <div class="pv-row">
                  <h3 class="pv-row-title">Portions</h3>
                  <ul class="pv-row-list">
                    {plan.plateGuide.portions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div class="pv-row">
                  <h3 class="pv-row-title">At the mess</h3>
                  <ul class="pv-row-list">
                    {plan.plateGuide.messTips.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div class="pv-row">
                  <h3 class="pv-row-title">When you order</h3>
                  <div class="pv-order">
                    {plan.plateGuide.orderingGuide.map((row) => (
                      <div class="pv-order-row" key={row.place}>
                        <span class="pv-order-place">{row.place}</span>
                        <span>{row.tip}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div class="pv-row">
                  <h3 class="pv-row-title">Protein back-ups</h3>
                  <ul class="pv-row-list">
                    {plan.plateGuide.proteinTips.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* 6. guidance (ice) */}
        {plan.kind === 'guidance' && plan.guidance ? (
          <section class="section" data-surface="ice">
            <div class="container">
              <PlanHeader number={mainNumber} eyebrow="What to eat">
                Simple meals, <em class="accent-italic">from home.</em>
              </PlanHeader>
              <div class="pv-rows">
                {(
                  [
                    ['Breakfast', plan.guidance.mealIdeas.breakfast],
                    ['Lunch', plan.guidance.mealIdeas.lunch],
                    ['Dinner', plan.guidance.mealIdeas.dinner],
                    ['Snacks', plan.guidance.mealIdeas.snack],
                  ] as const
                ).map(([label, items]) => (
                  <div class="pv-row" key={label}>
                    <h3 class="pv-row-title">{label}</h3>
                    <ul class="pv-row-list">
                      {items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
                {plan.guidance.proteinFoods.length > 0 ? (
                  <div class="pv-row">
                    <h3 class="pv-row-title">Protein-rich foods</h3>
                    <ul class="pv-row-list">
                      {plan.guidance.proteinFoods.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div class="pv-row">
                  <h3 class="pv-row-title">Tips</h3>
                  <ul class="pv-row-list">
                    {plan.guidance.tips.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* Progress (ice) — plateRules only; guidance has no tracker */}
        {plan.kind === 'plateRules' ? (
          <section class="section" id="pv-week" data-surface="ice">
            <div class="container">
              <h2 class="pv-block-title">Progress</h2>
              {progressPanel}
            </div>
          </section>
        ) : null}

        {/* Your data (obsidian) — every plan kind */}
        <DataSection
          number={dataNumber}
          today={today}
          onReplaced={reloadFromStorage}
          onAnnounce={setAnnounce}
        />
      </div>

      {plan.kind === 'recipes' ? (
        <div class="print-only" aria-hidden="true">
          <h1>{answers.firstName ? `${capitalize(answers.firstName)}'s plan` : 'Your plan'}</h1>
          <p>{formatDate(saved.savedAt)}</p>
          {plan.days.map((printDay) => (
            <section class="pv-print-day" key={printDay.index}>
              <h2>{printDay.label}</h2>
              <p>
                {formatNumber(printDay.kcal)} kcal · {printDay.protein} g protein (approx.)
              </p>
              {printDay.meals.map((meal, index) => (
                <div key={`${printDay.index}-${index}`}>
                  <h3>
                    {meal.time} · {meal.label}
                  </h3>
                  <ul>
                    {meal.items.map((item, itemIndex) => (
                      <li key={`${item.foodId}-${itemIndex}`}>
                        {item.name} ({item.gloss}) — {itemMeta(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
          <div class="pv-print-tail">
            {targets ? (
              <section>
                <h2>Daily targets</h2>
                <p>
                  {formatNumber(targets.kcal)} kcal · {targets.protein} g protein · {targets.carbs}{' '}
                  g carbs · {targets.fat} g fat · {targets.fiber} g fibre
                </p>
              </section>
            ) : null}
            <section>
              <h2>Groceries</h2>
              {groceries.categories.map((category) => (
                <div key={category.id}>
                  <h3>{category.label}</h3>
                  <ul>
                    {category.items.map((item) => (
                      <li key={item.id}>
                        {item.name} {item.amount}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
            <section>
              <h2>Disclaimer</h2>
              <p>{plan.disclaimer}</p>
            </section>
          </div>
        </div>
      ) : null}

      {plan.kind === 'plateRules' && plan.plateGuide ? (
        <div class="print-only" aria-hidden="true">
          <h1>{answers.firstName ? `${capitalize(answers.firstName)}'s plan` : 'Your plan'}</h1>
          <section>
            <h2>Build your plate</h2>
            <p>{plan.plateGuide.baseRule}</p>
            <ul>
              {plan.plateGuide.portions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Disclaimer</h2>
            <p>{plan.disclaimer}</p>
          </section>
        </div>
      ) : null}

      <Sheet
        id="pv-swap"
        open={swapFor !== null}
        title="Swap this meal"
        onClose={() => setSwapFor(null)}
      >
        {swapOptions === null ? (
          <p class="pv-body-text">Loading…</p>
        ) : swapOptions.length === 0 ? (
          <p class="pv-body-text">No close alternatives for this meal.</p>
        ) : (
          swapOptions.map((option) => (
            <button
              type="button"
              class="pv-swap-option"
              key={option.foodId}
              disabled={busy}
              onClick={() => chooseSwap(option)}
            >
              <span>
                <span class="pv-swap-name">{option.name}</span>
                <span class="pv-swap-meta">
                  {option.measure} · {option.kcal} kcal · {option.protein} g protein
                </span>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          ))
        )}
      </Sheet>
    </div>
  );
}

export type { Plan };
