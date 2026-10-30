import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiErrorString } from '@/lib/api-error';
import { ApiError } from '@/lib/api-client';
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
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const refocusTrigger = useRef(false);

  useEffect(() => {
    if (draft === null && refocusTrigger.current) {
      refocusTrigger.current = false;
      trigger.current?.focus();
    }
  }, [draft]);

  const defaultMessage = (e: unknown) => {
    const text = e instanceof ApiError ? apiErrorString(e, 'message') : e instanceof Error ? e.message : undefined;
    return text || t('common.inline.saveFailed');
  };

  const close = () => {
    refocusTrigger.current = true;
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
      setError(formatError ? formatError(e) : defaultMessage(e));
      input.current?.focus();
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
      <button ref={trigger} type="button" className="inline-number num" aria-label={label} onClick={() => setDraft(String(value))}>
        {value}
      </button>
    );
  }
  return (
    <span className="inline-number-edit">
      <input
        ref={input}
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
        readOnly={busy}
        aria-busy={busy || undefined}
        onBlur={() => Number(draft) === value && !busy && close()}
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
