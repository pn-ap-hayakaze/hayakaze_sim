interface Props {
  value: number;
  max: number;
  label: string;
}

export function ProgressBar({ value, max, label }: Props) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      <div className="mb-1 text-sm text-neutral-600">{label}</div>
      <div className="h-2 w-full rounded bg-neutral-200">
        <div className="h-2 rounded bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
