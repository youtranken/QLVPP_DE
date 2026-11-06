import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type PanelName = 'item' | 'person' | 'request' | 'group';

interface Options {
  // Thứ tự mục đang hiện trên trang: ↑/↓ đi theo danh sách này
  order?: readonly string[];
  // false = mục không tồn tại/sai dạng → gỡ tham số; undefined = dữ liệu chưa tải xong
  known?: (id: string) => boolean | undefined;
  // Tham số đi kèm panel (vd nhóm chọn sẵn khi thêm món), gỡ cùng khi đóng/chuyển mục
  extra?: readonly string[];
}

const NONE: readonly string[] = [];

export function usePanelParam(name: PanelName, { order = NONE, known, extra = NONE }: Options = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const id = params.get(name);
  const pushed = (location.state as { panel?: string } | null)?.panel === name;
  const index = id === null ? -1 : order.indexOf(id);
  const unknown = id !== null && known?.(id) === false;

  const go = (patch: Record<string, string | null>, replace: boolean, state: unknown) => {
    const next = new URLSearchParams(location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    const search = next.toString();
    void navigate({ pathname: location.pathname, search: search ? `?${search}` : '' }, { replace, state });
  };
  const cleared = () => Object.fromEntries([name, ...extra].map((k) => [k, null]));

  const dropUnknown = useRef(() => {});
  useEffect(() => {
    dropUnknown.current = () => go(cleared(), true, null);
  });
  useEffect(() => {
    if (unknown) dropUnknown.current();
  }, [unknown]);

  return {
    id: unknown ? null : id,
    index,
    total: order.length,
    canStep: (dir: 1 | -1) => index >= 0 && index + dir >= 0 && index + dir < order.length,
    open: (next: string, more: Record<string, string | null> = {}) => go({ ...cleared(), [name]: next, ...more }, false, { panel: name }),
    step: (dir: 1 | -1) => {
      const target = index >= 0 ? order[index + dir] : undefined;
      if (target !== undefined) go({ ...cleared(), [name]: target }, true, location.state);
    },
    // Mở bằng đẩy lịch sử thì đóng = lùi lại, để Back sau đó không mở lại panel
    close: () => (pushed ? void navigate(-1) : go(cleared(), true, null)),
  };
}

// BrowserRouter không có useBlocker: nghe popstate ở pha capture (trước router), đẩy lại mục của panel rồi hỏi
export function useDirtyBackGuard(dirty: boolean, ask: () => Promise<boolean>) {
  const latest = useRef({ dirty, ask });
  const entry = useRef({ state: null as unknown, url: '' });
  useEffect(() => {
    latest.current = { dirty, ask };
    entry.current = { state: window.history.state, url: window.location.href };
  });
  useEffect(() => {
    let bypass = false;
    const onPop = (e: PopStateEvent) => {
      if (bypass || !latest.current.dirty) {
        bypass = false;
        return;
      }
      e.stopImmediatePropagation();
      window.history.pushState(entry.current.state, '', entry.current.url);
      void latest.current.ask().then((ok) => {
        if (!ok) return;
        bypass = true;
        window.history.back();
      });
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (latest.current.dirty) e.preventDefault();
    };
    window.addEventListener('popstate', onPop, true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('popstate', onPop, true);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);
}
