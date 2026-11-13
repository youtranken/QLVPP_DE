import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, within, optionLabels } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { PERIOD } from '@/test/request-api-stub';
import i18n from '@/lib/i18n';
import { MeContext } from '@/lib/me';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { backlogLine } from '@/features/delivery/backlog-fixtures';
import { stubBacklog } from '@/features/delivery/backlog-test-stub';
import { person, pLine } from '@/features/delivery/people/people-fixtures';
import { reportFixture, snapshotDataFixture, snapshotRow, ISSUE } from '@/features/reports/reports-fixtures';
import { setupSendAdm } from '@/features/send-adm/send-adm-fixtures';

const PERSON = { full_name: 'Pham Van Duc', department: 'Inspection Team' };

const english = () => i18n.changeLanguage('en');
// Vỏ app có tên người đăng nhập và tên ngôn ngữ "Tiếng Việt" (đúng ở mọi ngôn ngữ) → chỉ kiểm vùng nội dung
const VIETNAMESE_WORD = /\S*[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]\S*/gi;
const vietnameseWords = () =>
  [document.querySelector('main') ?? document.body, ...document.querySelectorAll('[role="dialog"]')].flatMap(
    (el) => el.textContent?.match(VIETNAMESE_WORD) ?? [],
  );
const noVietnamese = () => expect(vietnameseWords()).toEqual([]);

// Hộp giao có đủ nhóm: dòng nợ, dòng thiếu tủ, ADM hết hàng, dòng chờ xem; người đã nghỉ
const DUC = person({
  user_sub: 'u-duc',
  ...PERSON,
  user_status: 'locked',
  lines: [
    pLine({ line_id: 'l-pen', name: 'Bút bi xanh', name_en: 'Blue pen', qty: 5, remaining_qty: 5, stock_qty: 3 }),
    pLine({ line_id: 'l-old', period_ym: '2026-09', is_debt: true, item_id: 'i-a4', name: 'Giấy A4', name_en: 'A4 paper', unit: 'ream', remaining_qty: 2, stock_qty: 9 }),
    pLine({ line_id: 'l-clip', item_id: 'i-clip', name: 'Kẹp giấy', name_en: 'Paper clip', remaining_qty: 2, stock_qty: 1, adm_out: true }),
    pLine({ line_id: 'l-tape', item_id: null, name: 'Double tape', unit: 'cai', stock_qty: null, review_status: 'pending' }),
  ],
});

function stubDelivery() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
      if (url === '/api/admin/items' || url.startsWith('/api/item-categories')) return Promise.resolve(jsonResponse(200, []));
      if (url.endsWith('/delivery-people')) return Promise.resolve(jsonResponse(200, { ym: '2026-10', people: [DUC] }));
      return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }));
    }),
  );
}

const ADMIN = makeMe('admin');

beforeEach(() => mockViewport(1280));
afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('vi');
});

describe('Song ngữ các màn Plan 3', () => {
  it('Giao hàng: hộp giao vi có "Xác nhận giao"; en không còn chữ Việt', async () => {
    stubDelivery();
    renderApp(ADMIN, '/admin/delivery');
    await userEvent.click(await screen.findByRole('button', { name: /^Giao…/ }, { timeout: 5000 }));
    expect(await screen.findByRole('button', { name: 'Xác nhận giao' })).toBeInTheDocument();
    await english();
    expect(await screen.findByRole('button', { name: 'Confirm delivery' }, { timeout: 5000 })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).getByText('Blue pen')).toBeInTheDocument();
    noVietnamese();
  });

  it('Còn nợ: vi có "Hủy nợ"; en không còn chữ Việt, cả khi mở hủy nợ', async () => {
    const line = backlogLine({ ...PERSON, name: 'Bút bi xanh', name_en: 'Blue pen' });
    stubBacklog([line, backlogLine({ line_id: 'l-lan', user_sub: 'u-lan', full_name: 'Vo Thi Lan', department: null, user_status: 'locked' })]);
    renderApp(ADMIN, '/admin/backlog');
    expect(await screen.findByRole('heading', { level: 1, name: 'Còn nợ' })).toBeInTheDocument();
    expect((await screen.findAllByRole('button', { name: /^Hủy nợ / }))[0]).toHaveTextContent('Hủy nợ');
    await english();
    expect(await screen.findByRole('heading', { level: 1, name: 'Outstanding' })).toBeInTheDocument();
    expect(await screen.findAllByText('Blue pen')).not.toHaveLength(0);
    noVietnamese();
    await userEvent.click(screen.getAllByRole('button', { name: /^Cancel debt / })[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    noVietnamese();
  });

  it('Báo cáo & gửi NCC: vi có "Đề nghị" và "Chưa gửi NCC"; en không còn chữ Việt (bảng, các bản đã in / xuất)', async () => {
    const report = reportFixture({
      byDepartment: [{ department: 'Inspection Team', people: [{ user_sub: 'u-duc', full_name: 'Pham Van Duc', lines: [{ name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'cay', qty: 12 }] }] }],
      custom: [{ key: 'custom:tape', name: 'Double tape', unit: 'cuon', requested: 4, backlog_prev: 1, stock: null, need: 5, people: 2 }],
      byItem: reportFixture().byItem.map((r) => ({ ...r, name: r.item_id === 'item-glue' ? 'Hồ dán' : r.name, name_en: r.item_id === 'item-glue' ? 'Glue' : r.name_en })),
      issues: [{ ...ISSUE, reason: 'Weekly meeting' }],
    });
    setupSendAdm({ report, snapshots: [snapshotRow({ created_by_name: 'Tran Thi Binh', items_count: 2, units_total: 9 })] });
    renderApp(ADMIN, '/admin/reports');
    expect(await screen.findByRole('columnheader', { name: 'Đề nghị' })).toBeInTheDocument();
    expect(screen.getByText('Chưa gửi NCC')).toBeInTheDocument();
    await english();
    expect(await screen.findByText('Not sent to supplier yet')).toBeInTheDocument();
    expect(screen.getAllByRole('row', { name: /Blue pen/ }).length).toBeGreaterThan(0);
    expect(await screen.findByText(/Printed \/ exported copies \(1\)/)).toBeInTheDocument();
    noVietnamese();
  });

  it('Trang in: en — thanh công cụ không còn chữ Việt (trang 1 Phiếu đề xuất song ngữ theo mẫu D&E)', async () => {
    const data = snapshotDataFixture({
      ...reportFixture({
        byDepartment: [{ department: 'Inspection Team', people: [{ user_sub: 'u-duc', full_name: 'Pham Van Duc', lines: [{ name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'cay', qty: 12 }] }] }],
        custom: [{ key: 'custom:tape', name: 'Double tape', unit: 'cuon', requested: 4, backlog_prev: 1, stock: null, need: 5, people: 2 }],
        byItem: [{ key: 'item-pen', item_id: 'item-pen', name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'cay', requested: 12, backlog_prev: 3, stock: 5, need: 10 }],
        issues: [{ ...ISSUE, reason: 'Weekly meeting' }],
      }),
      order_qty: { 'item-pen': 14, 'custom:tape': 5 },
      signature_boxes: undefined,
      signers: { preparer: 'Le Thi Hoa', head: 'Ngo Van Bao', approver: 'Do Minh Chau' },
      created_by: { sub: 'u-admin', name: 'Tran Thi Binh' },
    });
    const reply = (url: string) => (url.includes('/snapshots/') ? data : url === '/api/units' ? [] : { items: [snapshotRow({ id: data.id })], next_cursor: null, unread_count: 0 });
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(jsonResponse(200, reply(url)))));
    renderApp(ADMIN, `/admin/reports/snapshots/${data.id}/print`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Phiếu đề xuất văn phòng phẩm' })).toBeInTheDocument();
    await english();
    const toolbar = await screen.findByRole('toolbar', { name: /Print toolbar/ });
    const words = [toolbar].flatMap((el) => el.textContent?.match(VIETNAMESE_WORD) ?? []);
    expect(words).toEqual([]);
  });

  it('Chuông: mọi chủ đề thông báo (kể cả line_review ba biến thể) ở en không còn chữ Việt', async () => {
    const n = (id: string, topic: string, params: Record<string, unknown>) => ({ id, topic, params, link: '/history/2026-11', created_at: '2026-11-12T03:00:00.000Z', read_at: null });
    const items = [
      n('1', 'period_open', { ym: '2026-11', deadline: '2026-11-11T00:00:00Z' }),
      n('2', 'reminder', { ym: '2026-11', deadline: '2026-11-11T00:00:00Z' }),
      n('3', 'period_locked', { ym: '2026-11', registered: 18, headcount: 25 }),
      n('4', 'low_stock', { name: 'Bút bi xanh', name_en: 'Blue pen', stock_qty: 3 }),
      n('5', 'request_delivered', { ym: '2026-11' }),
      n('6', 'line_cancelled', { ym: '2026-11', name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'hop', qty: 2, reason: 'Out of stock' }),
      n('7', 'custom_line_new', { ym: '2026-11', name: 'Ring binder', person: 'An' }),
      n('8', 'line_review', { ym: '2026-11', action: 'accepted', name: 'Ring binder' }),
      n('9', 'line_review', { ym: '2026-11', action: 'rejected', name: 'Ring binder', note: 'Already stocked' }),
      n('10', 'line_review', { ym: '2026-11', action: 'converted', name: 'Ring binder', item_name: 'Bìa còng A4', item_name_en: 'A4 binder' }),
      n('11', 'future_topic', {}),
    ];
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items, next_cursor: null, unread_count: items.length }))));
    await english();
    renderWithI18n(
      <MeContext.Provider value={makeMe('member')}>
        <MemoryRouter>
          <NotificationBell />
        </MemoryRouter>
      </MeContext.Provider>,
    );
    await userEvent.click(await screen.findByRole('button', { name: /^Notifications, \d+ unread$/ }));
    expect(await within(await screen.findByRole('list')).findAllByRole('listitem')).toHaveLength(items.length);
    noVietnamese();
  });

  it('Lịch sử: en không còn chữ Việt (kỳ, trạng thái giao, nhận lẻ)', async () => {
    const entry = { period_ym: '2026-10', line_count: 3, total_qty: 10, delivered_qty: 6, remaining_qty: 4, cancelled_qty: 0, custom: { pending: 1, accepted: 0, converted: 2, rejected: 1 }, catalog: { line_count: 3, qty: 10, delivered_qty: 6, remaining_qty: 4, owed_line_count: 1 } };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
        if (url.startsWith('/api/me/issues')) return Promise.resolve(jsonResponse(200, { items: [{ id: 'm-1', item_id: 'i-1', item_name: 'Bút bi', item_name_en: 'Ballpoint pen', unit: 'cai', qty: 2, note: 'New hire', created_at: '2026-10-20T03:30:00Z' }], next_cursor: null }));
        if (url.startsWith('/api/me/requests')) return Promise.resolve(jsonResponse(200, { items: [entry], next_cursor: null }));
        if (url.startsWith('/api/me/request?ym=')) return Promise.resolve(jsonResponse(404, { code: 'REQUEST_NOT_FOUND' }));
        return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }));
      }),
    );
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Tháng 10')).toBeInTheDocument();
    await english();
    expect(await screen.findByText('Ballpoint pen')).toBeInTheDocument();
    noVietnamese();
  });

  it('Nhật ký: en hiện nhãn hành động, gợi ý bộ lọc có nhãn en và không còn chữ Việt', async () => {
    const row = (id: string, action: string) => ({ id, actor: 'u-an', actorName: 'An Nguyen', action, objectType: 'line', objectId: 'l-1', detail: { ip: '10.0.0.5' }, createdAt: '2026-10-28T03:05:00.000Z' });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(jsonResponse(200, { items: url.startsWith('/api/admin/audit') ? [row('a1', 'line.delivered'), row('a2', 'line.cancel_remaining')] : [], next_cursor: null })),
      ),
    );
    renderApp(ADMIN, '/admin/audit');
    expect(await within(await screen.findByRole('table')).findByText('Giao hàng')).toBeInTheDocument();
    await english();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Delivered')).toBeInTheDocument();
    expect(within(table).queryByText('line.delivered')).toBeNull();
    expect(within(table).getByText('Backlog cancelled')).toBeInTheDocument();
    expect(await optionLabels(screen.getByRole('combobox', { name: 'Action' }))).toContain('Backlog cancelled');
    await userEvent.click(screen.getByRole('button', { name: /^Date range/ }));
    expect(screen.getByRole('dialog', { name: 'Date range' })).toBeInTheDocument();
    noVietnamese();
  });
});
