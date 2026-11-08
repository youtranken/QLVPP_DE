import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useBacklog } from '@/features/delivery/backlog.api';
import { useLeftPeople } from '@/features/summary/summary.api';

// Người đã nghỉ: phần chưa nhận của kỳ giao giảm ở đây, nợ tháng trước hủy ở Còn nợ (lý do chọn sẵn ở cả hai)
export function MonthLeftReminder({ ym }: { ym: string }) {
  const { t } = useTranslation();
  const left = useLeftPeople(ym, true);
  const backlog = useBacklog('person');
  const inPeriod = left.data?.items ?? [];
  const debtors = (backlog.data?.groups ?? []).flatMap((g) => g.lines.slice(0, 1)).filter((l) => l.user_status !== 'active');
  const names = new Map<string, string>();
  for (const p of inPeriod) names.set(p.user_sub, p.full_name ?? p.email ?? p.user_sub);
  for (const l of debtors) if (!names.has(l.user_sub)) names.set(l.user_sub, l.full_name ?? l.user_sub);
  if (names.size === 0) return null;
  return (
    <div className="alert alert--warn mk-left">
      <span>{t('warn.W25', { n: names.size, names: [...names.values()].join(', ') })}</span>
      {inPeriod.length > 0 && (
        <Link className="btn btn--sm" to={`/admin/month?ym=${ym}&left=1`}>
          {t('month.left.action')}
        </Link>
      )}
      {debtors.length > 0 && (
        <Link className="btn btn--sm" to="/admin/backlog?left=1">
          {t('month.left.debt')}
        </Link>
      )}
    </div>
  );
}
