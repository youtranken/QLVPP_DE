import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within, pickOption } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { expectFixedColumns } from '@/test/fixed-columns';

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

const BINH = { sub: 'u-binh', fullName: 'Lê Thị Bình', email: 'binh@pmh.com.vn', department: 'Adm D&E', status: 'locked' };
const audit400 = (fields: string[]) => jsonResponse(400, { statusCode: 400, code: 'VALIDATION', message: 'x', fields });

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

// Ô khoảng ngày (lịch tự dựng): mở lịch, lùi/tiến tới tháng của ngày, bấm ngày đầu rồi ngày cuối
async function pickRange(from: string, to: string) {
  await userEvent.click(screen.getByRole('button', { name: /^Khoảng ngày/ }));
  const dialog = screen.getByRole('dialog', { name: 'Khoảng ngày' });
  for (const day of [from, to]) {
    for (let i = 0; i < 48; i++) {
      const cell = dialog.querySelector<HTMLElement>(`[data-day="${day}"]:not([data-out])`);
      if (cell) {
        await userEvent.click(cell);
        break;
      }
      const any = dialog.querySelector<HTMLElement>('[data-day]:not([data-out])')!.dataset.day!;
      await userEvent.click(within(dialog).getByRole('button', { name: any > day ? 'Tháng trước' : 'Tháng sau' }));
    }
  }
}
const rangeBox = () => screen.getByRole('button', { name: /^Khoảng ngày/ });

async function openAudit(path = '/admin/audit') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
  await within(await screen.findByRole('table')).findAllByText('Sửa cấu hình');
}

const lastAudit = (m: ReturnType<typeof stubApi>) => auditUrls(m).at(-1)!.searchParams;
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row');
const entryRow = (text: string) => screen.getByText(text).closest('tr')!;

afterEach(() => vi.useRealTimers());

describe('AuditPage B11', () => {
  it('tự dựng đầu trang: đúng một h1, mô tả "Chỉ xem", giờ hh:mm:ss theo VN, số dòng', async () => {
    stubApi();
    await openAudit();
    expect(screen.getAllByRole('heading', { level: 1, name: 'Nhật ký' })).toHaveLength(1);
    expect(screen.getByText(/Chỉ xem — không sửa hay xóa được/)).toBeInTheDocument();
    expect(screen.getAllByText('10:05:00')).toHaveLength(2);
    expect(screen.getByText('2+ dòng nhật ký')).toBeInTheDocument();
    // Dòng đếm nằm cuối hàng chip Nhanh, không chiếm hàng riêng trên bảng
    expect(screen.getByText('2+ dòng nhật ký').closest('.au-quick-row .list-meta')).not.toBeNull();
    expectFixedColumns(screen.getAllByRole('table')[0]);
  });

  it('nhóm theo ngày VN: 16:59:59.999 UTC cùng ngày, 17:00:00.000 UTC sang nhóm ngày mới', async () => {
    const rows = [
      row('n3', { createdAt: '2026-10-28T17:00:00.000Z' }),
      row('n2', { createdAt: '2026-10-28T16:59:59.999Z' }),
      row('n1', { createdAt: '2026-10-28T03:00:00.000Z' }),
    ];
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(jsonResponse(200, url.startsWith('/api/admin/audit') ? { items: rows, next_cursor: null } : { items: [], next_cursor: null }))));
    await openAudit();
    const groups = screen.getAllByRole('rowheader');
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveTextContent('29/10/2026');
    expect(groups[0]).toHaveTextContent('1 dòng');
    expect(groups[1]).toHaveTextContent('28/10/2026');
    expect(groups[1]).toHaveTextContent('2 dòng');
  });

  it('cả dòng bấm được (không còn nút "Xem"): dòng có aria-expanded, Enter mở hàng chi tiết chiếm đủ cột, Space đóng; chỉ trường có nhãn i18n, không mã sự kiện/khóa thô/JSON', async () => {
    const detail = { before: { stock_qty: 3, qty: 1, odd_key: 'a' }, after: { stock_qty: 7, qty: 1, odd_key: 'b' }, note: 'đếm lại' };
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(jsonResponse(200, url.startsWith('/api/admin/audit') ? { items: [row('evt-1', { detail })], next_cursor: null } : { items: [], next_cursor: null }))));
    await openAudit();
    expect(screen.queryByRole('button', { name: 'Xem' })).toBeNull();
    const r = entryRow('Lê Thị Bình');
    expect(r).toHaveAttribute('aria-expanded', 'false');
    expect(r).toHaveAttribute('tabindex', '0');
    expect(r).toHaveAccessibleDescription('Enter để xem chi tiết');
    r.focus();
    await userEvent.keyboard('{Enter}');
    expect(r).toHaveAttribute('aria-expanded', 'true');
    const detailCell = screen.getByText('Ghi chú').closest('td')!;
    expect(r).toHaveAttribute('aria-controls', detailCell.firstElementChild!.id);
    expect(detailCell).toHaveAttribute('colspan', '5');
    const diff = within(within(detailCell).getByRole('table'));
    expect(diff.getByRole('rowheader', { name: 'Tồn kho' })).toBeInTheDocument();
    expect(diff.queryByRole('rowheader', { name: 'odd_key' })).toBeNull();
    expect(diff.queryByRole('rowheader', { name: 'Số lượng' })).toBeNull();
    expect(diff.getByText('3')).toBeInTheDocument();
    expect(diff.getByText('7')).toBeInTheDocument();
    expect(within(detailCell).getByText('Ghi chú')).toBeInTheDocument();
    expect(within(detailCell).getByText('đếm lại')).toBeInTheDocument();
    expect(within(detailCell).queryByText(/Mã sự kiện|Chi tiết kỹ thuật|evt-1|stock_qty/)).toBeNull();
    await userEvent.keyboard(' ');
    expect(r).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('đếm lại')).toBeNull();
    await userEvent.click(within(r).getByText('Sửa cấu hình'));
    expect(r).toHaveAttribute('aria-expanded', 'true');
  });

  it('dòng không có gì để xem (đăng nhập, phiên bị thu hồi, sửa mà không trường nào đổi) không có mũi tên, không mở được; dòng có chi tiết dùng cùng một mũi tên', async () => {
    const items = [
      row('s1', { action: 'auth.session_revoked', actorName: 'Hệ thống', detail: { session_id: 'aaaa0000-1111-4222-8333-444455556666' } }),
      row('s2', { action: 'auth.login', actorName: 'Võ Hợp Đồng', detail: null }),
      row('s3', { actorName: 'Phạm Không Đổi', detail: { before: { admin_contact: 'x' }, after: { admin_contact: 'x' } } }),
      row('s4', { actorName: 'Lê Có Đổi' }),
    ];
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(jsonResponse(200, url.startsWith('/api/admin/audit') ? { items, next_cursor: null } : { items: [], next_cursor: null }))));
    await openAudit();
    for (const name of ['Hệ thống', 'Võ Hợp Đồng', 'Phạm Không Đổi']) {
      const r = entryRow(name);
      expect(r).not.toHaveAttribute('aria-expanded');
      expect(r).not.toHaveAttribute('tabindex');
      expect(r.querySelector('.au-chev')).toBeNull();
      await userEvent.click(r);
      expect(r).not.toHaveAttribute('aria-expanded');
    }
    const n = bodyRows().length;
    await userEvent.click(entryRow('Hệ thống'));
    expect(bodyRows()).toHaveLength(n);
    const open = entryRow('Lê Có Đổi');
    expect(open.querySelector('.au-chev')).not.toBeNull();
    expect(open).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(open);
    expect(open).toHaveAttribute('aria-expanded', 'true');
  });

  it('trường đổi không có nhãn vẫn báo bằng câu thường: "Ảnh đã đổi", "Đổi nhóm sang <tên>", "Có thay đổi khác"; không "Không có trường nào khác nhau", không mã', async () => {
    const detail = { before: { image_file_id: 'aaaa0000-1111-4222-8333-444455556666', category_id: 'c-1', meta: { a: 1 } }, after: { image_file_id: 'bbbb0000-1111-4222-8333-444455556666', category_id: 'c-2', meta: { a: 2 } } };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (url.startsWith('/api/admin/audit')) return Promise.resolve(jsonResponse(200, { items: [row('h1', { detail })], next_cursor: null }));
      if (url.startsWith('/api/item-categories')) return Promise.resolve(jsonResponse(200, [{ id: 'c-2', name: 'Bút & viết', name_en: null, sort_order: 1, active: true }]));
      return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }));
    }));
    await openAudit();
    await userEvent.click(within(entryRow('Lê Thị Bình')).getByText('Sửa cấu hình'));
    expect(await screen.findByText('Đổi nhóm sang Bút & viết')).toBeInTheDocument();
    expect(screen.getByText('Ảnh đã đổi')).toBeInTheDocument();
    expect(screen.getByText('Có thay đổi khác')).toBeInTheDocument();
    expect(screen.queryByText('Không có trường nào khác nhau.')).toBeNull();
    expect(screen.queryByText(/aaaa0000|bbbb0000|c-2|meta/)).toBeNull();
  });

  it('cột Đối tượng hiện tên khi before/after có name/custom_name; không có thì tên loại tiếng Việt, không mã', async () => {
    const items = [
      row('n1', { objectType: 'item', objectId: '0b6f1c2e-1111-4222-8333-444455556666', detail: { before: null, after: { name: 'Bút bi xanh' } } }),
      row('n2', { objectType: 'request_line', objectId: '9a8b7c6d-1111-4222-8333-444455556666', detail: { before: { custom_name: 'Băng keo 2 mặt' }, after: { review_status: 'accepted' } } }),
      row('n3', { objectType: 'item', objectId: '12345678-1111-4222-8333-444455556666', detail: { before: { stock_qty: 1 }, after: { stock_qty: 2 } } }),
    ];
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(jsonResponse(200, url.startsWith('/api/admin/audit') ? { items, next_cursor: null } : { items: [], next_cursor: null }))));
    await openAudit();
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
    expect(screen.getByText('Băng keo 2 mặt')).toBeInTheDocument();
    expect(within(entryRow('Bút bi xanh').parentElement!).getAllByText('Món')).toHaveLength(1);
    expect(screen.queryByText(/12345678/)).toBeNull();
  });

  it('cột Đối tượng dùng objectLabel của api: tên món, "Phiếu tháng 11/2026 · chủ phiếu", dòng phiếu, bản chốt, kỳ; null → tên loại; mã không hiện ở bảng, tooltip hay hàng chi tiết', async () => {
    const itemId = 'c419efd8-1111-4222-8333-444455556666';
    const owner = 'Trần Văn Cường';
    const items = [
      row('l1', { objectType: 'item', objectId: itemId, objectLabel: { name: 'Bút bi đỏ', ym: null, owner: null }, detail: { before: { stock_qty: 1 }, after: { stock_qty: 2 } } }),
      row('l2', { objectType: 'request', objectId: 'aaaa0000-1111-4222-8333-444455556666', objectLabel: { name: null, ym: '2026-11', owner } }),
      row('l3', { objectType: 'request_line', objectId: 'bbbb0000-1111-4222-8333-444455556666', objectLabel: { name: 'Băng keo', ym: '2026-11', owner } }),
      row('l4', { objectType: 'report_snapshot', objectId: 'cccc0000-1111-4222-8333-444455556666', objectLabel: { name: null, ym: '2026-10', owner: null } }),
      row('l5', { objectType: 'period', objectId: '2026-10', objectLabel: { name: null, ym: '2026-10', owner: null } }),
      row('l6', { objectType: 'session', objectId: '1e004b5e-1111-4222-8333-444455556666', objectLabel: null, detail: {} }),
    ];
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(jsonResponse(200, url.startsWith('/api/admin/audit') ? { items, next_cursor: null } : { items: [], next_cursor: null }))));
    await openAudit();
    const item = screen.getByText('Bút bi đỏ');
    expect(item.closest('[title]')).toBeNull();
    expect(screen.queryByText(/c419efd8/)).toBeNull();
    expect(screen.getByText(`Phiếu tháng 11/2026 · ${owner}`)).toBeInTheDocument();
    expect(screen.getByText(`Băng keo · Phiếu tháng 11/2026 · ${owner}`)).toBeInTheDocument();
    expect(screen.getByText('Bản chốt kỳ 10/2026')).toBeInTheDocument();
    expect(screen.getByText('Kỳ tháng 10/2026')).toBeInTheDocument();
    expect(screen.getByText('Phiên đăng nhập')).toBeInTheDocument();
    expect(screen.queryByText(/1e004b5e/)).toBeNull();
    await userEvent.click(item);
    expect(screen.getByRole('rowheader', { name: 'Tồn kho' })).toBeInTheDocument();
    expect(screen.queryByText(/Mã đối tượng|c419efd8/)).toBeNull();
  });

  it('"Xem thêm" tải trang kế bằng cursor; hết trang → thông báo "Đã hiện hết…" và không còn nút', async () => {
    const fetchMock = stubApi();
    await openAudit();
    expect(screen.queryByText('Đã hiện hết nhật ký trong khoảng lọc.')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(await within(screen.getByRole('table')).findByText('Đăng nhập')).toBeInTheDocument();
    expect(screen.getByText('local:sa')).toBeInTheDocument();
    expect(lastAudit(fetchMock).get('cursor')).toBe('c2');
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
    expect(screen.getByText('Đã hiện hết nhật ký trong khoảng lọc.')).toBeInTheDocument();
  });

  it('lọc người/hành động/khoảng ngày → gửi actor, action, from, to và ghi vào URL', async () => {
    const fetchMock = stubApi();
    await openAudit();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người thực hiện' }), 'Bình');
    await userEvent.click(await screen.findByRole('button', { name: /Lê Thị Bình/ }));
    await pickOption(screen.getByLabelText('Hành động'), 'Sửa cấu hình');
    await pickRange('2026-10-01', '2026-10-28');
    await userEvent.click(screen.getByRole('button', { name: 'Lọc' }));
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('actor')).toBe('u-binh'));
    const last = lastAudit(fetchMock);
    expect([last.get('action'), last.get('from'), last.get('to')]).toEqual(['config.updated', '2026-10-01', '2026-10-28']);
    expect(screen.getByTestId('location-search')).toHaveTextContent('actor=u-binh&action=config.updated&from=2026-10-01&to=2026-10-28');
    // Một nút "Xóa lọc" cho việc bỏ lọc (ở thanh lọc), không hàng "Đang lọc …" thứ hai
    expect(screen.queryByText(/Đang lọc:/)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Xóa lọc' })).toHaveLength(1);
  });

  it('Danh bạ dẫn tới ?actor=<sub>: gọi api với actor đó ngay khi vào và hiện tên người', async () => {
    const fetchMock = stubApi();
    await openAudit('/admin/audit?actor=u-binh');
    expect(lastAudit(fetchMock).get('actor')).toBe('u-binh');
    expect(await within(screen.getByRole('group', { name: 'Người thực hiện' })).findByText('Lê Thị Bình')).toBeInTheDocument();
  });

  it('"Hệ thống (tự động)" lọc actor=system; "Xóa lọc" bỏ mọi khóa khỏi URL', async () => {
    const fetchMock = stubApi();
    await openAudit();
    await userEvent.click(screen.getByRole('button', { name: 'Hệ thống (tự động)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lọc' }));
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('actor')).toBe('system'));
    await userEvent.click(screen.getAllByRole('button', { name: 'Xóa lọc' })[0]);
    await vi.waitFor(() => expect(lastAudit(fetchMock).has('actor')).toBe(false));
    expect(screen.getByTestId('location-search')).not.toHaveTextContent('actor=');
  });

  it('Enter trong ô tìm người áp dụng bộ lọc đang nhập', async () => {
    const fetchMock = stubApi();
    await openAudit();
    await pickOption(screen.getByLabelText('Hành động'), 'Thêm món');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người thực hiện' }), 'Bình{Enter}');
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('action')).toBe('item.created'));
  });

  it('URL có "đến" sớm hơn "từ" 1 ngày → bấm Lọc báo lỗi gắn ô khoảng ngày, không gọi lại api; chọn lại một ngày → gọi api', async () => {
    const fetchMock = stubApi();
    await openAudit('/admin/audit?from=2026-10-20&to=2026-10-19');
    const before = auditUrls(fetchMock).length;
    await userEvent.click(screen.getByRole('button', { name: 'Lọc' }));
    expect(rangeBox()).toHaveAccessibleDescription('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
    expect(auditUrls(fetchMock)).toHaveLength(before);
    await pickRange('2026-10-20', '2026-10-20');
    expect(rangeBox()).not.toHaveAccessibleDescription();
    await userEvent.click(screen.getByRole('button', { name: 'Lọc' }));
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('to')).toBe('2026-10-20'));
    expect(lastAudit(fetchMock).get('from')).toBe('2026-10-20');
  });

  it('khoảng ngày là một ô mở lịch, không có ô gõ ngày hay input date; ?from=2026-10-01 hiện "Từ 01/10/2026"', async () => {
    stubApi();
    await openAudit('/admin/audit?from=2026-10-01');
    expect(document.querySelector('input[type="date"], input[placeholder="dd/mm/yyyy"]')).toBeNull();
    expect(rangeBox()).toHaveTextContent('Từ 01/10/2026');
  });

  it('ô tìm người thực hiện dùng gợi ý ngắn "Tên hoặc email" (câu mặc định bị cắt khi cả thanh lọc nằm một hàng)', async () => {
    stubApi();
    await openAudit('/admin/audit');
    const form = screen.getByRole('form', { name: 'Lọc nhật ký' });
    expect(within(form).getByPlaceholderText('Tên hoặc email')).toBeInTheDocument();
    expect(within(form).queryByPlaceholderText('Gõ tên hoặc email để tìm')).toBeNull();
  });

  it('chip "Hôm nay" lúc 23:30 UTC gửi from = to = ngày kế tiếp theo giờ VN', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T23:30:00.000Z'));
    const fetchMock = stubApi();
    await openAudit();
    await userEvent.click(screen.getByRole('button', { name: 'Hôm nay' }));
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('from')).toBe('2026-10-29'));
    expect(lastAudit(fetchMock).get('to')).toBe('2026-10-29');
    expect(screen.getByRole('button', { name: 'Hôm nay' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('chip tháng ghi "Tháng 10/2026" và gửi cả tháng; chip "Đăng nhập bị từ chối" lọc ngay theo hành động', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T05:00:00.000Z'));
    const fetchMock = stubApi();
    await openAudit();
    await userEvent.click(screen.getByRole('button', { name: 'Tháng 10/2026' }));
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('from')).toBe('2026-10-01'));
    expect(lastAudit(fetchMock).get('to')).toBe('2026-10-31');
    await userEvent.click(screen.getByRole('button', { name: 'Đăng nhập bị từ chối' }));
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('action')).toBe('auth.login_denied_idp'));
    expect(lastAudit(fetchMock).get('from')).toBe('2026-10-01');
  });

  it('api trả VALIDATION fields [to] → lỗi gắn ô khoảng ngày, không hiện lỗi tải chung', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.startsWith('/api/admin/audit') ? audit400(['to']) : jsonResponse(200, { items: [], next_cursor: null }))));
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/audit?to=2026-02-30');
    await vi.waitFor(() => expect(rangeBox()).toHaveAccessibleDescription('Ngày không hợp lệ.'));
    expect(screen.queryByText('Không tải được dữ liệu — thử lại.')).toBeNull();
  });

  it('lỗi tải khác → "Không tải được dữ liệu — thử lại." + Thử lại', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.startsWith('/api/admin/audit') ? jsonResponse(500, { code: 'X' }) : jsonResponse(200, { items: [], next_cursor: null }))));
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/audit');
    expect(await screen.findByText('Không tải được dữ liệu — thử lại.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('rỗng có lọc: tiêu đề + gợi ý + "Xóa lọc"; hành động lạ trong URL vẫn là một lựa chọn', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }))));
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/audit?action=future.thing');
    expect(await screen.findByText('Không có dòng nhật ký nào khớp bộ lọc.')).toBeInTheDocument();
    expect(screen.getByText(/Nới khoảng ngày/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Hành động' })).toHaveTextContent('future.thing');
    expect(screen.getByRole('combobox', { name: 'Hành động' }).closest('.select')).toHaveClass('select', 'select--stacked');
    expect(screen.queryByText('Đã hiện hết nhật ký trong khoảng lọc.')).toBeNull();
  });

  it('mã hành động api mới hơn web hiện mã thô; nhãn đã biết chỉ hiện nhãn, mã gốc không hiện cả ở hàng chi tiết; không có before/after → cặp nhãn–giá trị', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) =>
      Promise.resolve(jsonResponse(200, url.startsWith('/api/admin/audit') ? { items: [row('a1', { action: 'future.thing' }), row('a2', { action: 'line.delivered', detail: { ip: '10.0.0.5' } })], next_cursor: null } : { items: [], next_cursor: null })),
    ));
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/audit');
    expect(await screen.findByText('future.thing')).toBeInTheDocument();
    expect(within(screen.getAllByRole('table')[0]).getByText('Giao hàng')).toBeInTheDocument();
    expect(within(screen.getAllByRole('table')[0]).queryByText('line.delivered')).toBeNull();
    await userEvent.click(within(screen.getAllByRole('table')[0]).getByText('Giao hàng'));
    expect(screen.queryByText(/line\.delivered|Mã hành động/)).toBeNull();
    expect(screen.getByText('Địa chỉ IP')).toBeInTheDocument();
    expect(screen.getByText('10.0.0.5')).toBeInTheDocument();
    expect(bodyRows().length).toBeGreaterThan(2);
  });
});
