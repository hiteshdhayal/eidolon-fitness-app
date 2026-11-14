import { useRef } from 'preact/hooks';

interface Props {
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  checked: boolean;
  label: string;
  sublabel?: string;
  onSelect: (value: string, viaPointer: boolean) => void;
}

export default function OptionCard({
  type,
  name,
  value,
  checked,
  label,
  sublabel,
  onSelect,
}: Props) {
  const viaPointer = useRef(false);

  return (
    <label
      class={`qc-option${checked ? ' is-selected' : ''}`}
      onPointerDown={() => {
        viaPointer.current = true;
      }}
    >
      <input
        class="sr-only"
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={() => {
          const pointer = viaPointer.current;
          viaPointer.current = false;
          onSelect(value, pointer);
        }}
      />
      <span class="qc-option-text">
        <span class="qc-option-label">{label}</span>
        {sublabel ? <span class="qc-option-sublabel">{sublabel}</span> : null}
      </span>
      <span class="qc-option-mark" aria-hidden="true">
        {checked ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : null}
      </span>
    </label>
  );
}
