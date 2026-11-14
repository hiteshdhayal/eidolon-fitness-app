import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { site } from '../config/site';
import { track } from '../lib/analytics';
import { readGroceries, readPlan, writeGroceries, writePlan, type SavedPlan } from '../lib/storage';
import { STATES } from '../lib/engine/regions';
import { formatNumber } from '../lib/utils/format';
import type { Plan } from '../lib/engine/types';
import Callout from './ui/Callout';
import Stat from './ui/Stat';
import Tabs from './ui/Tabs';
import Sheet from './ui/Sheet';

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

function todayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

function stateName(code?: string): string {
  if (!code) return '—';
  if (code === 'OUT') return 'Outside India';
  return STATES.find((state) => state.code === code)?.name ?? '—';
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

export default function PlanView({ notes }: Props) {
  const [saved, setSaved] = useState<SavedPlan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState('plan');
  const [day, setDay] = useState(0);
  const [swapFor, setSwapFor] = useState<{ dayIndex: number; mealIndex: number } | null>(null);
  const [swapOptions, setSwapOptions] = useState<SwapOption[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [announce, setAnnounce] = useState('');
  const [toast, setToast] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const engineRef = useRef<Promise<[EngineModule, FoodsModule]> | null>(null);

  useEffect(() => {
    const plan = readPlan();
    if (plan) {
      setSaved(plan);
      setChecked(readGroceries(plan.plan.seed).checked);
      if (plan.plan.kind === 'recipes') setDay(todayIndex());
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
      setSwapOptions(
        engine.getSwaps(saved.plan, saved.answers, foods.FOODS, dayIndex, mealIndex),
      );
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
      setAnnounce(`New meals for ${plan.days[dayIndex]?.label ?? 'the day'}.`);
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

  async function share() {
    const url = site.siteUrl;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Eidolon', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setToast('Link copied');
    } catch {
      // user cancelled or clipboard blocked
    }
  }

  const dayTabs = useMemo(
    () => DAY_LABELS.map((label, index) => ({ id: String(index), label })),
    [],
  );

  if (!loaded) {
    return <div class="pv-section" aria-busy="true" />;
  }

  if (!saved) {
    return (
      <section class="pv-section section" data-surface="ice">
        <div class="container pv-width pv-empty">
          <h1>You don't have a plan yet</h1>
          <p class="qc-lede">It takes about 2 minutes.</p>
          <div class="qc-actions">
            <a class="qc-next" href="/plan/">
              Build my plan →
            </a>
          </div>
        </div>
      </section>
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
    stateName(answers.state === 'OUT' ? answers.homeRegion : answers.state),
    MEAL_LABELS[answers.mealPattern] ?? answers.mealPattern,
  ];

  return (
    <div class="pv-shell">
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>

      <div class="pv-screen">
        <section class="section" data-surface="ice">
          <div class="container pv-width">
            <p class="eyebrow-row">
              <span class="speed-bar" aria-hidden="true" />
              <span class="eyebrow">Your plan</span>
            </p>
            <div class="pv-head">
              <h1>{answers.firstName ? `${answers.firstName}'s plan` : 'Your plan'}</h1>
              <p class="pv-date">{formatDate(saved.savedAt)}</p>
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
            </div>

            {plan.safety.reasons.map((reason) => (
              <Callout tone="warning" key={reason.code}>
                {reason.message}
              </Callout>
            ))}

            {plan.notes.map((note) => (
              <Callout tone="info" key={note}>
                {note}
              </Callout>
            ))}

            {healthNotes.map((note) => (
              <div class="pv-block" key={note.id}>
                <h2 class="pv-block-title">{note.title}</h2>
                <div class="pv-note-body" dangerouslySetInnerHTML={{ __html: note.html }} />
                {note.reviewedBy ? <p class="pv-date">Reviewed by {note.reviewedBy}</p> : null}
              </div>
            ))}
          </div>
        </section>

        {plan.kind === 'guidance' && plan.guidance ? (
          <section class="section" data-surface="ice">
            <div class="container pv-width">
              <h2 class="pv-guidance-headline">{plan.guidance.headline}</h2>
              {(
                [
                  ['Breakfast', plan.guidance.mealIdeas.breakfast],
                  ['Lunch', plan.guidance.mealIdeas.lunch],
                  ['Dinner', plan.guidance.mealIdeas.dinner],
                  ['Snacks', plan.guidance.mealIdeas.snack],
                ] as const
              ).map(([label, items]) => (
                <div class="pv-block" key={label}>
                  <h3 class="pv-block-title">{label}</h3>
                  <ul class="pv-list">
                    {items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {plan.guidance.proteinFoods.length > 0 ? (
                <div class="pv-block">
                  <h3 class="pv-block-title">Protein-rich foods</h3>
                  <ul class="pv-list">
                    {plan.guidance.proteinFoods.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div class="pv-block">
                <h3 class="pv-block-title">Tips</h3>
                <ul class="pv-list">
                  {plan.guidance.tips.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {targets ? (
          <section class="pv-numbers" data-surface="obsidian">
            <div class="container pv-width">
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

        {targets ? (
          <section class="section" data-surface="ice">
            <div class="container pv-width">
              <h2 class="pv-block-title">How I worked this out</h2>
              <div class="pv-details">
                {targets.explain.map((step) => (
                  <details key={step.title}>
                    <summary>{step.title}</summary>
                    <p class="pv-details-text">{step.text}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {plan.kind === 'plateRules' && plan.plateGuide ? (
          <section class="section" data-surface="ice">
            <div class="container pv-width">
              <h2 class="pv-block-title">Build your plate</h2>
              <p class="pv-plate-rule">{plan.plateGuide.baseRule}</p>
              <ul class="pv-list">
                {plan.plateGuide.portions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <div class="pv-block">
                <h3 class="pv-block-title">At the mess</h3>
                <ul class="pv-list">
                  {plan.plateGuide.messTips.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div class="pv-block">
                <h3 class="pv-block-title">When you order</h3>
                {plan.plateGuide.orderingGuide.map((row) => (
                  <div class="pv-order-row" key={row.place}>
                    <span class="pv-order-place">{row.place}</span>
                    <span>{row.tip}</span>
                  </div>
                ))}
              </div>
              <div class="pv-block">
                <h3 class="pv-block-title">Protein back-ups</h3>
                <ul class="pv-list">
                  {plan.plateGuide.proteinTips.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {plan.kind === 'recipes' ? (
          <section class="section" data-surface="ice">
            <div class="container pv-width">
              <Tabs
                label="Plan sections"
                tabs={[
                  { id: 'plan', label: 'Plan' },
                  { id: 'groceries', label: 'Groceries' },
                  { id: 'progress', label: 'Progress' },
                ]}
                active={tab}
                onChange={setTab}
              />

              {tab === 'plan' ? (
                <div class="pv-panel" id="panel-plan" role="tabpanel" aria-labelledby="tab-plan">
                  <Tabs
                    label="Choose a day"
                    tabs={dayTabs}
                    active={String(day)}
                    onChange={(id) => setDay(Number(id))}
                  />
                  {activeDay ? (
                    <>
                      <div class="pv-day-summary">
                        <span>{activeDay.label}</span>
                        <span>
                          {formatNumber(activeDay.kcal)} kcal · {activeDay.protein} g protein (approx.)
                        </span>
                      </div>
                      {activeDay.meals.map((meal, mealIndex) => (
                        <article class="pv-meal" key={`${activeDay.index}-${meal.slot}-${mealIndex}`}>
                          <div class="pv-meal-head">
                            <div>
                              <p class="pv-meal-time">{meal.time}</p>
                              <h3 class="pv-meal-label">{meal.label}</h3>
                            </div>
                          </div>
                          {meal.items.map((item, itemIndex) => (
                            <div class="pv-item" key={`${item.foodId}-${itemIndex}`}>
                              <p>
                                <span class="pv-item-name">{item.name}</span>{' '}
                                <span class="pv-item-gloss">{item.gloss}</span>
                              </p>
                              <p class="pv-item-meta">
                                {item.measure} · {item.grams} g · {item.kcal} kcal · {item.protein} g
                                protein
                              </p>
                              {item.notes.map((note) => (
                                <p class="pv-item-note" key={note}>
                                  {note}
                                </p>
                              ))}
                            </div>
                          ))}
                          <div class="pv-meal-actions">
                            <button
                              type="button"
                              class="pv-btn"
                              onClick={() => openSwap(activeDay.index, mealIndex)}
                            >
                              Swap
                            </button>
                            <button
                              type="button"
                              class="pv-btn"
                              disabled={busy}
                              onClick={() => shuffle(activeDay.index)}
                            >
                              Shuffle day
                            </button>
                          </div>
                          <p class="pv-meal-total">
                            {formatNumber(meal.kcal)} kcal · {meal.protein} g protein
                          </p>
                        </article>
                      ))}
                    </>
                  ) : null}
                </div>
              ) : null}

              {tab === 'groceries' ? (
                <div
                  class="pv-panel"
                  id="panel-groceries"
                  role="tabpanel"
                  aria-labelledby="tab-groceries"
                >
                  {groceries.categories.map((category) => (
                    <div class="pv-grocery-group" key={category.id}>
                      <h3>{category.label}</h3>
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
                  {checked.length > 0 ? (
                    <button type="button" class="pv-btn pv-block" onClick={clearTicks}>
                      Clear ticks
                    </button>
                  ) : null}
                </div>
              ) : null}

              {tab === 'progress' ? (
                <div
                  class="pv-panel"
                  id="panel-progress"
                  role="tabpanel"
                  aria-labelledby="tab-progress"
                >
                  <p class="pv-details-text">
                    Weekly check-ins and a weight chart are coming next. For now, weigh yourself
                    once a week, same day, same time.
                  </p>
                  <FollowAnchor location="my-plan-progress" />
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {plan.kind === 'plateRules' || plan.kind === 'guidance' ? (
          <section class="section" data-surface="ice">
            <div class="container pv-width">
              <h2 class="pv-block-title">Progress</h2>
              <p class="pv-details-text">
                Weekly check-ins and a weight chart are coming next. For now, weigh yourself once a
                week, same day, same time.
              </p>
              <FollowAnchor location="my-plan-progress" />
            </div>
          </section>
        ) : null}

        <section class="pv-follow section" data-surface="obsidian">
          <div class="container pv-width">
            <p class="eyebrow-row">
              <span class="speed-bar" aria-hidden="true" />
              <span class="eyebrow">Stay close</span>
            </p>
            <p class="pv-follow-text">
              I post recipes and swaps from these plans every week.
            </p>
            <div class="pv-follow-actions">
              <FollowAnchor location="my-plan" primary />
              <button type="button" class="pv-btn" onClick={share}>
                Share this site
              </button>
            </div>
          </div>
        </section>

        <section class="section" data-surface="ice">
          <div class="container pv-width">
            <p class="pv-disclaimer">{plan.disclaimer}</p>
          </div>
        </section>
      </div>

      {plan.kind === 'recipes' ? (
        <div class="print-only" aria-hidden="true">
          <h1>{answers.firstName ? `${answers.firstName}'s plan` : 'Your plan'}</h1>
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
                        {item.name} ({item.gloss}) — {item.measure} · {item.grams} g · {item.kcal} kcal ·{' '}
                        {item.protein} g protein
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
          ))}
          {targets ? (
            <section class="pv-print-day">
              <h2>Daily targets</h2>
              <p>
                {formatNumber(targets.kcal)} kcal · {targets.protein} g protein · {targets.carbs} g
                carbs · {targets.fat} g fat · {targets.fiber} g fibre
              </p>
            </section>
          ) : null}
          <section class="pv-print-day">
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
          <section class="pv-print-day">
            <h2>Disclaimer</h2>
            <p>{plan.disclaimer}</p>
          </section>
        </div>
      ) : null}

      {plan.kind === 'plateRules' && plan.plateGuide ? (
        <div class="print-only" aria-hidden="true">
          <h1>{answers.firstName ? `${answers.firstName}'s plan` : 'Your plan'}</h1>
          <section class="pv-print-day">
            <h2>Build your plate</h2>
            <p>{plan.plateGuide.baseRule}</p>
            <ul>
              {plan.plateGuide.portions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
          <section class="pv-print-day">
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
          <p class="pv-details-text">Loading…</p>
        ) : swapOptions.length === 0 ? (
          <p class="pv-details-text">No close alternatives for this meal.</p>
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

      {toast ? <div class="pv-toast">{toast}</div> : null}
    </div>
  );
}

interface FollowAnchorProps {
  location: string;
  primary?: boolean;
}

function FollowAnchor({ location, primary = false }: FollowAnchorProps) {
  const label = `Follow @${site.instagramHandle}`;
  return (
    <a
      class={primary ? 'pv-follow-link pv-follow-primary' : 'pv-follow-link'}
      href={site.instagramUrl}
      target="_blank"
      rel="noopener"
      aria-label={`${label} — Follow ${site.creatorName} on Instagram (opens in a new tab)`}
      data-umami-event="follow_click"
      data-umami-event-location={location}
    >
      {label}
    </a>
  );
}

export type { Plan };
