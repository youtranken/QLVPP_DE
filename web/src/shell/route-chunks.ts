import { lazy, type ComponentType } from 'react';
import { ChunkLoadError } from '@/lib/chunk-load-error';
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
  // Đã nạp (thường xong trong lúc kiểm phiên): thenable trả ngay để React.lazy vẽ luôn trang, không chớp khung chờ
  const page = <K extends keyof M>(name: K) =>
    lazy(() => {
      const pick = (mod: M) => ({ default: mod[name] as ComponentType });
      if (loaded) {
        const mod = loaded;
        return { then: (resolve: (m: { default: ComponentType }) => void) => resolve(pick(mod)) } as unknown as Promise<{ default: ComponentType }>;
      }
      return preload().then(pick);
    }) as M[K];
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
