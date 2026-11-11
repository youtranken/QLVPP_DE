import { useTranslation } from 'react-i18next';
import { lockedYm, shiftYm } from '@/lib/ym';
import { Segmented } from '@/ui/segmented';
import { Icon } from '@/ui/icon';

interface Props {
  ym: string;
  openYm: string;
  // Kỳ cũ nhất có phiếu (null: chưa có kỳ nào; undefined: chưa tải)
  earliestYm?: string | null;
  onChange: (ym: string) => void;
}

const monthOf = (ym: string) => Number(ym.slice(5, 7));

export function PeriodSwitch({ ym, openYm, earliestYm, onChange }: Props) {
  const { t } = useTranslation();
  const locked = lockedYm(openYm);
  const options = [
    { value: locked, label: t('month.period.locked', { month: monthOf(locked) }) },
    { value: openYm, label: t('month.period.open', { month: monthOf(openYm) }) },
    ...(ym < locked ? [{ value: ym, label: t('month.period.older', { month: monthOf(ym), year: ym.slice(0, 4) }) }] : []),
  ];
  const earlier = shiftYm(ym > locked ? locked : ym, -1);
  const atStart = earliestYm !== undefined && (earliestYm === null || earlier < earliestYm);
  return (
    <div className="mk-switch">
      <button
        type="button"
        className="btn btn--ghost btn--sm mk-prev"
        disabled={atStart}
        aria-label={t('month.period.previousLabel', { month: monthOf(earlier), year: earlier.slice(0, 4) })}
        onClick={() => onChange(earlier)}
      >
        <Icon name="chevl" size={16} />
        {t('month.period.previous')}
      </button>
      <Segmented label={t('month.period.label')} value={ym} options={options} onChange={onChange} />
    </div>
  );
}
