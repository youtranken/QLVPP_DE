import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { useToast } from '@/ui/toast-context';
import { patchItem } from './catalog.api';
import { usePendingArrivalNote } from './pending-arrival-note';
import type { CatalogRow } from './catalog-rows';

export function useCatalogActions(refresh: () => Promise<unknown>, setRowError: (id: string, text: string | null) => void) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();

  // Lỗi ném lại để InlineNumber giữ ô mở và gắn câu lỗi vào đúng ô
  const saveMax = useCallback(
    async (row: CatalogRow, n: number) => {
      await patchItem(row.id, { max_qty: n }, csrfToken);
      setRowError(row.id, null);
      toast.show({ text: t('catalog.list.maxSaved', { n, name: row.name }), tone: 'ok' });
      await refresh();
    },
    [csrfToken, refresh, setRowError, t, toast],
  );

  const confirmDeactivateMany = useConfirmDeactivateMany();

  return { saveMax, confirmDeactivateMany };
}

// Ngừng hàng loạt chỉ hỏi khi có món còn hàng ADM đang về (khối cam ghi tên từng món) hoặc không tải được để biết
function useConfirmDeactivateMany() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const pendingNote = usePendingArrivalNote();
  return async (items: { id: string; name: string }[]) => {
    const { warning, unknown } = await pendingNote(items, true);
    if (!warning && !unknown) return true;
    return confirm({
      title: t('catalog.bulk.deactivateTitle', { n: items.length }),
      message: t('catalog.bulk.deactivateBody'),
      confirmLabel: t('catalog.bulk.pause'),
      danger: true,
      warning,
    });
  };
}
