import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  actor: 'u-binh',
  actorName: 'Lê Thị Bình',
  action: 'config.updated',
  objectType: 'config',
  objectId: 'admin_contact',
  detail: { before: { admin_contact: '' }, after: { admin_contact: 'chị Bình' } },
  createdAt: '2026-10-28T03:05:00.000Z',
  ...over,
});

const BINH = { sub: 'u-binh', fullName: 'Lê Thị Bình', email: 'binh@pmh.com.vn', department: 'Hành chính', status: 'locked' };

function stubApi() {
  const fetchMock = vi.fn((url: string) => {
    const params = new URL(url, 'http://x').searchParams;
    if (url.startsWith('/api/admin/users')) return Promise.resolve(jsonResponse(200, { items: [BINH], next_cursor: null }));
    if (params.get('cursor') === 'c2') {
      return Promise.resolve(jsonResponse(200, { items: [row('a3', { action: 'auth.login', actor: 'local:sa', actorName: null, detail: { ip: '10.0.0.5' } })], next_cursor: null }));
    }
    return Promise.resolve(jsonResponse(200, { items: [row('a1'), row('a2', { action: 'item.created' })], next_cursor: 'c2' }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const auditUrls = (m: ReturnType<typeof stubApi>) =>
  m.mock.calls.map(([u]) => new URL(String(u), 'http://x')).filter((u) => u.pathname === '/api/admin/audit');

async function openAudit() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/audit');
  await screen.findAllByText('Sửa cấu hình');
}

describe('AuditPage', () => {
  it('hiện thời gian, người, hành động và before/after dạng JSON gọn', async () => {
    stubApi();
    await openAudit();
    const first = screen.getAllByRole('row')[1];
    expect(within(first).getByText('10:05 28/10/26')).toBeInTheDocument();
    expect(within(first).getByText('Lê Thị Bình')).toBeInTheDocument();
    expect(within(first).getByText('Trước: {"admin_contact":""}')).toBeInTheDocument();
    expect(within(first).getByText('Sau: {"admin_contact":"chị Bình"}')).toBeInTheDocument();
  });

  it('"Xem thêm" tải trang kế bằng cursor; dòng không có before/after hiện JSON chi tiết', async () => {
    const fetchMock = stubApi();
    await openAudit();
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.getByText('local:sa')).toBeInTheDocument();
    expect(screen.getByText('{"ip":"10.0.0.5"}')).toBeInTheDocument();
    expect(auditUrls(fetchMock).at(-1)?.searchParams.get('cursor')).toBe('c2');
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });

  it('lọc người/hành động/khoảng ngày → gửi actor, action, from, to', async () => {
    const fetchMock = stubApi();
    await openAudit();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người thực hiện' }), 'Bình');
    await userEvent.click(await screen.findByRole('button', { name: /Lê Thị Bình/ }));
    await userEvent.type(screen.getByLabelText('Hành động'), 'config.updated');
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-10-01');
    await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-10-28');
    await userEvent.click(screen.getByRole('button', { name: 'Lọc' }));
    await vi.waitFor(() => expect(auditUrls(fetchMock).at(-1)?.searchParams.get('actor')).toBe('u-binh'));
    const last = auditUrls(fetchMock).at(-1)!.searchParams;
    expect([last.get('action'), last.get('from'), last.get('to')]).toEqual(['config.updated', '2026-10-01', '2026-10-28']);
  });

  it('Enter trong ô tìm người thực hiện áp dụng bộ lọc đang nhập', async () => {
    const fetchMock = stubApi();
    await openAudit();
    await userEvent.type(screen.getByLabelText('Hành động'), 'item.created');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người thực hiện' }), 'Bình{Enter}');
    await vi.waitFor(() => expect(auditUrls(fetchMock).at(-1)?.searchParams.get('action')).toBe('item.created'));
  });

  it('chọn người từ danh bạ (kể cả đã khóa) → actor=<sub> chính xác; "Xóa lọc" bỏ actor', async () => {
    const fetchMock = stubApi();
    await openAudit();
    expect(screen.queryByRole('list', { name: 'Kết quả tìm người' })).toBeNull();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người thực hiện' }), 'Bình');
    await userEvent.click(await screen.findByRole('button', { name: /Lê Thị Bình/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Lọc' }));
    await vi.waitFor(() => expect(auditUrls(fetchMock).at(-1)?.searchParams.get('actor')).toBe('u-binh'));
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    await vi.waitFor(() => expect(auditUrls(fetchMock).at(-1)?.searchParams.has('actor')).toBe(false));
    expect(screen.getByRole('searchbox', { name: 'Tìm người thực hiện' })).toHaveValue('');
  });

  it('"Đến ngày" trước "Từ ngày" → lỗi gắn ô, không gọi lại server', async () => {
    const fetchMock = stubApi();
    await openAudit();
    const before = auditUrls(fetchMock).length;
    await userEvent.type(screen.getByLabelText('Từ ngày'), '2026-10-20');
    await userEvent.type(screen.getByLabelText('Đến ngày'), '2026-10-01');
    await userEvent.click(screen.getByRole('button', { name: 'Lọc' }));
    expect(screen.getByLabelText('Đến ngày')).toHaveAccessibleDescription('“Đến ngày” phải bằng hoặc sau “Từ ngày”.');
    expect(auditUrls(fetchMock)).toHaveLength(before);
  });

  it('mã hành động api mới hơn web hiện mã thô; nhãn đã biết có mã gốc trong title; gợi ý bộ lọc có nhãn', async () => {
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(jsonResponse(200, url.startsWith('/api/admin/audit') ? { items: [row('a1', { action: 'future.thing' }), row('a2', { action: 'line.delivered' })], next_cursor: null } : { items: [], next_cursor: null })),
    );
    vi.stubGlobal('fetch', fetchMock);
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/audit');
    expect(await screen.findByText('future.thing')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Giao hàng')).toHaveAttribute('title', 'line.delivered');
    expect(document.querySelector('datalist option[value="line.cancel_remaining"]')).toHaveAttribute('label', 'Hủy nợ');
  });
});
