import type { ComponentChildren } from 'preact';

interface Props {
  tone?: 'warning' | 'info';
  heading?: string;
  children: ComponentChildren;
}

function CalloutIcon({ tone }: { tone: 'warning' | 'info' }) {
  return (
    <svg
      class="pv-callout-icon"
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
      {tone === 'info' ? (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </>
      ) : (
        <>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </>
      )}
    </svg>
  );
}

export default function Callout({ tone = 'info', heading, children }: Props) {
  return (
    <div class={`pv-callout pv-callout-${tone}`}>
      <CalloutIcon tone={tone} />
      <div class="pv-callout-main">
        {heading ? <p class="pv-callout-heading">{heading}</p> : null}
        <div class="pv-callout-text">{children}</div>
      </div>
    </div>
  );
}
