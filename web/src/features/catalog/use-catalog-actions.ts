import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { useToast } from '@/ui/toast-context';
import { patchItem } from './catalog.api';
import { rowErrorText } from './catalog-errors';
import { usePendingArrivalNote } from './pending-arrival-note';
import type { CatalogRow } from './catalog-rows';

export function useCatalogActions(refresh: () => Promise<unknown>, setRowError: (id: string, text: string | null) => void) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const confirm = useConfirm();
  const toast = useToast();
  const pendingNote = usePendingArrivalNote();

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

  const toggleActive = useCallback(
    async (row: CatalogRow) => {
      if (row.active) {
        const ok = await confirm({
          title: t('catalog.list.deactivateTitle', { name: row.name }),
          message: t('catalog.list.deactivateBody'),
          confirmLabel: t('catalog.bulk.deactivate'),
          danger: true,
          warning: await pendingNote([{ id: row.id, name: row.name }], false),
        });
        if (!ok) return;
      }
      try {
        await patchItem(row.id, { active: !row.active }, csrfToken);
        setRowError(row.id, null);
        toast.show({ text: t(row.active ? 'catalog.list.deactivated' : 'catalog.list.reactivated', { name: row.name }), tone: 'ok' });
        await refresh();
      } catch (e) {
        setRowError(row.id, rowErrorText(e, t));
      }
    },
    [confirm, csrfToken, pendingNote, refresh, setRowError, t, toast],
  );

  const confirmDeactivateMany = (n: number) =>
    confirm({
      title: t('catalog.bulk.deactivateTitle', { n }),
      message: t('catalog.bulk.deactivateBody'),
      confirmLabel: t('catalog.bulk.deactivate'),
      danger: true,
    });

  return { saveMax, toggleActive, confirmDeactivateMany };
}
