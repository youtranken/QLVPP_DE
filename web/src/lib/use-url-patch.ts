import { useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export type UrlPatch = Record<string, string | null>;

// setSearchParams dạng hàm đọc params của lần render trước: hai cập nhật liền nhau (debounce ô tìm + bấm thẻ) làm mất một khóa.
// Giữ bản mới nhất trong ref, đặt lại khi URL đổi từ ngoài (Back, liên kết).
export function useUrlPatch() {
  const [params, setParams] = useSearchParams();
  const latest = useRef(params);
  const seen = useRef(params);
  if (seen.current !== params) {
    seen.current = params;
    latest.current = params;
  }
  const update = useCallback(
    (patch: UrlPatch, replace = false) => {
      const next = new URLSearchParams(latest.current);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) next.delete(k);
        else next.set(k, v);
      }
      latest.current = next;
      setParams(next, { replace });
    },
    [setParams],
  );
  return [params, update] as const;
}
