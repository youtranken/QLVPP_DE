import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DateRangeField, type RangePreset } from '@/ui/date-range-field';
import { Select } from '@/ui/select';
import type { DirectoryUser } from '@/features/directory/directory.api';
import { useDirectoryNames } from '@/features/directory/use-all-users';
import { UserPicker } from '@/features/directory/user-picker';
import type { AuditFilters } from './admin.api';
import { AUDIT_ACTIONS, auditActionLabel } from './audit-actions';
import { dateRangeInvalid, quickRanges } from './audit-quick-ranges';

const SYSTEM_ACTOR = 'system';

interface Props {
  applied: AuditFilters;
  serverError: { from: boolean; to: boolean };
  onPatch: (p: Partial<AuditFilters>) => void;
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

// Lọc ngay khi đổi ô như mọi màn khác: người chọn từ gợi ý, hành động, khoảng ngày đều ghi thẳng lên URL
export function AuditFilterBar({ applied, serverError, onPatch, onClear }: Props) {
  const { t, i18n } = useTranslation();
  const system = applied.actor === SYSTEM_ACTOR;
  const actor = useActorUser(system ? '' : applied.actor);
  const dateError = dateRangeInvalid(applied.from, applied.to) ? t('audit.filters.rangeInvalid') : serverError.from || serverError.to ? t('audit.filters.dateInvalid') : undefined;
  const known = AUDIT_ACTIONS.includes(applied.action);
  const actionOptions = [
    { value: '', label: t('audit.filters.anyAction') },
    ...(applied.action !== '' && !known ? [{ value: applied.action, label: applied.action }] : []),
    ...AUDIT_ACTIONS.map((a) => ({ value: a, label: auditActionLabel(t, a) })),
  ];
  const presets = useRangePresets();

  return (
    <form className="au-filters" lang={i18n.language} aria-label={t('audit.filters.label')} onSubmit={(e) => e.preventDefault()} noValidate>
      <div className="au-filters__grid">
        <div className="au-actor">
          <UserPicker
            label={t('audit.filters.actor')}
            searchLabel={t('audit.filters.actorSearch')}
            placeholder={t('audit.filters.actorHint')}
            value={actor}
            allowLocked
            resultsWhenEmpty={false}
            onChange={(u) => onPatch({ actor: u?.sub ?? '' })}
          />
          <button type="button" className="au-system" aria-pressed={system} onClick={() => onPatch({ actor: system ? '' : SYSTEM_ACTOR })}>
            {t('audit.filters.systemOnly')}
          </button>
        </div>
        <div className="au-action-field">
          <Select label={t('audit.filters.action')} stacked value={applied.action} options={actionOptions} onChange={(v) => onPatch({ action: v })} />
        </div>
        <div className="au-dates">
          <DateRangeField label={t('audit.filters.dates')} value={{ from: applied.from, to: applied.to }} error={dateError} presets={presets} onChange={(r) => onPatch(r)} />
        </div>
        <div className="au-filter-actions">
          <button type="button" className="btn btn--ghost" onClick={onClear}>
            {t('audit.filters.clear')}
          </button>
        </div>
      </div>
    </form>
  );
}

function useRangePresets(): RangePreset[] {
  const { t } = useTranslation();
  const r = quickRanges(new Date());
  return [
    { label: t('audit.quick.today'), range: r.today },
    { label: t('audit.quick.week'), range: r.week },
    { label: t('audit.quick.month', { month: r.month.month, year: r.month.year }), range: { from: r.month.from, to: r.month.to } },
  ];
}
