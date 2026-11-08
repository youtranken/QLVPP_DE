import { useTranslation } from 'react-i18next';
import { lockedYm, shiftYm } from '@/lib/ym';
import { Segmented } from '@/ui/segmented';

interface Props {
  ym: string;
  openYm: string;
  onChange: (ym: string) => void;
}

const monthOf = (ym: string) => Number(ym.slice(5, 7));

export function PeriodSwitch({ ym, openYm, onChange }: Props) {
  const { t } = useTranslation();
  const locked = lockedYm(openYm);
  const options = [
    { value: locked, label: t('month.period.locked', { month: monthOf(locked) }) },
    { value: openYm, label: t('month.period.open', { month: monthOf(openYm) }) },
    ...(ym < locked ? [{ value: ym, label: t('month.period.older', { month: monthOf(ym), year: ym.slice(0, 4) }) }] : []),
  ];
  const earlier = shiftYm(ym > locked ? locked : ym, -1);
  return (
    <div className="mk-switch">
      <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(earlier)}>
        <span aria-hidden="true">‹ </span>
        {t('month.period.previous')}
      </button>
      <Segmented label={t('month.period.label')} value={ym} options={options} onChange={onChange} />
    </div>
  );
}
