import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import type { ToastSpec } from '@/ui/toast-context';
import { patchItem, type AdminItem } from './catalog.api';
import { rowErrorText } from './catalog-errors';
import { usePendingArrivalNote } from './pending-arrival-note';

export interface ItemActiveArgs {
  item: Pick<AdminItem, 'id' | 'active'>;
  name: string;
  groupActive: boolean;
  refresh: () => Promise<unknown>;
  notify: (toast: ToastSpec) => void;
}

// Ngừng/dùng lại một món (công tắc panel nhóm, panel món, nút thẻ lưới): ghi ngay, cập nhật lạc quan,
// một request mỗi món (bấm lần hai khi đang gửi bị bỏ qua). Tắt món còn hàng ADM đang về thì hỏi trước
// (kèm khối cam W24); lỗi tải hàng đang về thì vẫn hỏi (hộp thường); không còn gì đang về thì tắt luôn.
// Nhóm đã ngừng → khóa (tắt), bật lại nhóm mới đổi được từng món.
export function useItemActive({ item, name, groupActive, refresh, notify }: ItemActiveArgs) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const confirm = useConfirm();
  const pendingNote = usePendingArrivalNote();
  const busy = useRef(false);
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const askStop = async () => {
    const { warning, unknown } = await pendingNote([{ id: item.id, name }], false);
    if (!warning && !unknown) return true;
    return confirm({ title: t('catalog.list.deactivateTitle', { name }), message: t('catalog.list.deactivateBody'), confirmLabel: t('catalog.bulk.pause'), danger: true, warning });
  };

  const send = async (active: boolean) => {
    if (busy.current || !groupActive) return;
    busy.current = true;
    setOptimistic(active);
    setError(null);
    try {
      if (!active && !(await askStop())) return;
      await patchItem(item.id, { active }, csrfToken);
      await refresh();
      if (!active) {
        notify({ text: t('catalog.categories.itemOff', { name }), tone: 'ok', action: { label: t('catalog.categories.undo'), onClick: () => void send(true) } });
      }
    } catch (e) {
      setError(rowErrorText(e, t));
    } finally {
      setOptimistic(null);
      busy.current = false;
    }
  };

  const checked = groupActive && (optimistic ?? item.active);
  const reason: 'byGroup' | 'byItem' | null = groupActive ? null : item.active ? 'byGroup' : 'byItem';
  return { checked, locked: !groupActive, reason, error, send };
}
