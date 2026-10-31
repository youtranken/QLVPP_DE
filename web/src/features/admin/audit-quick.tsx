import { useTranslation } from 'react-i18next';
import type { AuditFilters } from './admin.api';
import { quickRanges } from './audit-quick-ranges';

const DENIED_ACTION = 'auth.login_denied_group';

export function AuditQuick({ now, applied, onPatch }: { now: Date; applied: AuditFilters; onPatch: (p: Partial<AuditFilters>) => void }) {
  const { t } = useTranslation();
  const r = quickRanges(now);
  const chips: { label: string; patch: Partial<AuditFilters>; pressed: boolean }[] = [
    { label: t('audit.quick.today'), patch: r.today, pressed: applied.from === r.today.from && applied.to === r.today.to },
    { label: t('audit.quick.week'), patch: r.week, pressed: applied.from === r.week.from && applied.to === r.week.to },
    { label: t('audit.quick.month', { month: r.month.month, year: r.month.year }), patch: r.month, pressed: applied.from === r.month.from && applied.to === r.month.to },
    { label: t('audit.quick.denied'), patch: { action: DENIED_ACTION }, pressed: applied.action === DENIED_ACTION },
  ];
  return (
    <div className="au-quick" role="group" aria-label={t('audit.quick.label')}>
      <span className="au-muted">{t('audit.quick.label')}</span>
      {chips.map((c) => (
        <button key={c.label} type="button" className="au-chip" aria-pressed={c.pressed} onClick={() => onPatch(c.patch)}>
          {c.label}
        </button>
      ))}
    </div>
  );
}
