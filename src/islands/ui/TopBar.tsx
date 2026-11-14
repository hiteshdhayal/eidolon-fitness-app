interface Props {
  index: number;
  total: number;
  canBack: boolean;
  onBack: () => void;
}

const pad = (value: number) => String(value).padStart(2, '0');

export default function TopBar({ index, total, canBack, onBack }: Props) {
  const percent = total > 0 ? Math.min(100, Math.round((index / total) * 100)) : 0;

  return (
    <div class="qc-topbar">
      <div class="qc-topbar-row">
        <button
          type="button"
          class="qc-back"
          aria-label="Previous question"
          disabled={!canBack}
          onClick={onBack}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m12 19-7-7 7-7" />
            <path d="M19 12H5" />
          </svg>
        </button>
        <span class="qc-counter" aria-hidden="true">
          {pad(index)} / {pad(total)}
        </span>
      </div>
      <div class="qc-progress">
        <div class="qc-progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
