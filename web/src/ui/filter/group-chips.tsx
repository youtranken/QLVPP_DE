export interface ChipGroup {
  id: string;
  label: string;
}

interface Props {
  groups: ChipGroup[];
  counts: ReadonlyMap<string, number>;
  value: string;
  onChange: (id: string) => void;
  label: string;
  allLabel: string;
  total: number;
  className?: string;
  chipClassName?: string;
  countClassName?: string;
}

export const ALL_GROUPS = 'all';

export function GroupChips({ groups, counts, value, onChange, label, allLabel, total, className, chipClassName, countClassName }: Props) {
  const chip = (id: string, text: string, n: number) => (
    <button key={id} type="button" className={chipClassName} aria-pressed={value === id} onClick={() => onChange(id)}>
      {text} <span className={countClassName}>{n}</span>
    </button>
  );
  return (
    <div className={className} role="group" aria-label={label}>
      {chip(ALL_GROUPS, allLabel, total)}
      {groups.map((g) => chip(g.id, g.label, counts.get(g.id) ?? 0))}
    </div>
  );
}
