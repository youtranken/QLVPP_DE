import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import { SNAPSHOT_ID } from '@/features/reports/reports-fixtures';

// Lỗi tải và đang tải: màn nào cũng giữ đầu trang (tiêu đề không cụt), chỉ vùng nội dung đổi sang spinner/lỗi có nút Thử lại
afterEach(() => vi.unstubAllGlobals());

const never = () => new Promise<Response>(() => {});
const failCurrent = () => stubShellApi({ '/api/periods/current': () => jsonResponse(500, null) });
const hangCurrent = () => {
  const f = stubShellApi();
  const base = f.getMockImplementation()!;
  f.mockImplementation((url: string, init?: RequestInit) => (url === '/api/periods/current' ? never() : base(url, init)));
  return f;
};
const open = (path: string, width = 1280) => {
  mockViewport(width);
  renderApp(makeMe('admin'), path);
};
const h1 = () => screen.findByRole('heading', { level: 1 });

const SCREENS = [
  { name: 'Kỳ tháng', path: '/admin/month', title: 'Kỳ tháng' },
  { name: 'Kỳ tháng có ?ym=', path: '/admin/month?ym=2026-10', title: 'Kỳ tháng 10' },
  { name: 'Nhận hàng', path: '/admin/arrivals', title: 'Nhận hàng' },
  { name: 'Giao hàng', path: '/admin/delivery', title: 'Giao hàng' },
];

describe('Đầu trang khi lỗi tải kỳ hiện tại', () => {
  for (const s of SCREENS) {
    it(`${s.name}: h1 "${s.title}" + Thử lại trong vùng nội dung`, async () => {
      failCurrent();
      open(s.path);
      expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
      expect((await h1()).textContent).toBe(s.title);
      expect((await h1()).textContent).not.toMatch(/kỳ tháng$/);
    });
  }
});

describe('Đầu trang khi đang tải kỳ hiện tại', () => {
  for (const s of SCREENS) {
    it(`${s.name}: h1 "${s.title}" + Đang tải`, async () => {
      hangCurrent();
      open(s.path, 390);
      expect(await screen.findByRole('status', { busy: true })).toBeInTheDocument();
      expect((await h1()).textContent).toBe(s.title);
    });
  }
});

describe('Trang in bản chốt: lỗi và đang tải vẫn giữ thanh công cụ', () => {
  const path = `/admin/reports/snapshots/${SNAPSHOT_ID}/print`;
  const stubSnap = (reply: () => Promise<Response>) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => (url === `/api/admin/reports/snapshots/${SNAPSHOT_ID}` ? reply() : jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }))),
    );

  it('lỗi 500: thanh công cụ (Quay lại, In bị khóa) + Thử lại', async () => {
    stubSnap(async () => jsonResponse(500, null));
    open(path);
    expect(await screen.findByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
    const bar = screen.getByRole('toolbar', { name: 'Thanh công cụ bản in (không in ra giấy)' });
    expect(bar).toHaveTextContent('Quay lại');
    expect(screen.getByRole('button', { name: 'In' })).toBeDisabled();
    expect(screen.getByRole('link', { name: /Quay lại/ })).toHaveAttribute('href', '/admin/reports');
  });

  it('đang tải: thanh công cụ + Đang tải', async () => {
    stubSnap(never);
    open(path, 390);
    expect(await screen.findByRole('status', { busy: true })).toBeInTheDocument();
    expect(screen.getByRole('toolbar', { name: 'Thanh công cụ bản in (không in ra giấy)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'In' })).toBeDisabled();
  });
});
