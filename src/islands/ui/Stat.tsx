interface Props {
  value: string;
  label: string;
  accent?: boolean;
}

export default function Stat({ value, label, accent = false }: Props) {
  return (
    <div class="pv-stat">
      <span class={`pv-stat-value${accent ? ' is-accent' : ''}`}>{value}</span>
      <span class="pv-stat-label">{label}</span>
    </div>
  );
}
