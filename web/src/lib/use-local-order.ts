import { useMemo, useState } from 'react';
import { moveItem, orderPatches, type Ordered } from './local-order';

interface Options<T> {
  server: T[];
  keyOf: (item: T) => string;
  sort: (a: T, b: T) => number;
  patchOrder: (key: string, sort_order: number) => Promise<unknown>;
  refresh: () => Promise<unknown>;
  onSaved: (changed: number) => void;
  onPartial: (done: number, total: number) => void;
}

// Đổi thứ tự chỉ ở máy cho tới khi lưu; giữ khóa để tên sửa tại chỗ vẫn lấy bản mới nhất
export function useLocalOrder<T extends Ordered>({ server, keyOf, sort, patchOrder, refresh, onSaved, onPartial }: Options<T>) {
  const [local, setLocal] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const serverOrder = useMemo(() => [...server].sort(sort), [server, sort]);
  const ordered = useMemo(() => {
    if (!local) return serverOrder;
    const byKey = new Map(server.map((x) => [keyOf(x), x]));
    const kept = local.flatMap((k) => byKey.get(k) ?? []);
    return [...kept, ...serverOrder.filter((x) => !local.includes(keyOf(x)))];
  }, [local, server, serverOrder, keyOf]);
  const moved = ordered.filter((x, i) => serverOrder[i] && keyOf(serverOrder[i]) !== keyOf(x)).length;

  const move = (index: number, dir: -1 | 1) => setLocal(moveItem(ordered, index, dir).map(keyOf));
  const revert = () => setLocal(null);

  const save = async () => {
    const patches = orderPatches(ordered, keyOf);
    const changed = moved;
    setSaving(true);
    let done = 0;
    try {
      for (const p of patches) {
        await patchOrder(p.key, p.sort_order);
        done += 1;
      }
      onSaved(changed);
    } catch {
      onPartial(done, patches.length);
    } finally {
      await refresh();
      setLocal(null);
      setSaving(false);
    }
  };

  return { ordered, moved, dirty: moved > 0, saving, move, revert, save };
}
