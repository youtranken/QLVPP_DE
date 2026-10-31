import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { useDirectoryNames, type DirectoryUser } from '@/features/directory/directory.api';
import { UserPicker } from '@/features/directory/user-picker';
import type { AuditFilters } from './admin.api';
import { AUDIT_ACTIONS, auditActionLabel } from './audit-actions';
import { dateRangeInvalid } from './audit-quick-ranges';

const SYSTEM_ACTOR = 'system';

interface Props {
  applied: AuditFilters;
  serverError: { from: boolean; to: boolean };
  onApply: (f: AuditFilters) => void;
  onClear: () => void;
}

function useActorUser(sub: string): DirectoryUser | null {
  const { t } = useTranslation();
  const names = useDirectoryNames().data;
  return useMemo(() => {
    if (!sub) return null;
    const fullName = sub === SYSTEM_ACTOR ? t('audit.filters.system') : (names?.get(sub) ?? null);
    return { sub, fullName, email: null, department: null, status: 'active' };
  }, [sub, names, t]);
}

// Đổi key của form khi URL đổi để bản nháp luôn khớp bộ lọc đang áp dụng
export function AuditFilterBar({ applied, serverError, onApply, onClear }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(applied);
  const [rangeError, setRangeError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const actor = useActorUser(draft.actor);
  const set = (k: keyof AuditFilters, v: string) => setDraft((d) => ({ ...d, [k]: v }));
  const known = AUDIT_ACTIONS.includes(draft.action);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const invalid = dateRangeInvalid(draft.from, draft.to);
    setRangeError(invalid);
    if (!invalid) onApply(draft);
  };

  return (
    <form ref={formRef} className="au-filters" aria-label={t('audit.filters.label')} onSubmit={submit} noValidate>
      <div className="au-actor">
        <UserPicker
          label={t('audit.filters.actor')}
          searchLabel={t('audit.filters.actorSearch')}
          value={actor}
          allowLocked
          resultsWhenEmpty={false}
          onChange={(u) => set('actor', u?.sub ?? '')}
          onEnter={() => formRef.current?.requestSubmit()}
        />
        {!draft.actor && (
          <button type="button" className="btn btn--sm au-system" onClick={() => set('actor', SYSTEM_ACTOR)}>
            {t('audit.filters.system')}
          </button>
        )}
      </div>
      <FormField label={t('audit.filters.action')}>
        {(p) => (
          <select {...p} value={draft.action} onChange={(e) => set('action', e.target.value)}>
            <option value="">{t('audit.filters.anyAction')}</option>
            {draft.action !== '' && !known && <option value={draft.action}>{draft.action}</option>}
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {auditActionLabel(t, a)}
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label={t('audit.filters.from')} error={serverError.from ? t('audit.filters.dateInvalid') : undefined}>
        {(p) => <input {...p} type="date" value={draft.from} onChange={(e) => set('from', e.target.value)} />}
      </FormField>
      <FormField label={t('audit.filters.to')} error={rangeError ? t('audit.filters.rangeInvalid') : serverError.to ? t('audit.filters.dateInvalid') : undefined}>
        {(p) => <input {...p} type="date" value={draft.to} onChange={(e) => set('to', e.target.value)} />}
      </FormField>
      <div className="au-filter-actions">
        <button type="submit" className="btn btn--primary">
          {t('audit.filters.apply')}
        </button>
        <button type="button" className="btn btn--ghost" onClick={onClear}>
          {t('audit.filters.clear')}
        </button>
      </div>
    </form>
  );
}

