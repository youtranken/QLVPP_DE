import { useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { DateRangeField } from '@/ui/date-range-field';
import { Select } from '@/ui/select';
import type { DirectoryUser } from '@/features/directory/directory.api';
import { useDirectoryNames } from '@/features/directory/use-all-users';
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
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState(applied);
  const [rangeError, setRangeError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const system = draft.actor === SYSTEM_ACTOR;
  const actor = useActorUser(system ? '' : draft.actor);
  const set = (patch: Partial<AuditFilters>) => setDraft((d) => ({ ...d, ...patch }));
  const dateError = rangeError ? t('audit.filters.rangeInvalid') : serverError.from || serverError.to ? t('audit.filters.dateInvalid') : undefined;
  const known = AUDIT_ACTIONS.includes(draft.action);
  const actionOptions = [
    { value: '', label: t('audit.filters.anyAction') },
    ...(draft.action !== '' && !known ? [{ value: draft.action, label: draft.action }] : []),
    ...AUDIT_ACTIONS.map((a) => ({ value: a, label: auditActionLabel(t, a) })),
  ];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const invalid = dateRangeInvalid(draft.from, draft.to);
    setRangeError(invalid);
    if (!invalid) onApply(draft);
  };

  // Một hàng: người thực hiện (kèm nút bật "Hệ thống") · hành động · khoảng ngày · Lọc / Xóa lọc; hẹp thì xuống hàng theo cụm.
  // Lưới nằm trong form để CSS hỏi bề rộng form (container query) chứ không hỏi cửa sổ: thanh bên rộng/thu gọn đổi chỗ trống
  return (
    <form ref={formRef} className="au-filters" lang={i18n.language} aria-label={t('audit.filters.label')} onSubmit={submit} noValidate>
      <div className="au-filters__grid">
        <div className="au-actor">
          <UserPicker
            label={t('audit.filters.actor')}
            searchLabel={t('audit.filters.actorSearch')}
            placeholder={t('audit.filters.actorHint')}
            value={actor}
            allowLocked
            resultsWhenEmpty={false}
            onChange={(u) => set({ actor: u?.sub ?? '' })}
            onEnter={() => formRef.current?.requestSubmit()}
          />
          {/* Nút bật/tắt: bật thì lọc việc hệ thống tự làm, chọn một người thì nút tự tắt */}
          <button type="button" className="au-system" aria-pressed={system} onClick={() => set({ actor: system ? '' : SYSTEM_ACTOR })}>
            {t('audit.filters.system')}
          </button>
        </div>
        <div className="au-action-field">
          <Select label={t('audit.filters.action')} stacked value={draft.action} options={actionOptions} onChange={(v) => set({ action: v })} />
        </div>
        <div className="au-dates">
          <DateRangeField
            label={t('audit.filters.dates')}
            value={{ from: draft.from, to: draft.to }}
            error={dateError}
            onChange={(r) => {
              setRangeError(false);
              set(r);
            }}
          />
        </div>
        <div className="au-filter-actions">
          <button type="submit" className="btn btn--primary">
            {t('audit.filters.apply')}
          </button>
          <button type="button" className="btn btn--ghost" onClick={onClear}>
            {t('audit.filters.clear')}
          </button>
        </div>
      </div>
    </form>
  );
}
