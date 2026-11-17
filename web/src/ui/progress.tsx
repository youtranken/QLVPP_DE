export function Progress({
  done,
  total,
  tone = 'ok',
  label,
  text,
}: {
  done: number;
  total: number;
  tone?: 'ok' | 'warn' | 'danger';
  label: string;
  // Chữ hiện khác tên đọc màn hình (vd "18/35" so với "Đã giao 18/35")
  text?: string;
}) {
  const value = Math.min(Math.max(done, 0), total);
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="progress">
      <div
        className={`progress__bar progress__bar--${tone}`}
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className="progress__label">{text ?? label}</span>
    </div>
  );
}
