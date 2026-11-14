import { useMemo, useState } from 'preact/hooks';
import { STATES } from '../../lib/engine/regions';

interface ComboItem {
  code: string;
  name: string;
}

// A–Z by name, with "Outside India" appended last when allowed.
const STATE_ITEMS: ComboItem[] = [...STATES]
  .sort((a, b) => a.name.localeCompare(b.name, 'en'))
  .map((state) => ({ code: state.code, name: state.name }));

interface Props {
  id: string;
  legend: string;
  value?: string;
  includeOutside?: boolean;
  onChange: (code: string) => void;
}

export default function StateCombobox({
  id,
  legend,
  value,
  includeOutside = false,
  onChange,
}: Props) {
  const items = useMemo(
    () => (includeOutside ? [...STATE_ITEMS, { code: 'OUT', name: 'Outside India' }] : STATE_ITEMS),
    [includeOutside],
  );
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const selected = items.find((item) => item.code === value);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((item) => item.name.toLowerCase().includes(needle)) : items;
  }, [items, query]);
  const activeItem = filtered[Math.min(active, Math.max(0, filtered.length - 1))];

  function choose(item?: ComboItem) {
    if (!item) return;
    onChange(item.code);
    setOpen(false);
    setQuery('');
  }

  return (
    <div class="qc-combobox">
      <input
        id={id}
        class="qc-input"
        type="text"
        role="combobox"
        aria-label={legend}
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        aria-activedescendant={open && activeItem ? `${id}-opt-${activeItem.code}` : undefined}
        autocomplete="off"
        placeholder="Start typing"
        value={open ? query : (selected?.name ?? '')}
        onFocus={() => {
          setOpen(true);
          setQuery('');
          setActive(0);
        }}
        onInput={(event) => {
          setOpen(true);
          setQuery(event.currentTarget.value);
          setActive(0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActive((current) => Math.min(current + 1, Math.max(0, filtered.length - 1)));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((current) => Math.max(current - 1, 0));
          } else if (event.key === 'Enter') {
            if (open) {
              event.preventDefault();
              choose(activeItem);
            }
          } else if (event.key === 'Escape') {
            setOpen(false);
            setQuery('');
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 120);
        }}
      />
      {open ? (
        <ul class="qc-listbox" id={`${id}-listbox`} role="listbox" aria-label={legend}>
          {filtered.map((item) => (
            <li
              key={item.code}
              id={`${id}-opt-${item.code}`}
              role="option"
              aria-selected={item.code === value}
              class={item === activeItem ? 'is-active' : ''}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(item);
              }}
            >
              {item.name}
            </li>
          ))}
          {filtered.length === 0 ? <li class="qc-listbox-empty">No match</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
