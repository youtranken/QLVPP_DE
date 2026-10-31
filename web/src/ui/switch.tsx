export function Switch({
  checked,
  label,
  text,
  disabled,
  describedBy,
  onChange,
}: {
  checked: boolean;
  label?: string;
  text?: string;
  disabled?: boolean;
  describedBy?: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch__track" aria-hidden="true">
        <span className="switch__thumb" />
      </span>
      {text && <span className="switch__text">{text}</span>}
    </button>
  );
}
