import { useRef } from 'preact/hooks';

export interface TabDef {
  id: string;
  label: string;
}

interface Props {
  label: string;
  tabs: readonly TabDef[];
  active: string;
  onChange: (id: string) => void;
}

export default function Tabs({ label, tabs, active, onChange }: Props) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  function move(from: number, delta: number) {
    const next = (from + delta + tabs.length) % tabs.length;
    const tab = tabs[next];
    if (!tab) return;
    onChange(tab.id);
    refs.current[tab.id]?.focus();
  }

  return (
    <div class="pv-tablist" role="tablist" aria-label={label}>
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            ref={(element) => {
              refs.current[tab.id] = element;
            }}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            class={`pv-tab${selected ? ' is-active' : ''}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') {
                event.preventDefault();
                move(index, 1);
              } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                move(index, -1);
              } else if (event.key === 'Home') {
                event.preventDefault();
                move(0, 0);
              } else if (event.key === 'End') {
                event.preventDefault();
                move(tabs.length - 1, 0);
              }
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
