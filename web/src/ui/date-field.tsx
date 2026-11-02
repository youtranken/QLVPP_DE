import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isoToDmy, parseDmy } from '@/lib/dmy-date';
import { FormField } from '@/ui/form-field';

interface Props {
  label: string;
  value: string;
  error?: string;
  className?: string;
  onChange: (iso: string | null) => void;
}

const isoOf = (text: string) => {
  const p = parseDmy(text);
  return p.kind === 'ok' ? p.iso : p.kind === 'empty' ? '' : null;
};

// Ô chữ dd/mm/yyyy thay input date: input date hiện theo locale trình duyệt (mm/dd ở máy tiếng Anh)
export function DateField({ label, value, error, className, onChange }: Props) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => isoToDmy(value));
  const [shown, setShown] = useState(value);
  const [touched, setTouched] = useState(false);
  if (value !== shown) {
    setShown(value);
    if (value !== isoOf(text)) setText(isoToDmy(value));
  }
  const iso = isoOf(text);
  const ownError = touched && iso === null ? t('common.dateField.invalid') : undefined;

  const change = (next: string) => {
    setText(next);
    setTouched(false);
    const v = isoOf(next);
    if (v !== null) setShown(v);
    onChange(v);
  };
  const blur = () => {
    setTouched(true);
    if (iso) setText(isoToDmy(iso));
  };

  return (
    <FormField label={label} hint={t('common.dateField.hint')} error={error ?? ownError} className={['date-field', className].filter(Boolean).join(' ')}>
      {(p) => (
        <input {...p} type="text" inputMode="numeric" autoComplete="off" placeholder={t('common.dateField.hint')} maxLength={10} value={text} onChange={(e) => change(e.target.value)} onBlur={blur} />
      )}
    </FormField>
  );
}
