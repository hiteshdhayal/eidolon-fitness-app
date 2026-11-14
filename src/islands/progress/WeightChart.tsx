import { useEffect, useState } from 'preact/hooks';
import type { Entry } from '../../lib/progress/schema';
import { formatShort } from '../../lib/progress/dates';
import { formatSigned, smoothedSeries, type Summary } from '../../lib/progress/stats';
import {
  visibleRange,
  xScale,
  xTicks,
  yDomain,
  yScale,
  type ChartRange,
} from '../../lib/progress/chart';

interface Props {
  entries: Entry[];
  today: string;
  summary: Summary;
  /** Only passed when a target weight exists and was not rejected. */
  targetKg?: number;
}

const WIDTH = 640;
const HEIGHT = 260;
const PAD_LEFT = 38;
const PAD_RIGHT = 54;
const PAD_TOP = 14;
const PAD_BOTTOM = 26;
const INNER_W = WIDTH - PAD_LEFT - PAD_RIGHT;
const INNER_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

const RANGES: { id: ChartRange; label: string }[] = [
  { id: '4w', label: '4W' },
  { id: '12w', label: '12W' },
  { id: 'all', label: 'ALL' },
];

function kg(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function WeightChart({ entries, today, summary, targetKg }: Props) {
  const [range, setRange] = useState<ChartRange>('12w');
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const onChange = () => setWide(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const visible = visibleRange(entries, range, today);

  const toggle = (
    <div class="qc-segment pv-chart-range" role="group" aria-label="Chart range">
      {RANGES.map((item) => (
        <button
          key={item.id}
          type="button"
          class={range === item.id ? 'is-active' : ''}
          aria-pressed={range === item.id}
          onClick={() => setRange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  if (visible.length < 2) {
    return (
      <div class="pv-chart-wrap">
        {toggle}
        <p class="pv-body-text">Log at least 2 check-ins to see your trend.</p>
      </div>
    );
  }

  const first = visible[0];
  const last = visible[visible.length - 1];
  if (!first || !last) return null;

  const domainX = { from: first.date, to: last.date };
  const domainY = yDomain(
    visible.map((entry) => entry.weightKg),
    targetKg,
  );
  const series = smoothedSeries(visible);
  const latestWeight = last.weightKg;

  const x = (date: string) => PAD_LEFT + xScale(date, domainX, INNER_W);
  const y = (value: number) => PAD_TOP + yScale(value, domainY, INNER_H);

  const maxTicks = wide ? 8 : 5;
  const xTickDates = xTicks(
    visible.map((entry) => entry.date),
    maxTicks,
  );

  const targetY = targetKg !== undefined ? y(targetKg) : 0;
  const currentX = x(last.date);
  const currentY = y(latestWeight);
  const currentLabelRight = currentX < WIDTH - 90;

  const desc =
    `${summary.count} check-ins from ${formatShort(summary.firstDate ?? first.date)} to ` +
    `${formatShort(summary.latestDate ?? last.date)}. Latest ${latestWeight} kg, ` +
    `change since start ${summary.changeKg !== undefined ? formatSigned(summary.changeKg, 'kg') : '0.0 kg'}.`;

  return (
    <div class="pv-chart-wrap">
      {toggle}
      <svg
        class="pv-chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        role="img"
        aria-labelledby="chart-title chart-desc"
      >
        <title id="chart-title">Weight over time</title>
        <desc id="chart-desc">{desc}</desc>

        {domainY.ticks.map((tick) => (
          <g key={tick}>
            <line
              class="pv-chart-grid"
              x1={PAD_LEFT}
              x2={PAD_LEFT + INNER_W}
              y1={y(tick)}
              y2={y(tick)}
            />
            <text class="pv-chart-tick" x={PAD_LEFT - 8} y={y(tick) + 4} text-anchor="end">
              {tick}
            </text>
          </g>
        ))}

        {targetKg !== undefined ? (
          <g>
            <line
              class="pv-chart-target"
              x1={PAD_LEFT}
              x2={PAD_LEFT + INNER_W}
              y1={targetY}
              y2={targetY}
            />
            <text class="pv-chart-target-label" x={PAD_LEFT + INNER_W + 6} y={targetY + 4}>
              TARGET {kg(targetKg)} KG
            </text>
          </g>
        ) : null}

        {visible.map((entry) => (
          <circle
            key={entry.id}
            class="pv-chart-point"
            cx={x(entry.date)}
            cy={y(entry.weightKg)}
            r={3}
          />
        ))}

        <polyline
          class="pv-chart-line"
          points={series.map((point) => `${x(point.date)},${y(point.value)}`).join(' ')}
        />

        <circle class="pv-chart-current" cx={currentX} cy={currentY} r={5} />
        <text
          class="pv-chart-current-label"
          x={currentLabelRight ? currentX + 12 : currentX - 12}
          y={currentY + 4}
          text-anchor={currentLabelRight ? 'start' : 'end'}
        >
          {kg(latestWeight)} KG
        </text>

        {xTickDates.map((date) => (
          <text key={date} class="pv-chart-tick" x={x(date)} y={HEIGHT - 8} text-anchor="middle">
            {formatShort(date).toUpperCase()}
          </text>
        ))}
      </svg>
    </div>
  );
}
