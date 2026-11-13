import { createElement, lazy, type ComponentType } from 'react';
import { ChunkLoadError, renewLater } from '@/lib/chunk-load-error';
import { isAdminRole, type Role } from '@/lib/me';

type Chunk<M> = { preload: () => Promise<M>; page: <K extends keyof M>(name: K) => M[K] };

export function routeChunk<M>(load: () => Promise<M>): Chunk<M> {
  let loaded: M | undefined;
  let pending: Promise<M> | undefined;
  const preload = () => {
    pending ??= load().then(
      (mod) => (loaded = mod),
      (err: unknown) => {
        // Lần sau (vd chuyển trang) thử nạp lại thay vì giữ mãi lời từ chối
        pending = undefined;
        throw new ChunkLoadError(err);
      },
    );
    return pending;
  };
  // Đã nạp (thường xong trong lúc kiểm phiên): thenable trả ngay để React.lazy vẽ luôn trang, không chớp khung chờ.
  // React.lazy nhớ mãi lời từ chối → nạp hỏng thì hẹn thay bằng lazy mới khi chuyển trang (quay lại thì nạp lại thật).
  const page = <K extends keyof M>(name: K) => {
    const pick = (mod: M) => ({ default: mod[name] as ComponentType });
    const make = () =>
      lazy(() => {
        if (loaded) {
          const mod = loaded;
          return { then: (resolve: (m: { default: ComponentType }) => void) => resolve(pick(mod)) } as unknown as Promise<{ default: ComponentType }>;
        }
        return preload().then(pick, (err: unknown) => {
          renewLater(() => (current = make()));
          throw err;
        });
      });
    let current = make();
    return function RoutePage() {
      return createElement(current);
    } as M[K];
  };
  return { preload, page };
}

export const adminChunk = routeChunk(() => import('@/shell/admin-pages'));
export const memberChunk = routeChunk(() => import('@/shell/member-pages'));
export const printChunk = routeChunk(() => import('@/shell/print-pages'));

const PRINT_PATH = /^\/admin\/reports\/snapshots\/[^/]+\/print\/?$/;

// Chunk của màn sắp vẽ: nạp song song với /api/auth/me để trang hiện cùng lúc với khung, không thêm một vòng chờ
export function preloadRouteChunk(role: Role | null, pathname: string): Promise<unknown> {
  const admin = role ? isAdminRole(role) : pathname.startsWith('/admin');
  const target = !admin ? memberChunk : PRINT_PATH.test(pathname) ? printChunk : adminChunk;
  return target.preload();
}

// Gợi ý vai của lần đăng nhập trước trên máy này (localStorage, sống qua tab mới) để nạp chunk sớm lúc boot.
// Chỉ là gợi ý tốc độ: sai hay thiếu thì chỉ nạp thừa/nạp muộn, quyền vẫn theo /api/auth/me.
const ROLE_HINT_KEY = 'vpp.boot.role';

export function rememberRoleHint(role: Role): void {
  try {
    window.localStorage.setItem(ROLE_HINT_KEY, isAdminRole(role) ? 'admin' : 'member');
  } catch {
    // storage bị chặn → boot không nạp sớm, vẫn nạp sau khi biết vai
  }
}

export function roleHint(): Role | null {
  try {
    const v = window.localStorage.getItem(ROLE_HINT_KEY);
    return v === 'admin' || v === 'member' ? v : null;
  } catch {
    return null;
  }
}

// Nạp sớm lúc boot (song song với kiểm phiên): chỉ khi máy này từng đăng nhập — khách lạ ở '/' (màn đăng nhập)
// không tải chunk Nhân viên, Hành chính vào '/' không tải nhầm chunk Nhân viên
export function preloadHintedChunk(pathname: string): Promise<unknown> | null {
  const hint = roleHint();
  return hint ? preloadRouteChunk(hint, pathname) : null;
}
