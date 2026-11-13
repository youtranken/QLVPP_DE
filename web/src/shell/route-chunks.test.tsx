import { Component, useLayoutEffect, type ReactNode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { RouteChunk } from '@/ui/chunk-error-boundary';
import { adminChunk, memberChunk, preloadRouteChunk, printChunk, routeChunk } from './route-chunks';

function Page() {
  return <h1>Trang thật</h1>;
}

let fallbackCommits = 0;
function Waiting() {
  useLayoutEffect(() => {
    fallbackCommits++;
  });
  return <p>Đang chờ chunk</p>;
}

class Outer extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    return this.state.error ? <p>Lỗi ngoài: {this.state.error}</p> : this.props.children;
  }
}

afterEach(() => vi.restoreAllMocks());

describe('routeChunk — nạp lười theo nhóm route', () => {
  it('chunk đã nạp xong (lúc kiểm phiên) → trang vẽ ngay, không chớp khung chờ', async () => {
    fallbackCommits = 0;
    const c = routeChunk(() => Promise.resolve({ Page }));
    await c.preload();
    const Lazy = c.page('Page');
    renderWithI18n(
      <RouteChunk loading={<Waiting />}>
        <Lazy />
      </RouteChunk>,
    );
    expect(screen.getByRole('heading', { name: 'Trang thật' })).toBeInTheDocument();
    expect(fallbackCommits).toBe(0);
  });

  it('chưa nạp → khung chờ của màn, rồi trang', async () => {
    let done!: (m: { Page: typeof Page }) => void;
    const c = routeChunk(() => new Promise<{ Page: typeof Page }>((r) => (done = r)));
    const Lazy = c.page('Page');
    renderWithI18n(
      <RouteChunk loading={<Waiting />}>
        <Lazy />
      </RouteChunk>,
    );
    expect(screen.getByText('Đang chờ chunk')).toBeInTheDocument();
    await act(async () => done({ Page }));
    expect(await screen.findByRole('heading', { name: 'Trang thật' })).toBeInTheDocument();
  });

  it('chunk 404 sau deploy (index.html cũ) → câu "vừa cập nhật" + nút Tải lại trang, không trắng màn', async () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = routeChunk<{ Page: typeof Page }>(() =>
      Promise.reject(new TypeError('Failed to fetch dynamically imported module: /static/admin-pages-OLD.js')),
    );
    const Lazy = c.page('Page');
    renderWithI18n(
      <RouteChunk loading={<Waiting />}>
        <Lazy />
      </RouteChunk>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Ứng dụng vừa được cập nhật');
    await userEvent.click(screen.getByRole('button', { name: 'Tải lại trang' }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('frame: câu báo nằm trong khung của màn (nhân viên: panel sáng; trang in: còn thanh Quay lại)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const c = routeChunk<{ Page: typeof Page }>(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
    const Lazy = c.page('Page');
    renderWithI18n(
      <RouteChunk loading={<Waiting />} frame={(n) => <section data-testid="khung">{n}</section>}>
        <Lazy />
      </RouteChunk>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Ứng dụng vừa được cập nhật');
    expect(screen.getByRole('alert').closest('[data-testid="khung"]')).not.toBeNull();
  });

  it('lỗi code khác trong trang → không giấu dưới câu "vừa cập nhật", ném tiếp lên trên như trước', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    function Broken(): ReactNode {
      throw new Error('bug thật');
    }
    renderWithI18n(
      <Outer>
        <RouteChunk loading={<Waiting />}>
          <Broken />
        </RouteChunk>
      </Outer>,
    );
    expect(screen.getByText('Lỗi ngoài: bug thật')).toBeInTheDocument();
    expect(screen.queryByText(/vừa được cập nhật/)).toBeNull();
  });

  it('nạp hỏng một lần rồi lần sau thử lại (không giữ mãi lời từ chối)', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('mạng rớt')).mockResolvedValueOnce({ Page });
    const c = routeChunk(load);
    await expect(c.preload()).rejects.toThrow('chunk load failed');
    await expect(c.preload()).resolves.toEqual({ Page });
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe('preloadRouteChunk — chunk theo vai và đường dẫn', () => {
  it.each([
    ['member', '/', memberChunk],
    ['member', '/history/2026-10', memberChunk],
    ['admin', '/admin/month', adminChunk],
    ['sa', '/', adminChunk],
    ['admin', '/admin/reports/snapshots/1d2c/print', printChunk],
    [null, '/admin/stock', adminChunk],
    [null, '/me', memberChunk],
  ] as const)('%s ở %s', async (role, path, target) => {
    const spies = [adminChunk, memberChunk, printChunk].map((c) => vi.spyOn(c, 'preload').mockResolvedValue({} as never));
    await preloadRouteChunk(role, path);
    for (const [i, c] of [adminChunk, memberChunk, printChunk].entries()) {
      expect(spies[i]).toHaveBeenCalledTimes(c === target ? 1 : 0);
    }
  });
});

describe('app-routes — màn chỉ đi qua chunk lười', () => {
  it('không import tĩnh trang nào của features (nếu có, cả nhóm bị kéo về chunk chính)', () => {
    const src = readFileSync(resolve(__dirname, 'app-routes.tsx'), 'utf8');
    const pages = [...src.matchAll(/from '(@\/features\/[^']+)'/g)].map((m) => m[1]);
    expect(pages).toEqual(['@/features/reports/print-toolbar']);
  });
});
