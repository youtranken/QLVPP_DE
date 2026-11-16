import { useTranslation } from 'react-i18next';
import { useConfirm } from '@/ui/confirm-context';
import { useRequestFormat } from '@/features/request/request-format';
import type { ArrivalRow } from './arrival-rows';

const LISTED = 6;

// Nhận hàng và "NCC hết hàng" ghi kho ngay: hỏi một lần, liệt kê số sẽ nhập (như hộp Giao hàng)
export function useArrivalsConfirm() {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const confirm = useConfirm();
  const receive = (lines: { row: ArrivalRow; qty: number }[]) => {
    const listed = lines.slice(0, LISTED).map(({ row, qty }) => `${fmt.name(row)}: ${qty} ${fmt.unit(row.unit)}`);
    const rest = lines.length - listed.length;
    return confirm({
      title: t('arrivals.confirm.title', { count: lines.length }),
      message: [...listed, ...(rest > 0 ? [t('arrivals.confirm.more', { n: rest })] : [])].join(' · '),
      confirmLabel: t('arrivals.confirm.ok'),
      cancelLabel: t('common.cancel'),
    });
  };
  const admOut = (name: string) =>
    confirm({
      title: t('arrivals.confirm.admTitle', { name }),
      message: t('arrivals.confirm.admBody'),
      confirmLabel: t('arrivals.confirm.admOk'),
      cancelLabel: t('common.cancel'),
      caution: true,
    });
  return { receive, admOut };
}
