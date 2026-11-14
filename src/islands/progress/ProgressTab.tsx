import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { track } from '../../lib/analytics';
import { deleteEntry, setProgressFields, upsertEntry } from '../../lib/storage';
import type { Entry, Progress } from '../../lib/progress/schema';
import { addDays, formatLong, formatShort } from '../../lib/progress/dates';
import { formatSigned, summary as buildSummary } from '../../lib/progress/stats';
import { evaluateRules } from '../../lib/progress/rules';
import { validateEntry, type EntryErrors } from '../../lib/progress/form';
import Callout from '../ui/Callout';
import WeightChart from './WeightChart';

export interface ProgressTabProps {
  progress: Progress;
  onChange: (next: Progress) => void;
  onAnnounce: (message: string) => void;
  planWeightKg: number;
  effectiveGoal: 'lose' | 'muscle' | 'healthier' | 'gain';
  mode: 'full' | 'gentle' | 'guidance';
  targetKg?: number;
  today: string;
  /** Increments when the nudge's "Log weight" asks for the Weight input. */
  focusSignal: number;
}

const VISIBLE_ROWS = 10;

function chronological(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function changeText(value: number): string {
  if (Math.round(value * 10) === 0) return '0.0';
  return value < 0 ? `\u2212${Math.abs(value).toFixed(1)}` : `+${value.toFixed(1)}`;
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

export default function ProgressTab({
  progress,
  onChange,
  onAnnounce,
  planWeightKg,
  effectiveGoal,
  mode,
  targetKg,
  today,
  focusSignal,
}: ProgressTabProps) {
  const entries = useMemo(() => chronological(progress.entries), [progress.entries]);
  const latest = entries[entries.length - 1];

  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(today);
  const [waist, setWaist] = useState('');
  const [errors, setErrors] = useState<EntryErrors>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const touched = useRef(false);
  const weightRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const waistRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSignal > 0) weightRef.current?.focus();
  }, [focusSignal]);

  // Re-validate a moment after typing pauses.
  useEffect(() => {
    if (!touched.current) return;
    const timer = window.setTimeout(() => {
      setErrors(validateEntry({ weight, date, waist }, today).errors);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [weight, date, waist, today]);

  const replaces = entries.some((entry) => entry.date === date);
  const summary = buildSummary(entries);
  const card = evaluateRules({
    entries,
    today,
    planWeightKg,
    effectiveGoal,
    mode,
    dismissedRules: progress.dismissedRules,
  });

  function focusFirst(nextErrors: EntryErrors) {
    if (nextErrors.weight) weightRef.current?.focus();
    else if (nextErrors.date) dateRef.current?.focus();
    else if (nextErrors.waist) waistRef.current?.focus();
  }

  function submit() {
    touched.current = true;
    const result = validateEntry({ weight, date, waist }, today);
    setErrors(result.errors);
    if (!result.value) {
      focusFirst(result.errors);
      return;
    }
    onChange(upsertEntry(result.value));
    setWeight('');
    setWaist('');
    track('progress_log');
    onAnnounce('Check-in saved.');
  }

  function editEntry(entry: Entry) {
    setDate(entry.date);
    setWeight(String(entry.weightKg));
    setWaist(entry.waistCm !== undefined ? String(entry.waistCm) : '');
    setErrors({});
    weightRef.current?.focus();
  }

  function hideRule() {
    if (!card) return;
    onChange(
      setProgressFields({
        dismissedRules: { ...progress.dismissedRules, [card.id]: today },
      }),
    );
  }

  const newestFirst = [...entries].reverse();
  const rows = showAll ? newestFirst : newestFirst.slice(0, VISIBLE_ROWS);

  return (
    <div class="pv-progress">
      <p class="eyebrow-row">
        <span class="speed-bar" aria-hidden="true" />
        <span class="eyebrow">Weekly check-in</span>
      </p>
      <h3 class="pv-subhead">
        Log a <em class="accent-italic">check-in.</em>
      </h3>

      <div class="pv-form">
        <div class="pv-form-grid">
          <div class="qc-field-row">
            <label class="qc-field-label" for="pv-weight">
              Weight
            </label>
            <div class="pv-field-wrap">
              <input
                id="pv-weight"
                ref={weightRef}
                class="qc-input"
                type="text"
                inputmode="decimal"
                autocomplete="off"
                value={weight}
                onInput={(event) => {
                  touched.current = true;
                  setWeight(event.currentTarget.value);
                }}
              />
              <span class="pv-unit">kg</span>
            </div>
            {errors.weight ? (
              <p class="qc-error" role="alert">
                <AlertIcon />
                <span>{errors.weight}</span>
              </p>
            ) : null}
          </div>

          <div class="qc-field-row">
            <label class="qc-field-label" for="pv-date">
              Date
            </label>
            <input
              id="pv-date"
              ref={dateRef}
              class="qc-input"
              type="date"
              value={date}
              max={today}
              min={addDays(today, -730)}
              onInput={(event) => {
                touched.current = true;
                setDate(event.currentTarget.value);
              }}
            />
            {errors.date ? (
              <p class="qc-error" role="alert">
                <AlertIcon />
                <span>{errors.date}</span>
              </p>
            ) : null}
            {replaces ? (
              <p class="pv-note-inline">This replaces your {formatShort(date)} check-in.</p>
            ) : null}
          </div>
        </div>

        <div class="qc-field-row">
          <label class="qc-field-label" for="pv-waist">
            Waist (optional)
          </label>
          <div class="pv-field-wrap">
            <input
              id="pv-waist"
              ref={waistRef}
              class="qc-input"
              type="text"
              inputmode="decimal"
              autocomplete="off"
              value={waist}
              onInput={(event) => {
                touched.current = true;
                setWaist(event.currentTarget.value);
              }}
            />
            <span class="pv-unit">cm</span>
          </div>
          <p class="qc-helper">
            Measure at your belly button, after breathing out. Belly fat is a key health marker for
            Indians.
          </p>
          {errors.waist ? (
            <p class="qc-error" role="alert">
              <AlertIcon />
              <span>{errors.waist}</span>
            </p>
          ) : null}
        </div>

        <div class="pv-form-actions">
          <button type="button" class="qc-next" onClick={submit}>
            Save check-in
          </button>
        </div>
      </div>

      {card ? (
        <div class="pv-suggestion">
          <Callout tone="info" heading={card.title}>
            <p>{card.body}</p>
            {card.suggestions.length > 0 ? (
              <ul class="pv-suggestion-list">
                {card.suggestions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </Callout>
          <div class="pv-suggestion-actions">
            {card.action === 'updatePlan' && latest ? (
              <a class="qc-secondary" href={`/plan/?edit=1&weight=${latest.weightKg}`}>
                Update my plan
              </a>
            ) : null}
            <button type="button" class="pv-link" onClick={hideRule}>
              Hide this for now
            </button>
          </div>
        </div>
      ) : null}

      {summary.count > 0 ? (
        <>
          <dl class="pv-summary">
            <div class="pv-summary-stat">
              <dt class="pv-summary-label">Change since start</dt>
              <dd class="pv-summary-value">
                {summary.changeKg !== undefined ? formatSigned(summary.changeKg, 'kg') : '—'}
              </dd>
            </div>
            <div class="pv-summary-stat">
              <dt class="pv-summary-label">Average per week</dt>
              <dd class="pv-summary-value">
                {summary.weeklyKg !== undefined ? formatSigned(summary.weeklyKg, 'kg') : '—'}
              </dd>
            </div>
            <div class="pv-summary-stat">
              <dt class="pv-summary-label">Check-ins</dt>
              <dd class="pv-summary-value">{summary.count}</dd>
            </div>
          </dl>
          {summary.firstDate ? (
            <p class="pv-summary-note">Since {formatLong(summary.firstDate)}</p>
          ) : null}
          {summary.waistChangeCm !== undefined && summary.firstWaistDate ? (
            <p class="pv-summary-note">
              Waist: {formatSigned(summary.waistChangeCm, 'cm')} since{' '}
              {formatLong(summary.firstWaistDate)}
            </p>
          ) : null}

          <div class="pv-chart-block">
            <WeightChart entries={entries} today={today} summary={summary} targetKg={targetKg} />
          </div>

          <div class="pv-history">
            <h4 class="pv-history-label">Your check-ins</h4>
            <table class="pv-table">
              <caption class="sr-only">All check-ins, newest first</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Weight</th>
                  <th scope="col" class="pv-waist-col">
                    Waist
                  </th>
                  <th scope="col">Change</th>
                  <th scope="col">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const position = entries.findIndex((item) => item.id === entry.id);
                  const previous = position > 0 ? entries[position - 1] : undefined;
                  const change = previous ? entry.weightKg - previous.weightKg : undefined;
                  return (
                    <tr key={entry.id}>
                      <td>{formatShort(entry.date)}</td>
                      <td>
                        {entry.weightKg} kg
                        <span class="pv-waist-inline">
                          {entry.waistCm !== undefined ? `${entry.waistCm} cm waist` : ''}
                        </span>
                      </td>
                      <td class="pv-waist-col">
                        {entry.waistCm !== undefined ? `${entry.waistCm} cm` : '—'}
                      </td>
                      <td>{change !== undefined ? changeText(change) : '—'}</td>
                      <td class="pv-table-actions">
                        {deletingId === entry.id ? (
                          <span class="pv-row-confirm">
                            Delete this check-in?
                            <button
                              type="button"
                              class="pv-link"
                              onClick={() => {
                                onChange(deleteEntry(entry.id));
                                setDeletingId(null);
                                setShowAll(false);
                                onAnnounce('Check-in deleted.');
                              }}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              class="pv-link"
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              class="pv-link"
                              aria-label={`Edit check-in for ${formatShort(entry.date)}`}
                              onClick={() => editEntry(entry)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              class="pv-link"
                              aria-label={`Delete check-in for ${formatShort(entry.date)}`}
                              onClick={() => setDeletingId(entry.id)}
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!showAll && newestFirst.length > VISIBLE_ROWS ? (
              <button type="button" class="pv-btn pv-history-more" onClick={() => setShowAll(true)}>
                Show all {newestFirst.length}
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <p class="pv-body-text pv-empty-log">
          Log your weight once a week — same day, same time, before breakfast. Your trend will show
          up here.
        </p>
      )}

      <p class="pv-quiet">
        If food or weight is causing you stress, talking to a doctor or counsellor helps.
      </p>
    </div>
  );
}
