import { useCallback, useLayoutEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export type UrlPatch = Record<string, string | null>;

// Ô tìm (useUrlSearchBox) cần biết khi ai khác ghi khóa của nó ("Xóa lọc" đặt q về rỗng trong lúc chữ vừa gõ còn chờ
// debounce): q trên URL vẫn rỗng → không đổi giá trị, ô không có cách nào khác để biết mà bỏ chữ đang chờ
type WriteListener = (patch: UrlPatch) => void;
const writeListeners = new Set<WriteListener>();
export function onUrlPatch(listener: WriteListener): () => void {
  writeListeners.add(listener);
  return () => {
    writeListeners.delete(listener);
  };
}

// setSearchParams dạng hàm đọc params của lần render trước: hai cập nhật liền nhau (debounce ô tìm + bấm thẻ) làm mất một khóa.
// Giữ bản mới nhất trong ref, đặt lại khi URL đổi từ ngoài (Back, liên kết) — ở layout effect (chỉ lần render đã commit,
// vẫn trước mọi sự kiện người dùng)
export function useUrlPatch() {
  const [params, setParams] = useSearchParams();
  const latest = useRef(params);
  useLayoutEffect(() => {
    latest.current = params;
  }, [params]);
  const update = useCallback(
    (patch: UrlPatch, replace = false) => {
      const next = new URLSearchParams(latest.current);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      latest.current = next;
      setParams(next, { replace });
      for (const listener of [...writeListeners]) listener(patch);
    },
    [setParams],
  );
  return [params, update] as const;
}
