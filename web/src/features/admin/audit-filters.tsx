import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { FormField } from '@/ui/form-field';
import { NO_FILTERS, type AuditFilters } from '@/features/admin/admin.api';
import { AUDIT_ACTIONS, auditActionLabel } from '@/features/admin/audit-actions';
import { UserPicker } from '@/features/directory/user-picker';
import type { DirectoryUser } from '@/features/directory/directory.api';

const ACTIONS_LIST_ID = 'audit-action-options';

// Server cũng chặn to < from (400); kiểm trước để lỗi gắn đúng ô thay vì báo tải lỗi chung
export function AuditFilterBar({ onApply }: { onApply: (f: AuditFilters) => void }) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AuditFilters>(NO_FILTERS);
  const [actor, setActor] = useState<DirectoryUser | null>(null);
  // Đổi key để ô tìm người trống lại khi xóa lọc (ô giữ chữ đã gõ trong state riêng)
  const [pickerKey, setPickerKey] = useState(0);
  const [rangeError, setRangeError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const set = (k: keyof AuditFilters, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const invalid = draft.from !== '' && draft.to !== '' && draft.to < draft.from;
    setRangeError(invalid);
    if (!invalid) onApply({ ...draft, actor: actor?.sub ?? '', action: draft.action.trim() });
  };

  const clear = () => {
    setDraft(NO_FILTERS);
    setActor(null);
    setPickerKey((k) => k + 1);
    setRangeError(false);
    onApply(NO_FILTERS);
  };

  return (
    <form ref={formRef} className="a-panel audit-filters" aria-label={t('audit.filters.label')} onSubmit={submit} noValidate>
      <UserPicker
        key={pickerKey}
        label={t('audit.filters.actor')}
        searchLabel={t('audit.filters.actorSearch')}
        value={actor}
        allowLocked
        resultsWhenEmpty={false}
        onChange={setActor}
        onEnter={() => formRef.current?.requestSubmit()}
      />
      <FormField label={t('audit.filters.action')} hint={t('audit.filters.actionHint')}>
        {(p) => (
          <>
            <input {...p} list={ACTIONS_LIST_ID} value={draft.action} onChange={(e) => set('action', e.target.value)} />
            <datalist id={ACTIONS_LIST_ID}>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a} label={auditActionLabel(t, a)} />
              ))}
            </datalist>
          </>
        )}
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
