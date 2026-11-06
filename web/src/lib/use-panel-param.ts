import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export type PanelName = 'item' | 'person' | 'request' | 'group' | 'line';

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
      for (const g of guards) g.selfClose = true;
      void navigate(-1);
    },
  };
}

// Panel tự đóng (đã hỏi hoặc vừa lưu/xóa xong) bằng lùi lịch sử: popstate đó không phải Back của người dùng.
// Cờ nằm ở từng chặn đang gắn: đóng khi không có chặn nào thì không còn cờ sót lại nuốt Back thật về sau.
const guards = new Set<{ selfClose: boolean }>();

// Chặn vòng lặp khi tiến lại về mục panel (Back nhiều lần trong lúc hộp hỏi đang mở)
const MAX_RESTORE_STEPS = 50;

// Chrome gọi trình nghe trên window theo thứ tự đăng ký (capture không được đi trước), và React 19 cập nhật đồng bộ
// trong popstate: nếu router nghe trước thì panel bị gỡ (kèm trình nghe của nó) trước khi kịp chặn. Vì vậy một trình
// nghe chung đăng ký lúc nạp module — trước khi BrowserRouter mount — rồi chuyển cho các chặn đang gắn.
type PopHandler = (e: PopStateEvent) => boolean;
const popHandlers = new Set<PopHandler>();
if (typeof window !== 'undefined') {
  window.addEventListener(
    'popstate',
    (e) => {
      for (const handle of [...popHandlers]) {
        if (handle(e)) {
          e.stopImmediatePropagation();
          return;
        }
      }
    },
    true,
  );
}

// BrowserRouter không có useBlocker: nghe popstate qua trình nghe chung (trước router) và giữ router đứng yên trong lúc hỏi.
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
    // Đang tiến lại từng bước về mục panel cũ: router chưa từng rời panel nên mọi bước đều giữ lại
    let restoring: { url: string; steps: number } | null = null;
    const me = { selfClose: false };
    guards.add(me);
    // true = giữ router đứng yên (đang hỏi / đang tiến lại về panel)
    const onPop: PopHandler = () => {
      if (restoring) {
        if (window.location.href === restoring.url || ++restoring.steps >= MAX_RESTORE_STEPS) restoring = null;
        else window.history.go(1);
        return true;
      }
      if (me.selfClose || pass) {
        me.selfClose = false;
        pass = false;
        return false;
      }
      if (!asking && !latest.current.dirty) return false;
      if (asking) return true;
      asking = true;
      const panelEntry = entry.current;
      const listUrl = window.location.href;
      void latest.current.ask().then((ok) => {
        asking = false;
        if (!ok) return stay(panelEntry, listUrl);
        pass = true;
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
      });
      return true;
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!latest.current.dirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    // "Ở lại": còn đứng ở mục danh sách → đẩy lại mục panel; Back thêm lần nữa trong lúc hỏi → đi tới đúng mục panel cũ
    // (mục danh sách và panel phía trước vẫn còn), không đẩy đè làm mất chúng
    const stay = (panelEntry: { state: unknown; url: string }, listUrl: string) => {
      const here = window.location.href;
      if (here === listUrl) return window.history.pushState(panelEntry.state, '', panelEntry.url);
      if (here === panelEntry.url) return;
      restoring = { url: panelEntry.url, steps: 0 };
      window.history.go(1);
    };
    popHandlers.add(onPop);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      guards.delete(me);
      popHandlers.delete(onPop);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);
}
