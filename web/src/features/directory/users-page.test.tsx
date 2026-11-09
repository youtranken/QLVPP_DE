import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
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
  team: 'QS',
  role: 'admin',
  status: 'active',
  lastLoginAt: '2026-10-27T02:30:00.000Z',
};
const BINH: AdminUser = { ...AN, sub: 'u-binh', fullName: 'Lê Thị Bình', employeeCode: 'NV0007', department: 'Phòng Kế toán', team: null, role: 'member', status: 'locked', lastLoginAt: null };
const CHI: AdminUser = { ...AN, sub: 'u-chi', fullName: 'Trần Chi', employeeCode: 'NV0100', department: 'Phòng Công trình', team: null, role: 'member', lastLoginAt: null };
const DUNG: AdminUser = { ...CHI, sub: 'u-dung', fullName: 'Vũ Dũng', employeeCode: 'NV0300', team: 'QS', status: 'no_access' };

type SyncRoute = () => Response;
type RegRoute = () => Response;

const REG_URL = '/api/admin/periods/2026-11/unregistered';
const regOf = (unregistered: AdminUser[], registered: string[]) => () =>
  jsonResponse(200, { items: unregistered.map((u) => ({ sub: u.sub, full_name: u.fullName, email: u.email, department: u.department })), registered_subs: registered });

type SyncStatus = { last_at: string | null; last_total: number | null; last_error: { at: string; code: string; message: string } | null };
const NEVER: SyncStatus = { last_at: null, last_total: null, last_error: null };

function stubUsers(
  users: AdminUser[],
  sync: SyncRoute = () => jsonResponse(200, { created: 0, updated: 0, no_access: 0, reconcile: 'ok' }),
  reg: RegRoute = regOf([CHI], ['u-an']),
  status: () => SyncStatus = () => NEVER,
) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/admin/directory/status') return Promise.resolve(jsonResponse(200, status()));
    if (url === REG_URL) return Promise.resolve(reg());
    if (url === '/api/admin/directory/sync' && init?.method === 'POST') return Promise.resolve(sync());
    if (url.startsWith('/api/admin/users')) {
      const params = new URL(url, 'http://x').searchParams;
      const search = params.get('search') ?? '';
      const from = Number(params.get('cursor') ?? 0);
      const size = Number(params.get('limit') ?? 50);
      const wantDeleted = params.get('status') === 'deleted';
      const rows = users.filter((u) => (u.status === 'deleted') === wantDeleted && (u.fullName ?? '').includes(search));
      const items = rows.slice(from, from + size);
      const next = from + size < rows.length ? String(from + size) : null;
      return Promise.resolve(jsonResponse(200, { items, next_cursor: next }));
    }
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, { ym: '2026-11', deadline: '2026-11-10T17:00:00.000Z', is_open: true, days_left: 4, previous: null, owed: [] }));
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

const DEL: AdminUser = { ...CHI, sub: 'u-del', fullName: 'Hà Đã Xoá', employeeCode: 'NV0999', status: 'deleted' };
const OK_AT = '2026-11-09T07:05:00.000Z'; // 14:05 giờ VN
const ERR_AT = '2026-11-09T08:05:00.000Z'; // 15:05 giờ VN

describe('UsersPage B10', () => {
  it('tự dựng đầu trang: mô tả, "Đồng bộ ngay" kèm dòng trạng thái đồng bộ đứng ngay trước nhóm thao tác (không nằm trong nhóm); cài đặt không thành ô số liệu; đúng một h1', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    expect(screen.getAllByRole('heading', { level: 1, name: 'Danh bạ' })).toHaveLength(1);
    expect(screen.getByText('Người dùng đồng bộ từ PMH ID. Thông tin cá nhân sửa ở PMH ID, không sửa trong app.')).toBeInTheDocument();
    expect(screen.queryByText('Đồng bộ tự động')).toBeNull();
    const actions = screen.getByRole('group', { name: 'Thao tác trang' });
    expect(screen.queryByText('Tự động mỗi 60 phút')).toBeNull();
    expect(within(actions).getByRole('button', { name: 'Đồng bộ ngay' })).toBeInTheDocument();
    expect((await screen.findByText('Chưa đồng bộ danh bạ PMH ID')).nextElementSibling).toBe(actions);
    expect(screen.queryByText(/Đồng bộ lần cuối/)).toBeNull();
  });

  it('thẻ Đang dùng 2 · Chưa đăng ký kỳ 11 · Đã khóa 1; bấm thẻ lọc đúng và FilterNotice hiện', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    expect(card(/^Đang dùng/)).toHaveTextContent('2');
    expect(await screen.findByRole('button', { name: /^Chưa đăng ký kỳ 11/ })).toHaveTextContent('1');
    expect(screen.queryByRole('button', { name: /^Chưa đăng nhập lần nào/ })).toBeNull();
    expect(card(/^Đã khóa/)).toHaveTextContent('1');
    await userEvent.click(card(/^Đã khóa/));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('Đang lọc: Đã khóa · 1')).toBeInTheDocument();
    expect(card(/^Đã khóa/)).toHaveAttribute('aria-pressed', 'true');
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

  it('bảng: avatar chữ đầu, cột Nhóm, tag Hành chính, trạng thái, "Chưa đăng nhập"; không có badge "Mới"', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    const an = screen.getByText('Phạm Minh Đức').closest('tr')!;
    expect(within(an).getByText('Phòng Công trình')).toBeInTheDocument();
    expect(within(an).getByText('QS')).toBeInTheDocument();
    expect(within(an).getByText('Hành chính')).toBeInTheDocument();
    expect(within(an).getByText('Đang dùng')).toBeInTheDocument();
    expect(within(an).getByText('09:30 27/10/2026')).toBeInTheDocument();
    const binh = screen.getByText('Lê Thị Bình').closest('tr')!;
    expect(within(binh).getByText('Đã khóa')).toBeInTheDocument();
    expect(within(binh).queryByText('Hành chính')).toBeNull();
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

  it('cột Nhóm: team "QS" hiện QS; team null hiện —', async () => {
    stubUsers([AN, CHI]);
    await openUsers();
    const cells = (name: string) => within(screen.getByText(name).closest('tr')!).getAllByRole('cell');
    const col = within(screen.getByRole('table')).getAllByRole('columnheader').findIndex((h) => h.textContent === 'Nhóm');
    expect(col).toBeGreaterThan(-1);
    expect(cells('Phạm Minh Đức')[col]).toHaveTextContent('QS');
    expect(cells('Trần Chi')[col]).toHaveTextContent('—');
  });

  it('người role admin có tag Hành chính, người member thì không', async () => {
    stubUsers([AN, CHI]);
    await openUsers();
    expect(within(screen.getByText('Phạm Minh Đức').closest('tr')!).getByText('Hành chính')).toBeInTheDocument();
    expect(within(screen.getByText('Trần Chi').closest('tr')!).queryByText('Hành chính')).toBeNull();
  });

  it('lọc Mất quyền chỉ còn người no_access, đếm đúng ở thống kê; no_access không tính vào Đang dùng', async () => {
    stubUsers([AN, BINH, CHI, DUNG]);
    await openUsers();
    expect(card(/^Mất quyền/)).toHaveTextContent('1');
    expect(card(/^Đang dùng/)).toHaveTextContent('2');
    await userEvent.click(card(/^Mất quyền/));
    expect(bodyRows().map((r) => within(r).getByRole('button').textContent)).toEqual(['Vũ Dũng']);
    expect(within(bodyRows()[0]).getByText('Mất quyền')).toBeInTheDocument();
    expect(screen.getByText('Đang lọc: Mất quyền · 1')).toBeInTheDocument();
  });

  it('lọc phòng + tìm theo tên vẫn đúng khi team null; tìm theo team khớp', async () => {
    stubUsers([AN, BINH, CHI, DUNG]);
    await openUsers();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Phòng ban' }), 'Phòng Công trình');
    expect(bodyRows()).toHaveLength(3);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người' }), 'Chi');
    await waitFor(() => expect(bodyRows().map((r) => within(r).getByRole('button').textContent)).toEqual(['Trần Chi']));
  });

  it('mở người no_access → cảnh báo PMH ID đã thu hồi quyền; người active thì không', async () => {
    stubUsers([AN, DUNG]);
    await openUsers('/admin/users?person=u-dung');
    const drawer = await screen.findByRole('dialog', { name: 'Người dùng' });
    expect(within(drawer).getByText(/PMH ID đã thu hồi quyền vào VPP của người này/)).toBeInTheDocument();
    expect(within(drawer).getByText('Nhóm')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Người trước' }));
    expect(within(await screen.findByRole('dialog', { name: 'Người dùng' })).queryByText(/PMH ID đã thu hồi quyền/)).toBeNull();
  });

  it('kết quả đồng bộ no_access 2 → dòng "2 người không còn quyền vào VPP."; reconcile ok thì không có cảnh báo', async () => {
    stubUsers([AN], () => jsonResponse(200, { created: 0, updated: 1, no_access: 2, reconcile: 'ok' }));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    const notice = (await screen.findByText(/2 người không còn quyền vào VPP\./)).closest('[role="status"]')!;
    expect(notice).toHaveTextContent('Đã đồng bộ từ PMH ID: 0 người mới, 1 cập nhật.');
    expect(notice).not.toHaveTextContent('Chưa đối chiếu được');
  });

  it('no_access 0 → không có dòng không còn quyền; reconcile aborted → cảnh báo chưa đối chiếu được', async () => {
    stubUsers([AN], () => jsonResponse(200, { created: 0, updated: 0, no_access: 0, reconcile: 'aborted' }));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    const notice = (await screen.findByText(/Chưa đối chiếu được người vắng khỏi danh bạ PMH ID/)).closest('[role="status"]')!;
    expect(notice).not.toHaveTextContent('không còn quyền vào VPP');
  });

  it('đồng bộ ok → khối ok "Đã đồng bộ từ PMH ID: 2 người mới, 3 cập nhật." có nút đóng; gửi CSRF', async () => {
    const f = stubUsers([AN], () => jsonResponse(200, { created: 2, updated: 3, no_access: 0, reconcile: 'ok' }));
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

  it('panel phủ ?person=: không có "Vai trò trong app"/phiếu; "Xem nhật ký" → /admin/audit?actor=<sub>; chỉ đọc; bộ đếm, ↑/↓, đóng bỏ tham số', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Phạm Minh Đức' }));
    const drawer = await screen.findByRole('dialog', { name: 'Người dùng' });
    expect(screen.getByTestId('location-search')).toHaveTextContent('person=u-an');
    expect(within(drawer).getByText('1/3')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Người trước' })).toBeDisabled();
    expect(within(drawer).getByText('NV0231')).toBeInTheDocument();
    expect(within(drawer).getByText('Dữ liệu từ PMH ID, không sửa trong app.')).toBeInTheDocument();
    expect(within(drawer).queryByText(/Vai trò trong app/)).toBeNull();
    expect(within(drawer).queryByText(/Phiếu văn phòng phẩm/)).toBeNull();
    expect(within(drawer).queryByText(/Tài khoản đã khóa ở PMH ID/)).toBeNull();
    expect(within(drawer).getByRole('link', { name: 'Xem nhật ký' })).toHaveAttribute('href', '/admin/audit?actor=u-an');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Người kế tiếp' }));
    const second = await screen.findByRole('dialog', { name: 'Người dùng' });
    expect(within(second).getByText('2/3')).toBeInTheDocument();
    expect(within(second).getByText(/Tài khoản đã khóa ở PMH ID — không đăng nhập được/)).toBeInTheDocument();
    expect(within(second).getByRole('link', { name: 'Xem nhật ký' })).toHaveAttribute('href', '/admin/audit?actor=u-binh');
    await userEvent.click(within(second).getByRole('button', { name: 'Người kế tiếp' }));
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Người dùng' })).getByRole('button', { name: 'Người kế tiếp' })).toBeDisabled());
    const [x] = within(screen.getByRole('dialog', { name: 'Người dùng' })).getAllByRole('button', { name: 'Đóng' });
    await userEvent.click(x);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Người dùng' })).toBeNull());
    expect(screen.getByTestId('location-search')).not.toHaveTextContent('person=');
    await userEvent.click(screen.getByRole('button', { name: 'Phạm Minh Đức' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Người dùng' })).getAllByRole('button', { name: 'Đóng' })[1]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Người dùng' })).toBeNull());
  });

  it('?person=<sub lạ> → không mở panel, gỡ tham số; ?person=u-binh → mở đúng người (F5/dán URL)', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers('/admin/users?person=u-nobody');
    await waitFor(() => expect(screen.getByTestId('location-search')).not.toHaveTextContent('person='));
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    await openUsers('/admin/users?person=u-binh');
    expect(within(await screen.findByRole('dialog', { name: 'Người dùng' })).getByText(/Tài khoản đã khóa ở PMH ID/)).toBeInTheDocument();
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

  describe('tiến độ đăng ký kỳ đang mở', () => {
    const EM: AdminUser = { ...CHI, sub: 'u-em', fullName: 'Võ Em', employeeCode: 'NV0300' };

    it('thẻ "Chưa đăng ký kỳ 11: 2 người"; bấm → ?reg=no ra đúng 2 người; cột "Kỳ tháng 11" Đã đăng ký / Chưa / — (ngoài danh sách kỳ), không số món', async () => {
      stubUsers([AN, BINH, CHI, EM], undefined, regOf([CHI, EM], ['u-an']));
      await openUsers();
      const reg = await screen.findByRole('button', { name: /^Chưa đăng ký kỳ 11/ });
      expect(reg).toHaveTextContent(/^Chưa đăng ký kỳ 112\s*người/);
      expect(screen.getByRole('columnheader', { name: 'Kỳ tháng 11' })).toBeInTheDocument();
      const col = (name: string) => within(screen.getByText(name).closest('tr')!).getAllByRole('cell')[3];
      await waitFor(() => expect(col('Phạm Minh Đức')).toHaveTextContent('Đã đăng ký'));
      expect(col('Trần Chi')).toHaveTextContent('Chưa');
      expect(col('Lê Thị Bình')).toHaveTextContent('—');
      for (const r of bodyRows()) expect(within(r).getAllByRole('cell')[3].textContent).not.toMatch(/\d/);
      await userEvent.click(reg);
      expect(screen.getByTestId('location-search')).toHaveTextContent('?reg=no');
      expect(bodyRows().map((r) => within(r).getAllByRole('button')[0].textContent)).toEqual(['Trần Chi', 'Võ Em']);
      expect(screen.getByText('Đang lọc: Chưa đăng ký kỳ 11 · 2')).toBeInTheDocument();
    });

    it('?reg=yes → chỉ người đã đăng ký kỳ đang mở; ?reg=lạ → không lọc', async () => {
      stubUsers([AN, BINH, CHI, EM], undefined, regOf([CHI, EM], ['u-an']));
      await openUsers('/admin/users?reg=yes');
      await waitFor(() => expect(bodyRows()).toHaveLength(1));
      expect(within(bodyRows()[0]).getByText('Phạm Minh Đức')).toBeInTheDocument();
      expect(screen.getByText('Đang lọc: Đã đăng ký kỳ 11 · 1')).toBeInTheDocument();
    });

    it('lỗi tải danh sách đăng ký → thẻ "—", báo lỗi có "Thử lại"; thử lại thành công thì có số', async () => {
      let fail = true;
      stubUsers([AN, BINH, CHI], undefined, () => (fail ? jsonResponse(500, { code: 'X' }) : regOf([CHI], ['u-an'])()));
      await openUsers();
      const retry = await screen.findByRole('button', { name: 'Thử lại' });
      expect(screen.getByRole('button', { name: /^Chưa đăng ký kỳ 11/ })).toHaveTextContent('—');
      fail = false;
      await userEvent.click(retry);
      await waitFor(() => expect(screen.getByRole('button', { name: /^Chưa đăng ký kỳ 11/ })).toHaveTextContent('1'));
    });

    it('ngăn kéo đang mở khi danh sách đăng ký mới về → vẫn mở, cột cập nhật', async () => {
      let release: () => void = () => undefined;
      const late = new Promise<void>((r) => (release = r));
      const f = stubUsers([AN, BINH, CHI]);
      const base = f.getMockImplementation()!;
      f.mockImplementation((url: string, init?: RequestInit) => (url === REG_URL ? late.then(() => regOf([CHI], ['u-an'])()) : base(url, init)));
      await openUsers();
      await userEvent.click(screen.getByRole('button', { name: 'Phạm Minh Đức' }));
      expect(await screen.findByRole('dialog', { name: 'Người dùng' })).toBeInTheDocument();
      release();
      // Ngăn kéo modal ẩn phần còn lại khỏi cây trợ năng
      await waitFor(() => expect(screen.getByRole('button', { name: /^Chưa đăng ký kỳ 11/, hidden: true })).toHaveTextContent('1'));
      expect(screen.getByRole('dialog', { name: 'Người dùng' })).toBeInTheDocument();
    });
  });
  it('dòng trạng thái: cập nhật lúc 14:05 09/11 (giờ VN)', async () => {
    stubUsers([AN], undefined, undefined, () => ({ last_at: OK_AT, last_total: 5, last_error: null }));
    await openUsers();
    expect(await screen.findByText('Danh bạ PMH ID cập nhật lúc 14:05 09/11')).toBeInTheDocument();
  });

  it('dòng trạng thái: lỗi mới hơn → "Không đọc được … lúc 15:05 09/11, đang hiện bản 14:05 09/11" + lý do theo mã (kể cả giới hạn tần suất)', async () => {
    stubUsers([AN], undefined, undefined, () => ({ last_at: OK_AT, last_total: 5, last_error: { at: ERR_AT, code: 'DIRECTORY_RATE_LIMITED', message: 'x' } }));
    await openUsers();
    expect(await screen.findByText(/^Không đọc được danh bạ PMH ID lúc 15:05 09\/11, đang hiện bản 14:05 09\/11\. PMH ID đang giới hạn tần suất/)).toBeInTheDocument();
  });

  it('dòng trạng thái: lỗi cũ hơn lần thành công thì chỉ hiện bản cập nhật; chưa từng đồng bộ mà lỗi → không có "đang hiện bản"', async () => {
    stubUsers([AN], undefined, undefined, () => ({ last_at: ERR_AT, last_total: 5, last_error: { at: OK_AT, code: 'DIRECTORY_UNAVAILABLE', message: 'x' } }));
    await openUsers();
    expect(await screen.findByText('Danh bạ PMH ID cập nhật lúc 15:05 09/11')).toBeInTheDocument();
    cleanup();
    stubUsers([AN], undefined, undefined, () => ({ last_at: null, last_total: null, last_error: { at: ERR_AT, code: 'MA_LA', message: 'x' } }));
    await openUsers();
    expect(await screen.findByText(/^Không đọc được danh bạ PMH ID lúc 15:05 09\/11\. Chưa đồng bộ được/)).toBeInTheDocument();
    expect(screen.queryByText(/đang hiện bản/)).toBeNull();
  });

  it('bấm Đồng bộ ngay xong (thành công hay lỗi) thì tải lại dòng trạng thái', async () => {
    let n = 0;
    const f = stubUsers([AN], () => jsonResponse(502, { code: 'DIRECTORY_UNAVAILABLE', message: 'x' }), undefined, () => (++n > 1 ? { last_at: null, last_total: null, last_error: { at: ERR_AT, code: 'DIRECTORY_UNAVAILABLE', message: 'x' } } : NEVER));
    await openUsers();
    await screen.findByText('Chưa đồng bộ danh bạ PMH ID');
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    expect(await screen.findByText(/^Không đọc được danh bạ PMH ID lúc 15:05 09\/11/)).toBeInTheDocument();
    expect(f.mock.calls.filter(([u]) => u === '/api/admin/directory/status')).toHaveLength(2);
  });

  it('người đã xoá ẩn mặc định; chọn "Đã xoá" mới thấy, nhãn Đã xoá, và quay lại thì ẩn', async () => {
    stubUsers([AN, BINH, DEL]);
    await openUsers();
    expect(screen.queryByText('Hà Đã Xoá')).toBeNull();
    const view = screen.getByRole('combobox', { name: 'Hiện người' });
    await userEvent.selectOptions(view, 'deleted');
    expect(await screen.findByText('Hà Đã Xoá')).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByText('Đã xoá')).toBeInTheDocument();
    await userEvent.selectOptions(view, '');
    await waitFor(() => expect(screen.queryByText('Hà Đã Xoá')).toBeNull());
    expect(screen.getByText('Phạm Minh Đức')).toBeInTheDocument();
  });

  it('chưa đăng nhập: last_login_at rỗng hiện "Chưa đăng nhập"; người khoá hiện "Đã khóa"', async () => {
    stubUsers([AN, BINH]);
    await openUsers();
    expect(within(screen.getByText('Lê Thị Bình').closest('tr')!).getByText('Chưa đăng nhập')).toBeInTheDocument();
  });
});
