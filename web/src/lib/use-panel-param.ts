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
    close: () => {
      if (!pushed) return go(cleared(), true, null);
      selfClose = true;
      void navigate(-1);
    },
  };
}

// Panel tự đóng (đã hỏi hoặc vừa lưu/xóa xong) bằng lùi lịch sử: popstate đó không phải Back của người dùng
let selfClose = false;

// BrowserRouter không có useBlocker: nghe popstate ở pha capture (trước router) và giữ router đứng yên trong lúc hỏi.
// Không đẩy lại lịch sử ngay trong popstate (Chrome coi là thao tác không do người dùng); "Ở lại" mới đẩy lại, sau cú bấm.
export function useDirtyBackGuard(dirty: boolean, ask: () => Promise<boolean>) {
  const latest = useRef({ dirty, ask });
  const entry = useRef({ state: null as unknown, url: '' });
  useEffect(() => {
    latest.current = { dirty, ask };
    entry.current = { state: window.history.state, url: window.location.href };
  });
  useEffect(() => {
    let pass = false;
    let asking = false;
    const onPop = (e: PopStateEvent) => {
      if (selfClose || pass) {
        selfClose = false;
        pass = false;
        return;
      }
      if (!asking && !latest.current.dirty) return;
      e.stopImmediatePropagation();
      if (asking) return;
      asking = true;
      const panelEntry = entry.current;
      void latest.current.ask().then((ok) => {
        asking = false;
        if (!ok) return window.history.pushState(panelEntry.state, '', panelEntry.url);
        pass = true;
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
      });
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!latest.current.dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('popstate', onPop, true);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('popstate', onPop, true);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);
}
