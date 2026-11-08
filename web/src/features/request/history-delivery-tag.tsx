import { useTranslation } from 'react-i18next';
import { deliveryState, type DeliveryState, type HistoryItem } from './history.api';
import { Chip, type ChipTone } from './history-chip';

const TONE: Record<DeliveryState, ChipTone> = { done: 'ok', owed: 'warn', undelivered: 'warn', cancelled: 'muted', none: 'muted' };

type TagItem = Pick<HistoryItem, 'line_count' | 'total_qty' | 'delivered_qty' | 'remaining_qty' | 'owed_line_count' | 'removed_all'>;

// "Còn chờ k món" đếm DÒNG còn chờ; server đếm sẵn nên không tải phiếu từng tháng
export function DeliveryTag({ item }: { item: TagItem }) {
  const { t } = useTranslation();
  if (item.removed_all) return <Chip tone="muted">{t('request.history.delivery.removedAll')}</Chip>;
  const state = deliveryState(item);
  if (state === 'owed' || state === 'undelivered') {
    const k = item.owed_line_count;
    return <Chip tone="warn">{k > 0 ? t('request.history.delivery.owed', { k }) : t('request.history.delivery.waiting')}</Chip>;
  }
  // Chỉ có món chờ/từ chối (total 0) thì không có trạng thái giao; hết phiếu mới là "Không có phiếu"
  if (state === 'none' && item.line_count > 0) return null;
  return <Chip tone={TONE[state]}>{t(`request.history.delivery.${state}`)}</Chip>;
}
