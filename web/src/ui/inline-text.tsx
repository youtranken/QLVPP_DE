import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/ui/icon';

export function InlineText({
  value,
  label,
  maxLength,
  placeholder,
  onCommit,
  formatError,
}: {
  value: string;
  label: string;
  maxLength?: number;
  placeholder?: string;
  onCommit: (text: string) => Promise<void>;
  formatError: (e: unknown) => string;
}) {
  const { t } = useTranslation();
  const errorId = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const refocusTrigger = useRef(false);

  useEffect(() => {
    if (draft === null && refocusTrigger.current) {
      refocusTrigger.current = false;
      trigger.current?.focus();
    }
  }, [draft]);

  const close = () => {
    refocusTrigger.current = true;
    setDraft(null);
    setError(null);
  };

  const commit = async () => {
    if (draft === null || busy) return;
    const text = draft.trim();
    if (text === value) return close();
    setBusy(true);
    try {
      await onCommit(text);
      close();
    } catch (e) {
      setError(formatError(e));
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  };

  if (draft === null) {
    return (
      <button ref={trigger} type="button" className="inline-text" aria-label={label} onClick={() => setDraft(value)}>
        {value || <span className="inline-text__empty">{placeholder}</span>}
      </button>
    );
  }
  return (
    <span className="inline-number-edit inline-text-edit">
      <input
        autoFocus
        type="text"
        className="inline-number__input inline-text__input"
        aria-label={label}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        maxLength={maxLength}
        value={draft}
        readOnly={busy}
        aria-busy={busy || undefined}
        onBlur={() => draft.trim() === value && !busy && close()}
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
