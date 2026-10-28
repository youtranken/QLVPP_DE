import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';

const AN = {
  sub: 'u-an',
  email: 'an.nguyen@pmh.com.vn',
  employeeCode: 'NV0231',
  fullName: 'Phạm Minh Đức',
  department: 'Phòng Công trình',
  groups: ['vpp-users', 'vpp-admin'],
  status: 'active',
  lastLoginAt: '2026-10-27T02:30:00.000Z',
};
const BINH = { ...AN, sub: 'u-binh', fullName: 'Lê Thị Bình', employeeCode: 'NV0007', groups: [], status: 'locked', lastLoginAt: null };

function stubApi(sync: () => Response) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/admin/directory/sync' && init?.method === 'POST') return Promise.resolve(sync());
    if (url.startsWith('/api/admin/users')) {
      const search = new URL(url, 'http://x').searchParams.get('search') ?? '';
      const items = [AN, BINH].filter((u) => u.fullName.includes(search));
      return Promise.resolve(jsonResponse(200, { items, next_cursor: null }));
    }
    return Promise.resolve(jsonResponse(404, null));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function openUsers() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/users');
  return (await screen.findByText('Phạm Minh Đức')).closest('tr')!;
}

describe('UsersPage', () => {
  it('hiện phòng ban, nhóm, trạng thái và lần đăng nhập cuối; người bị khóa có nhãn "Đã khóa"', async () => {
    stubApi(() => jsonResponse(200, {}));
    const an = await openUsers();
    expect(within(an).getByText('Phòng Công trình')).toBeInTheDocument();
    expect(within(an).getByText('vpp-admin')).toBeInTheDocument();
    expect(within(an).getByText('Đang dùng')).toBeInTheDocument();
    expect(within(an).getByText('09:30 27/10/26')).toBeInTheDocument();
    const binh = screen.getByText('Lê Thị Bình').closest('tr')!;
    expect(within(binh).getByText('Đã khóa')).toBeInTheDocument();
    expect(within(binh).getByText('Chưa đăng nhập')).toBeInTheDocument();
  });

  it('gõ tìm → gọi /api/admin/users?search=… và chỉ còn người khớp', async () => {
    const fetchMock = stubApi(() => jsonResponse(200, {}));
    await openUsers();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm theo tên, email hoặc mã NV' }), 'Bình');
    await vi.waitFor(() => {
      expect(screen.queryByText('Phạm Minh Đức')).toBeNull();
      expect(screen.getByText('Lê Thị Bình')).toBeInTheDocument();
    });
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('search=B%C3%ACnh'))).toBe(true);
  });

  it('"Đồng bộ ngay" → báo số người mới và cập nhật', async () => {
    const fetchMock = stubApi(() => jsonResponse(200, { total: 9, created: 2, updated: 3, unchanged: 4, skipped: 0, groups: [] }));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    expect(await screen.findByText('Đã đồng bộ từ PMH ID: 2 người mới, 3 cập nhật.')).toHaveAttribute('role', 'status');
    const [, init] = fetchMock.mock.calls.find(([u]) => u === '/api/admin/directory/sync') as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
  });

  it('đồng bộ lỗi SSO_UNAVAILABLE → hiện lỗi, bảng vẫn còn', async () => {
    stubApi(() => jsonResponse(503, { code: 'SSO_UNAVAILABLE', message: 'Không liên lạc được PMH ID' }));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không liên lạc được PMH ID — thử lại sau ít phút.');
    expect(screen.getByText('Phạm Minh Đức')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Đồng bộ ngay' })).toBeEnabled();
  });
});
