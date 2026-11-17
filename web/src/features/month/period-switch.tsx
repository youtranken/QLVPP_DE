import { useTranslation } from 'react-i18next';
import { lockedYm } from '@/lib/ym';
import { MonthSwitcher } from '@/ui/month-switcher';
import type { MonthMark, MonthTone } from '@/ui/month-picker';
import { periodFloor } from './use-month-params';

interface Props {
  ym: string;
  openYm: string;
  // Kỳ cũ nhất có phiếu (null: chưa có kỳ nào; undefined: chưa tải)
  earliestYm?: string | null;
  onChange: (ym: string) => void;
}

const monthOf = (ym: string) => Number(ym.slice(5, 7));
const TAG: Record<MonthTone, string> = { locked: 'tag tag--brand', open: 'tag tag--warn', past: 'tag' };

// Cùng kiểu ‹ Tháng 12/2026 › với Báo cáo; chip cho biết tháng đang xem ở bước nào
export function PeriodSwitch({ ym, openYm, earliestYm, onChange }: Props) {
  const { t } = useTranslation();
  const locked = lockedYm(openYm);
  const floor = periodFloor(openYm, earliestYm);
  const toneOf = (v: string): MonthTone => (v === openYm ? 'open' : v === locked ? 'locked' : 'past');
  const markOf = (v: string): MonthMark | undefined => (v > openYm || (floor !== undefined && v < floor) ? undefined : { tone: toneOf(v), label: t(`month.period.status.${toneOf(v)}`) });
  const tone = toneOf(ym);
  return (
    <div className="mk-switch">
      <MonthSwitcher
        value={ym}
        min={floor}
        max={openYm}
        onChange={onChange}
        markOf={markOf}
        formatLabel={(v) => t('month.period.month', { month: monthOf(v), year: v.slice(0, 4) })}
        labels={{ group: t('month.period.label'), prev: t('month.period.prev'), next: t('month.period.next') }}
      />
      <span className={`mk-switch__status ${TAG[tone]}`}>{t(`month.period.status.${tone}`)}</span>
    </div>
  );
}
