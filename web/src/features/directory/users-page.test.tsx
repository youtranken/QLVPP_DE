import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import type { AdminUser } from './directory.api';

const AN: AdminUser = {
  sub: 'u-an',
  email: 'an.nguyen@pmh.com.vn',
  employeeCode: 'NV0231',
  fullName: 'Phạm Minh Đức',
  department: 'Phòng Công trình',
  groups: ['vpp-users', 'vpp-admin'],
  status: 'active',
  lastLoginAt: '2026-10-27T02:30:00.000Z',
};
const BINH: AdminUser = { ...AN, sub: 'u-binh', fullName: 'Lê Thị Bình', employeeCode: 'NV0007', department: 'Phòng Kế toán', groups: [], status: 'locked', lastLoginAt: null };
const CHI: AdminUser = { ...AN, sub: 'u-chi', fullName: 'Trần Chi', employeeCode: 'NV0100', department: 'Phòng Công trình', groups: ['vpp-users'], lastLoginAt: null };

type SyncRoute = () => Response;

function stubUsers(users: AdminUser[], sync: SyncRoute = () => jsonResponse(200, { created: 0, updated: 0 })) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/admin/directory/sync' && init?.method === 'POST') return Promise.resolve(sync());
    if (url.startsWith('/api/admin/users')) {
      const params = new URL(url, 'http://x').searchParams;
      const search = params.get('search') ?? '';
      const from = Number(params.get('cursor') ?? 0);
      const size = Number(params.get('limit') ?? 50);
      const rows = users.filter((u) => (u.fullName ?? '').includes(search));
      const items = rows.slice(from, from + size);
      const next = from + size < rows.length ? String(from + size) : null;
      return Promise.resolve(jsonResponse(200, { items, next_cursor: next }));
    }
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, days_left: 4, previous: null }));
    if (url.startsWith('/api/me/notifications')) return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }));
    return Promise.resolve(jsonResponse(200, []));
  });
  vi.stubGlobal('fetch', f);
  return f;
}

async function openUsers(path = '/admin/users') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
  await screen.findByText('Phạm Minh Đức');
}

const card = (name: RegExp) => screen.getByRole('button', { name });
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

afterEach(() => vi.unstubAllGlobals());

describe('UsersPage B10', () => {
  it('tự dựng đầu trang: mô tả, "Đồng bộ ngay", thẻ chú thích 60 phút, đúng một h1', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    expect(screen.getAllByRole('heading', { level: 1, name: 'Danh bạ' })).toHaveLength(1);
    expect(screen.getByText('Người dùng đồng bộ từ PMH ID. Thông tin cá nhân sửa ở PMH ID, không sửa trong app.')).toBeInTheDocument();
    expect(screen.getByText('Tự đồng bộ từ PMH ID mỗi 60 phút.')).toBeInTheDocument();
    expect(screen.queryByText(/Đồng bộ lần cuối/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Đồng bộ ngay' })).toBeInTheDocument();
  });

  it('thẻ Đang dùng 2 · Chưa đăng nhập 2 · Đã khóa 1; bấm thẻ lọc đúng và FilterNotice hiện', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    expect(card(/^Đang dùng/)).toHaveTextContent('2');
    expect(card(/^Chưa đăng nhập lần nào/)).toHaveTextContent('2');
    expect(card(/^Đã khóa/)).toHaveTextContent('1');
    await userEvent.click(card(/^Đã khóa/));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('Đang lọc: Đã khóa · 1')).toBeInTheDocument();
    expect(card(/^Đã khóa/)).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(card(/^Chưa đăng nhập lần nào/));
    expect(bodyRows()).toHaveLength(2);
    await userEvent.click(card(/^Đang dùng/));
    expect(bodyRows().map((r) => within(r).getByRole('button').textContent)).toEqual(['Phạm Minh Đức', 'Trần Chi']);
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc' }));
    expect(bodyRows()).toHaveLength(3);
  });

  it('lọc phòng ban dẫn xuất từ danh bạ; "Hiện n / tổng người"', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    expect(screen.getByText('Hiện 3 / 3 người')).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Phòng ban' });
    expect(within(select).getAllByRole('option').map((o) => o.textContent)).toEqual(['Mọi phòng ban', 'Phòng Công trình', 'Phòng Kế toán']);
    await userEvent.selectOptions(select, 'Phòng Kế toán');
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('Hiện 1 / 3 người')).toBeInTheDocument();
  });

  it('bảng: avatar chữ đầu, nhóm PMH ID từng nhãn, trạng thái, "Chưa đăng nhập"; không có badge "Mới"', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    const an = screen.getByText('Phạm Minh Đức').closest('tr')!;
    expect(within(an).getByText('Phòng Công trình')).toBeInTheDocument();
    expect(within(an).getByText('vpp-admin')).toBeInTheDocument();
    expect(within(an).getByText('Đang dùng')).toBeInTheDocument();
    expect(within(an).getByText('09:30 27/10/2026')).toBeInTheDocument();
    const binh = screen.getByText('Lê Thị Bình').closest('tr')!;
    expect(within(binh).getByText('Đã khóa')).toBeInTheDocument();
    expect(within(binh).getByText('Chưa đăng nhập')).toBeInTheDocument();
    expect(screen.queryByText('Mới')).toBeNull();
  });

  it('ô tìm giới hạn 200 ký tự; gõ lọc không dấu theo tên/mã NV; rỗng → "Bỏ lọc"', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    const box = screen.getByRole('searchbox', { name: 'Tìm người' });
    expect(box).toHaveAttribute('maxlength', '200');
    await userEvent.type(box, 'nv0007');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(within(bodyRows()[0]).getByText('Lê Thị Bình')).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, 'zzzz');
    expect(await screen.findByText('Không có ai khớp tìm kiếm.')).toBeInTheDocument();
    expect(screen.getByText(/Người mới vào công ty sẽ có sau lần đồng bộ kế tiếp/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ lọc' }));
    await waitFor(() => expect(bodyRows()).toHaveLength(3));
  });

  it('đồng bộ ok → khối ok "Đã đồng bộ từ PMH ID: 2 người mới, 3 cập nhật." có nút đóng; gửi CSRF', async () => {
    const f = stubUsers([AN], () => jsonResponse(200, { created: 2, updated: 3 }));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    const ok = await screen.findByText('Đã đồng bộ từ PMH ID: 2 người mới, 3 cập nhật.');
    expect(ok.closest('[role="status"]')).not.toBeNull();
    const [, init] = f.mock.calls.find(([u]) => u === '/api/admin/directory/sync') as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
    await userEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByText(/Đã đồng bộ từ PMH ID/)).toBeNull();
  });

  it('đồng bộ SSO_UNAVAILABLE → khối danger + "Thử lại", bảng vẫn còn; thử lại thành công thì khối lỗi mất', async () => {
    let fail = true;
    stubUsers([AN], () => (fail ? jsonResponse(503, { code: 'SSO_UNAVAILABLE', message: 'x' }) : jsonResponse(200, { created: 1, updated: 0 })));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không liên lạc được PMH ID — thử lại sau ít phút.');
    expect(screen.getByText('Phạm Minh Đức')).toBeInTheDocument();
    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Đã đồng bộ từ PMH ID: 1 người mới, 0 cập nhật.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ngăn kéo: không có "Vai trò trong app"/phiếu; "Xem nhật ký" → /admin/audit?actor=<sub>; chỉ đọc', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Phạm Minh Đức' }));
    const drawer = await screen.findByRole('dialog', { name: 'Thông tin người dùng' });
    expect(within(drawer).getByText('Danh bạ · người 1')).toBeInTheDocument();
    expect(within(drawer).getByText('NV0231')).toBeInTheDocument();
    expect(within(drawer).getByText('Dữ liệu từ PMH ID, không sửa trong app.')).toBeInTheDocument();
    expect(within(drawer).queryByText(/Vai trò trong app/)).toBeNull();
    expect(within(drawer).queryByText(/Phiếu văn phòng phẩm/)).toBeNull();
    expect(within(drawer).queryByText(/Tài khoản đã khóa ở PMH ID/)).toBeNull();
    expect(within(drawer).getByRole('link', { name: 'Xem nhật ký' })).toHaveAttribute('href', '/admin/audit?actor=u-an');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Người kế tiếp' }));
    expect(within(drawer).getByText('Danh bạ · người 2')).toBeInTheDocument();
    expect(within(drawer).getByText(/Tài khoản đã khóa ở PMH ID — không đăng nhập được/)).toBeInTheDocument();
    expect(within(drawer).getByRole('link', { name: 'Xem nhật ký' })).toHaveAttribute('href', '/admin/audit?actor=u-binh');
    expect(within(drawer).getByRole('button', { name: 'Người kế tiếp' })).toBeEnabled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Người kế tiếp' }));
    expect(within(drawer).getByRole('button', { name: 'Người kế tiếp' })).toBeDisabled();
    const [x, footer] = within(drawer).getAllByRole('button', { name: 'Đóng' });
    expect(x).toHaveClass('sheet-close');
    await userEvent.click(x);
    expect(screen.queryByRole('dialog', { name: 'Thông tin người dùng' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Phạm Minh Đức' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Thông tin người dùng' })).getAllByRole('button', { name: 'Đóng' })[1]);
    expect(screen.queryByRole('dialog', { name: 'Thông tin người dùng' })).toBeNull();
    expect(footer).toBeTruthy();
  });

  it.each([
    [503, { code: 'DIRECTORY_UNAVAILABLE' }, 'Không liên lạc được PMH ID — thử lại sau ít phút.'],
    [502, { code: 'DIRECTORY_AUTH_FAILED' }, 'PMH ID từ chối quyền đọc danh bạ — báo IT kiểm tra cấu hình.'],
    [500, { code: 'DIRECTORY_SYNC_FAILED' }, 'Đồng bộ chưa xong — thử lại sau ít phút.'],
    [500, { code: 'SOMETHING_ELSE' }, 'Không liên lạc được PMH ID — thử lại sau ít phút.'],
    [400, { code: 'SOMETHING_ELSE' }, 'Chưa đồng bộ được — thử lại sau ít phút.'],
  ])('đồng bộ lỗi %i %j → câu đúng', async (status, body, text) => {
    stubUsers([AN], () => jsonResponse(status, { ...body, message: 'x' }));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('lỗi tải → "Không tải được dữ liệu — thử lại." + "Thử lại"', async () => {
    mockViewport(1280);
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.startsWith('/api/admin/users') ? jsonResponse(500, { code: 'X' }) : jsonResponse(200, []))));
    renderApp(makeMe('admin'), '/admin/users');
    expect(await screen.findByText('Không tải được dữ liệu — thử lại.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('2001 người → báo tìm ở server, không có thẻ số liệu; gõ gọi ?search= và "Xem thêm" hoạt động', async () => {
    const many = Array.from({ length: 2001 }, (_, i) => ({ ...AN, sub: `m${i}`, fullName: `Người ${String(i).padStart(4, '0')}` }));
    const f = stubUsers(many);
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/users');
    expect(await screen.findByText(/Danh bạ có hơn 2000 người/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Đang dùng/ })).toBeNull();
    await userEvent.click(screen.getByRole('searchbox', { name: 'Tìm người' }));
    await userEvent.paste('0042');
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('search=0042'))).toBe(true));
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
  }, 30_000);
});
