import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { PERIOD } from '@/test/request-api-stub';
import { lineView } from '@/test/fixtures-request';
import i18n from '@/lib/i18n';
import { MeContext } from '@/lib/me';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { backlogLine } from '@/features/delivery/backlog-fixtures';
import { stubBacklog } from '@/features/delivery/backlog-test-stub';
import { LOCKED_SUMMARY, personRow } from '@/features/delivery/delivery-fixtures';
import { reportFixture, snapshotDataFixture, snapshotRow, ISSUE } from '@/features/reports/reports-fixtures';
import { stubReports } from '@/features/reports/reports-test-stub';
import type { AdminRequestView } from '@/features/summary/summary.api';

const PERSON = { full_name: 'Pham Van Duc', department: 'Inspection Team' };
const pen = { name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'cay', pack_note: null, image_file_id: null, active: true, admin_only: false };

const english = () => i18n.changeLanguage('en');
// Vỏ app có tên người đăng nhập và tên ngôn ngữ "Tiếng Việt" (đúng ở mọi ngôn ngữ) → chỉ kiểm vùng nội dung
const VIETNAMESE_WORD = /\S*[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]\S*/gi;
const vietnameseWords = () =>
  [document.querySelector('main') ?? document.body, ...document.querySelectorAll('[role="dialog"]')].flatMap(
    (el) => el.textContent?.match(VIETNAMESE_WORD) ?? [],
  );
const noVietnamese = () => expect(vietnameseWords()).toEqual([]);

const deliveryView = (): AdminRequestView => ({
  id: 'r-1',
  period_ym: '2026-10',
  user_sub: 'u-duc',
  ...PERSON,
  updated_at: '2026-10-05T07:20:00.000Z',
  is_open: false,
  user_status: 'active',
  lines: [
    lineView({ id: 'l-pen', item_id: 'i-pen', item: pen, qty: 5, delivered_qty: 3 }),
    lineView({ id: 'l-tape', custom_name: 'Double tape', custom_unit: 'cai', qty: 2, review_status: 'accepted' }),
  ],
});

function stubDelivery() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
      if (url === '/api/admin/items' || url.startsWith('/api/item-categories')) return Promise.resolve(jsonResponse(200, []));
      if (url.endsWith('/summary')) return Promise.resolve(jsonResponse(200, LOCKED_SUMMARY));
      if (url.startsWith('/api/admin/periods/')) return Promise.resolve(jsonResponse(200, { items: [personRow({ ...PERSON })], next_cursor: null }));
      if (url === '/api/admin/requests/r-1') return Promise.resolve(jsonResponse(200, deliveryView()));
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
  it('Giao hàng: vi có "Giao tất cả"; en không còn chữ Việt', async () => {
    stubDelivery();
    renderApp(ADMIN, '/admin/delivery?request=r-1');
    expect(await screen.findByRole('button', { name: 'Giao tất cả' })).toBeInTheDocument();
    await english();
    expect(await screen.findByRole('button', { name: 'Deliver all' })).toBeInTheDocument();
    expect(screen.getByText('Blue pen')).toBeInTheDocument();
    noVietnamese();
  });

  it('Còn nợ: vi có "Hủy nợ"; en không còn chữ Việt, cả khi mở hủy nợ', async () => {
    const line = backlogLine({ ...PERSON, name: 'Bút bi xanh', name_en: 'Blue pen' });
    stubBacklog([line, backlogLine({ line_id: 'l-lan', user_sub: 'u-lan', full_name: 'Vo Thi Lan', department: null, user_status: 'locked' })]);
    renderApp(ADMIN, '/admin/backlog');
    expect(await screen.findByRole('heading', { level: 1, name: 'Còn nợ' })).toBeInTheDocument();
    expect(await screen.findAllByRole('button', { name: /Hủy nợ/ })).not.toHaveLength(0);
    await english();
    expect(await screen.findByRole('heading', { level: 1, name: 'Outstanding' })).toBeInTheDocument();
    expect(await screen.findAllByText('Blue pen')).not.toHaveLength(0);
    noVietnamese();
    await userEvent.click(screen.getAllByRole('button', { name: /^Cancel debt/ })[0]);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    noVietnamese();
  });

  it('Báo cáo: vi có "Đặt mua" và "In trình ký"; en không còn chữ Việt (bảng, Xuất lẻ, bản chốt)', async () => {
    const report = reportFixture({
      byDepartment: [{ department: 'Inspection Team', people: [{ user_sub: 'u-duc', full_name: 'Pham Van Duc', lines: [{ name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'cay', qty: 12 }] }] }],
      custom: [{ key: 'custom:tape', name: 'Double tape', unit: 'cuon', requested: 4, backlog_prev: 1, stock: null, need: 5, people: 2 }],
      byItem: reportFixture().byItem.map((r) => ({ ...r, name: r.item_id === 'item-glue' ? 'Hồ dán' : r.name, name_en: r.item_id === 'item-glue' ? 'Glue' : r.name_en })),
      issues: [{ ...ISSUE, reason: 'Weekly meeting' }],
    });
    stubReports({ reports: { '2026-10': report }, snapshots: [snapshotRow({ created_by_name: 'Tran Thi Binh' })] });
    renderApp(ADMIN, '/admin/reports');
    expect(await screen.findByRole('button', { name: 'In trình ký' })).toBeInTheDocument();
    expect(await screen.findByRole('spinbutton', { name: 'Đặt mua Bút bi xanh' })).toBeInTheDocument();
    await english();
    expect(await screen.findByRole('spinbutton', { name: 'Order Blue pen' })).toBeInTheDocument();
    expect(await screen.findByText('Tran Thi Binh')).toBeInTheDocument();
    noVietnamese();
  });

  it('Trang in: en không còn chữ Việt', async () => {
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
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(jsonResponse(200, url.includes('/snapshots/') ? data : { items: [], next_cursor: null, unread_count: 0 }))));
    renderApp(ADMIN, `/admin/reports/snapshots/${data.id}/print`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Báo cáo văn phòng phẩm tháng 10/2026' })).toBeInTheDocument();
    await english();
    expect(await screen.findByRole('heading', { level: 1, name: /Stationery report/ })).toBeInTheDocument();
    noVietnamese();
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
    const entry = { period_ym: '2026-10', line_count: 3, total_qty: 10, delivered_qty: 6, remaining_qty: 4, cancelled_qty: 0, custom: { pending: 1, accepted: 0, converted: 2, rejected: 1 } };
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
        if (url.startsWith('/api/me/issues')) return Promise.resolve(jsonResponse(200, { items: [{ id: 'm-1', item_id: 'i-1', item_name: 'Bút bi', item_name_en: 'Ballpoint pen', unit: 'cai', qty: 2, note: 'New hire', created_at: '2026-10-20T03:30:00Z' }], next_cursor: null }));
        if (url.startsWith('/api/me/requests')) return Promise.resolve(jsonResponse(200, { items: [entry], next_cursor: null }));
        return Promise.resolve(jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }));
      }),
    );
    renderApp(makeMe('member'), '/history');
    expect(await screen.findByText('Tháng 10/2026')).toBeInTheDocument();
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
    expect(await screen.findByText('Giao hàng')).toBeInTheDocument();
    await english();
    const table = await screen.findByRole('table');
    expect(within(table).getByText('Delivered')).toHaveAttribute('title', 'line.delivered');
    expect(within(table).getByText('Backlog cancelled')).toBeInTheDocument();
    expect(document.querySelector('datalist option[value="line.cancel_remaining"]')).toHaveAttribute('label', 'Backlog cancelled');
    noVietnamese();
  });
});
