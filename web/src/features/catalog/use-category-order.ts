import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useToast } from '@/ui/toast-context';
import { patchCategory, useRefreshCatalog, type Category } from './catalog.api';
import { moveCategory, orderPatches, sortCategories } from './category-order';

// Đổi thứ tự chỉ ở máy cho tới khi "Lưu thứ tự"; giữ id để tên sửa tại chỗ vẫn lấy bản mới nhất
export function useCategoryOrder(server: Category[]) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  const refresh = useRefreshCatalog();
  const [local, setLocal] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const serverOrder = useMemo(() => sortCategories(server), [server]);
  const ordered = useMemo(() => {
    if (!local) return serverOrder;
    const byId = new Map(server.map((c) => [c.id, c]));
    const kept = local.flatMap((id) => byId.get(id) ?? []);
    return [...kept, ...serverOrder.filter((c) => !local.includes(c.id))];
  }, [local, server, serverOrder]);
  const moved = ordered.filter((c, i) => serverOrder[i]?.id !== c.id).length;

  const move = (index: number, dir: -1 | 1) => setLocal(moveCategory(ordered, index, dir).map((c) => c.id));
  const revert = () => setLocal(null);

  const save = async () => {
    const patches = orderPatches(ordered);
    setSaving(true);
    let done = 0;
    try {
      for (const p of patches) {
        await patchCategory(p.id, { sort_order: p.sort_order }, csrfToken);
        done += 1;
      }
      toast.show({ text: t('catalog.categories.orderSaved', { n: patches.length }), tone: 'ok' });
    } catch {
      toast.show({ text: t('catalog.categories.orderPartial', { a: done, n: patches.length }), tone: 'warn' });
    } finally {
      await refresh();
      setLocal(null);
      setSaving(false);
    }
  };

  return { ordered, moved, dirty: moved > 0, saving, move, revert, save };
}
