import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';

export function InlineNumber({
  value,
  label,
  min,
  max,
  onCommit,
  formatError,
}: {
  value: number;
  label: string;
  min?: number;
  max?: number;
  onCommit: (n: number) => Promise<void>;
  formatError?: (e: unknown) => string;
}) {
  const { t } = useTranslation();
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const committing = useRef(false);

  const close = () => {
    setDraft(null);
    setError(null);
  };

  const commit = async () => {
    if (draft === null || committing.current) return;
    const n = Number(draft);
    if (draft.trim() === '' || !Number.isFinite(n)) return setError(t('common.inline.invalid'));
    if (n === value) return close();
    committing.current = true;
    setBusy(true);
    try {
      await onCommit(n);
      close();
    } catch (e) {
      setError(formatError ? formatError(e) : e instanceof Error ? e.message : t('common.inline.saveFailed'));
    } finally {
      committing.current = false;
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  if (draft === null) {
    return (
      <button type="button" className="inline-number num" aria-label={label} onClick={() => setDraft(String(value))}>
        {value}
      </button>
    );
  }
  return (
    <span className="inline-number-edit">
      <input
        autoFocus
        type="number"
        inputMode="numeric"
        className="inline-number__input num"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        min={min}
        max={max}
        value={draft}
        disabled={busy}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <span className="inline-number__hint">{t('common.inline.hint')}</span>
      {error && (
        <span id={errorId} className="inline-number__error">
          <Icon name="alert" size={14} />
          {error}
        </span>
      )}
    </span>
  );
}
