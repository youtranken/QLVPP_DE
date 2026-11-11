import { useTranslation } from 'react-i18next';
import { pendingNamesText } from '@/lib/pending-names';
import { useConfirm } from '@/ui/confirm-context';
import { useRequestFormat } from '@/features/request/request-format';
import type { DeliveryPersonLine } from './delivery-people.api';

// Giao khi còn món ngoài danh mục chưa duyệt: hỏi lại (nêu tên món sẽ bị ghi Không mua) rồi mới gửi; không có món chờ thì gửi luôn
export function useAskThenSubmit(pending: DeliveryPersonLine[], title: string, submit: () => void): () => void {
  const { t } = useTranslation();
  const fmt = useRequestFormat();
  const confirm = useConfirm();
  return () => {
    if (pending.length === 0) return submit();
    void confirm({
      title,
      message: t('warn.W8deliver', { names: pendingNamesText(pending.map((l) => fmt.name(l)), t) }),
      confirmLabel: t('delivery.confirm.ok'),
      cancelLabel: t('delivery.confirm.abort'),
      caution: true,
    }).then((ok) => ok && submit());
  };
}
