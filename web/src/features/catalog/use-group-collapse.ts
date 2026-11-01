import { useMemo, useState } from 'react';

export const OPEN_GROUPS_KEY = 'vpp.catalog.openGroups';
const NONE: ReadonlySet<string> = new Set();

function readOpen(): ReadonlySet<string> {
  try {
    const raw = JSON.parse(sessionStorage.getItem(OPEN_GROUPS_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? new Set(raw.filter((k): k is string => typeof k === 'string')) : NONE;
  } catch {
    return NONE;
  }
}

function writeOpen(open: ReadonlySet<string>) {
  try {
    sessionStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify([...open]));
  } catch {
    // trình duyệt chặn lưu: vẫn đóng/mở được trong lần xem này
  }
}

// Nhóm không có trong danh sách hiện tại (vd đang ẩn món ngừng) giữ nguyên trạng thái đã nhớ
export function mergeOpen(open: ReadonlySet<string>, groupKeys: string[], collapsed: ReadonlySet<string>): Set<string> {
  const shown = new Set(groupKeys);
  return new Set([...[...open].filter((k) => !shown.has(k)), ...groupKeys.filter((k) => !collapsed.has(k))]);
}

// Mặc định thu gọn mọi nhóm; đang tìm/lọc thì mở hết nhóm có kết quả, thu/mở lúc đó chỉ giữ tới khi đổi lọc
export function useGroupCollapse(groupKeys: string[], narrowKey: string | null) {
  const [open, setOpen] = useState(readOpen);
  const [narrowed, setNarrowed] = useState<{ key: string; collapsed: ReadonlySet<string> } | null>(null);
  const collapsed = useMemo<ReadonlySet<string>>(() => {
    if (narrowKey !== null) return narrowed?.key === narrowKey ? narrowed.collapsed : NONE;
    return new Set(groupKeys.filter((k) => !open.has(k)));
  }, [groupKeys, narrowKey, narrowed, open]);

  const setCollapsed = (next: ReadonlySet<string>) => {
    if (narrowKey !== null) return setNarrowed({ key: narrowKey, collapsed: next });
    const merged = mergeOpen(open, groupKeys, next);
    setOpen(merged);
    writeOpen(merged);
  };
  return { collapsed, setCollapsed };
}
