import { useTranslation } from 'react-i18next';
import { deliveryState, type DeliveryState, type HistoryItem } from './history.api';
import { Chip, type ChipTone } from './history-chip';

const TONE: Record<DeliveryState, ChipTone> = { done: 'ok', owed: 'warn', undelivered: 'warn', cancelled: 'muted', none: 'muted' };

type TagItem = Pick<HistoryItem, 'line_count' | 'catalog' | 'removed_all'>;

// "Còn chờ k món" đếm DÒNG món trong danh mục còn chờ (cùng luật số món); server đếm sẵn nên không tải phiếu từng tháng
export function DeliveryTag({ item }: { item: TagItem }) {
  const { t } = useTranslation();
  if (item.removed_all) return <Chip tone="muted">{t('request.history.delivery.removedAll')}</Chip>;
  const c = item.catalog;
  const state = deliveryState({ total_qty: c.qty, delivered_qty: c.delivered_qty, remaining_qty: c.remaining_qty });
  if (state === 'owed' || state === 'undelivered') {
    const k = c.owed_line_count;
    return <Chip tone="warn">{k > 0 ? t('request.history.delivery.owed', { count: k }) : t('request.history.delivery.waiting')}</Chip>;
  }
  // Chỉ có món ngoài danh mục (catalog trống) thì không có trạng thái giao; hết phiếu mới là "Không có phiếu"
  if (state === 'none' && item.line_count > 0) return null;
  return <Chip tone={TONE[state]}>{t(`request.history.delivery.${state}`)}</Chip>;
}
