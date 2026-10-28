import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { NO_FILTERS, type AuditFilters } from '@/features/admin/admin.api';

// Server cũng chặn to < from (400); kiểm trước để lỗi gắn đúng ô thay vì báo tải lỗi chung
export function AuditFilterBar({ onApply }: { onApply: (f: AuditFilters) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AuditFilters>(NO_FILTERS);
  const [rangeError, setRangeError] = useState(false);
  const set = (k: keyof AuditFilters, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const invalid = draft.from !== '' && draft.to !== '' && draft.to < draft.from;
    setRangeError(invalid);
    if (!invalid) onApply({ ...draft, actor: draft.actor.trim(), action: draft.action.trim() });
  };

  const clear = () => {
    setDraft(NO_FILTERS);
    setRangeError(false);
    onApply(NO_FILTERS);
  };

  return (
    <form className="a-panel audit-filters" aria-label={t('audit.filters.label')} onSubmit={submit} noValidate>
      <FormField label={t('audit.filters.actor')} hint={t('audit.filters.actorHint')}>
        {(p) => <input {...p} value={draft.actor} onChange={(e) => set('actor', e.target.value)} />}
      </FormField>
      <FormField label={t('audit.filters.action')} hint={t('audit.filters.actionHint')}>
        {(p) => <input {...p} value={draft.action} onChange={(e) => set('action', e.target.value)} />}
      </FormField>
      <FormField label={t('audit.filters.from')}>
        {(p) => <input {...p} type="date" value={draft.from} onChange={(e) => set('from', e.target.value)} />}
      </FormField>
      <FormField label={t('audit.filters.to')} error={rangeError ? t('audit.filters.rangeInvalid') : undefined}>
        {(p) => <input {...p} type="date" value={draft.to} onChange={(e) => set('to', e.target.value)} />}
      </FormField>
      <div className="audit-filter-actions">
        <button type="submit" className="btn btn--primary">
          {t('audit.filters.apply')}
        </button>
        <button type="button" className="btn" onClick={clear}>
          {t('audit.filters.clear')}
        </button>
      </div>
    </form>
  );
}
