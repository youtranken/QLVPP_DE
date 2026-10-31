import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMe } from '@/lib/me';
import { useToast } from '@/ui/toast-context';
import { moveUnit, orderPatches, sortUnits } from './unit-order';
import { patchUnit, useRefreshUnits, type AdminUnit } from './units.api';

// Đổi thứ tự chỉ ở máy cho tới khi "Lưu thứ tự"; giữ mã để tên sửa tại chỗ vẫn lấy bản mới nhất
export function useUnitOrder(server: AdminUnit[]) {
  const { t } = useTranslation();
  const { csrfToken } = useMe();
  const toast = useToast();
  const refresh = useRefreshUnits();
  const [local, setLocal] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const serverOrder = useMemo(() => sortUnits(server), [server]);
  const ordered = useMemo(() => {
    if (!local) return serverOrder;
    const byCode = new Map(server.map((u) => [u.code, u]));
    const kept = local.flatMap((code) => byCode.get(code) ?? []);
    return [...kept, ...serverOrder.filter((u) => !local.includes(u.code))];
  }, [local, server, serverOrder]);
  const moved = ordered.filter((u, i) => serverOrder[i]?.code !== u.code).length;

  const move = (index: number, dir: -1 | 1) => setLocal(moveUnit(ordered, index, dir).map((u) => u.code));
  const revert = () => setLocal(null);

  const save = async () => {
    const patches = orderPatches(ordered);
    const changed = moved;
    setSaving(true);
    let done = 0;
    try {
      for (const p of patches) {
        await patchUnit(p.code, { sort_order: p.sort_order }, csrfToken);
        done += 1;
      }
      toast.show({ text: t('units.page.orderSaved', { n: changed }), tone: 'ok' });
    } catch {
      toast.show({ text: t('units.page.orderPartial', { a: done, n: patches.length }), tone: 'warn' });
    } finally {
      await refresh();
      setLocal(null);
      setSaving(false);
    }
  };

  return { ordered, moved, dirty: moved > 0, saving, move, revert, save };
}
