import { useTranslation } from 'react-i18next';
import { shiftYm } from '@/lib/ym';
import { MonthSwitcher } from '@/ui/month-switcher';
import { Segmented } from '@/ui/segmented';

const MONTHS_BACK = 12;

type Scope = 'all' | 'month';

export function ReviewPeriod({ ym, openYm, onChange }: { ym: string; openYm: string | undefined; onChange: (ym: string) => void }) {
  const { t } = useTranslation();
  const scope: Scope = ym ? 'month' : 'all';
  // Kỳ hiện tại chưa tải/lỗi mà URL đã có ?ym= thì vẫn cho xem tháng đó, trần tạm là chính nó
  const ceiling = openYm ?? (ym || undefined);
  const options = [
    { value: 'all' as Scope, label: t('review.allPeriods') },
    { value: 'month' as Scope, label: t('review.byMonth') },
  ];
  return (
    <>
      <Segmented
        label={t('review.period')}
        value={scope}
        options={ceiling ? options : options.slice(0, 1)}
        onChange={(s) => onChange(s === 'month' && ceiling ? ceiling : '')}
      />
      {ym && ceiling && (
        <MonthSwitcher
          value={ym}
          min={shiftYm(ceiling, 1 - MONTHS_BACK)}
          max={ceiling}
          onChange={onChange}
          formatLabel={(v) => t('review.month', { month: Number(v.slice(5)), year: v.slice(0, 4) })}
          labels={{ group: t('review.monthNav'), prev: t('review.prevMonth'), next: t('review.nextMonth') }}
        />
      )}
    </>
  );
}
