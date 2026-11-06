import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useConfirm } from '@/ui/confirm-context';
import { useToast, type ToastSpec } from '@/ui/toast-context';
import { categoryLabel, patchCategory, type AdminItem, type Category } from './catalog.api';
import { catalogErrorKey } from './catalog-errors';
import { usePendingArrivalNote } from './pending-arrival-note';

// Ngừng nhóm hỏi xác nhận (số món đang dùng + khối hàng đang về); bật lại không hỏi, báo số món dùng lại / vẫn ngừng riêng
export function useGroupToggle(items: AdminItem[] | undefined, refresh: () => Promise<unknown>) {
  const { t, i18n } = useTranslation();
  const { csrfToken } = useMe();
  const confirm = useConfirm();
  const toast = useToast();
  const pendingNote = usePendingArrivalNote();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askDeactivate = async (c: Category) => {
    const inUse = (items ?? []).filter((i) => i.category_id === c.id && i.active);
    const warning = await pendingNote(inUse.map((i) => ({ id: i.id, name: categoryLabel(i, i18n.language) })), true);
    return confirm({
      title: t('catalog.categories.deactivateTitle', { name: categoryLabel(c, i18n.language) }),
      message: t('catalog.categories.deactivateBody', { n: inUse.length }),
      confirmLabel: t('catalog.categories.deactivate'),
      danger: true,
      warning,
    });
  };

  // notify: panel nhóm đưa toast vào trong panel (toast chung bị ẩn khỏi trình đọc màn hình khi hộp mở)
  const toggle = async (c: Category, notify: (t: ToastSpec) => void = toast.show) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (c.active && !(await askDeactivate(c))) return;
      const saved = await patchCategory(c.id, { active: !c.active }, csrfToken);
      const back = saved?.affected_items;
      notify({
        text: back ? t('catalog.categories.reactivated', { k: back.reactivated, m: back.still_inactive }) : t('catalog.categories.saved', { name: saved?.name ?? c.name }),
        tone: 'ok',
      });
      await refresh();
    } catch (e) {
      setError(t(catalogErrorKey(e)));
    } finally {
      setBusy(false);
    }
  };

  return { busy, error, toggle };
}
