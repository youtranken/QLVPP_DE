import { useTranslation } from 'react-i18next';
import { useToast } from '@/ui/toast-context';
import { useUnregistered } from '@/features/summary/summary.api';

// Người chưa đặt không có dòng trong bảng — chỉ đếm ở bước "Đã đặt" và chép tên để nhắc
export function MonthUnregisteredCopy({ ym }: { ym: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const query = useUnregistered(ym);
  const names = (query.data?.items ?? []).map((u) => u.full_name ?? u.email ?? u.sub);
  if (names.length === 0) return null;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(names.join('\n'));
      toast.show({ text: t('month.unreg.copied', { count: names.length }), tone: 'ok' });
    } catch {
      toast.show({ text: t('month.unreg.failed'), tone: 'danger' });
    }
  };
  return (
    <div className="mk-unreg">
      <button type="button" className="btn btn--sm" onClick={() => void copy()}>
        {t('month.unreg.copy', { count: names.length })}
      </button>
    </div>
  );
}
