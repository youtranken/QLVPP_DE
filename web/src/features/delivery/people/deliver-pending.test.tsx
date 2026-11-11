import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import type { DeliveryPerson } from './delivery-people.api';
import { DeliverDialog } from './deliver-dialog';
import { person, pLine } from './people-fixtures';

const BULK = '/api/admin/deliveries/bulk';
type Reply = (url: string, body: Record<string, unknown>) => Response;
const OK: Reply = (u, b) => (u === BULK ? jsonResponse(200, { results: (b.requests as { request_id: string }[]).map((r) => ({ request_id: r.request_id, ok: true, delivered_units: 0, request_complete: false })) }) : jsonResponse(200, {}));

function stub(reply: Reply = OK) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return Promise.resolve(reply(String(url), JSON.parse(String(init.body))));
    return Promise.resolve(jsonResponse(200, {}));
  });
  vi.stubGlobal('fetch', f);
  return f;
}
const posts = (f: ReturnType<typeof stub>) => f.mock.calls.filter(([, i]) => i?.method === 'POST').map(([u, i]) => [String(u), JSON.parse(String(i?.body))] as const);

function open(p: DeliveryPerson) {
  const props = { onDone: vi.fn(), onClose: vi.fn(), onOpenPerson: vi.fn() };
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <ConfirmProvider>
            <DeliverDialog person={p} people={[p]} {...props} />
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
  return props;
}

const main = () => screen.getByRole('dialog', { name: 'Giao cho Nguyễn Văn An?' });
const confirmBtn = () => within(main()).getByRole('button', { name: /^(Xác nhận giao|Đang giao…)/ });
// Hộp hỏi lại nằm trên hộp giao: Radix ẩn hộp dưới khỏi cây a11y nên chỉ còn một dialog
const ask = () => screen.getByRole('dialog', { description: /^Món ngoài danh mục chưa duyệt:/ });

const cur = pLine({ line_id: 'c', qty: 2, remaining_qty: 2, stock_qty: 9 });
const pendingA = pLine({ line_id: 'rv1', item_id: null, name: 'Dây rút nhựa 20cm', review_status: 'pending', stock_qty: null });
const pendingB = pLine({ line_id: 'rv2', item_id: null, name: 'Pin sạc AA', review_status: 'pending', stock_qty: null });
const debt = pLine({ line_id: 'd', request_id: 'r-0', period_ym: '2026-09', is_debt: true, item_id: 'i-a4', name: 'Giấy A4', qty: 1, remaining_qty: 1, stock_qty: 9 });

afterEach(() => vi.unstubAllGlobals());

describe('DeliverDialog — món ngoài danh mục chưa duyệt', () => {
  it('bấm Xác nhận giao → hỏi lại: liệt kê tên món, focus ở Hủy, hộp có mô tả; chưa gửi gì; Hủy → về hộp giao, không gửi', async () => {
    const f = stub();
    open(person({ lines: [cur, pendingA, pendingB] }));
    await userEvent.click(confirmBtn());
    const box = await screen.findByRole('dialog', { description: /^Món ngoài danh mục chưa duyệt:/ });
    expect(box).toHaveAccessibleName('Giao cho Nguyễn Văn An?');
    expect(box).toHaveAccessibleDescription('Món ngoài danh mục chưa duyệt: Dây rút nhựa 20cm, Pin sạc AA. Giao sẽ ghi Không mua cho các món này.');
    await waitFor(() => expect(within(box).getByRole('button', { name: 'Hủy' })).toHaveFocus());
    expect(posts(f)).toEqual([]);
    await userEvent.click(within(box).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { description: /^Món ngoài danh mục chưa duyệt:/ })).toBeNull());
    expect(main()).toBeInTheDocument();
    expect(posts(f)).toEqual([]);
  });

  it('xác nhận → một POST giao nhiều phiếu: dòng giao cùng phiếu + reject_line_ids đúng các món đang hiện; không gọi giao từng dòng; xong → onDone', async () => {
    const f = stub();
    const props = open(person({ lines: [cur, pendingA, pendingB] }));
    await userEvent.click(confirmBtn());
    await userEvent.click(within(ask()).getByRole('button', { name: 'Xác nhận giao' }));
    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    expect(posts(f)).toEqual([[BULK, { requests: [{ request_id: 'r-1', lines: [{ line_id: 'c', qty: 2, expected_delivered_qty: 0 }], reject_line_ids: ['rv1', 'rv2'] }] }]]);
  });

  it('nợ tháng trước ở phiếu khác: dòng nợ giao từng dòng như cũ; phiếu tháng này chỉ còn món chờ → lines rỗng + reject_line_ids', async () => {
    const f = stub();
    const props = open(person({ lines: [debt, pendingA] }));
    await userEvent.click(confirmBtn());
    await userEvent.click(within(ask()).getByRole('button', { name: 'Xác nhận giao' }));
    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    expect(posts(f)).toEqual([
      ['/api/admin/lines/d/deliver', { qty: 1, expected_delivered_qty: 0 }],
      [BULK, { requests: [{ request_id: 'r-1', lines: [], reject_line_ids: ['rv1'] }] }],
    ]);
  });

  it('phiếu lỗi REJECT_LINES_STALE (món vừa được duyệt nơi khác) → hộp ở lại, ✗ món đó với lý do, dòng cùng phiếu "Chưa gửi"', async () => {
    stub((u, b) =>
      u === BULK
        ? jsonResponse(200, { results: [{ request_id: (b.requests as { request_id: string }[])[0].request_id, ok: false, code: 'REJECT_LINES_STALE', line_id: 'rv1' }] })
        : jsonResponse(200, {}),
    );
    const props = open(person({ lines: [cur, pendingA] }));
    await userEvent.click(confirmBtn());
    await userEvent.click(within(ask()).getByRole('button', { name: 'Xác nhận giao' }));
    const status = await within(main()).findByRole('status');
    await within(status).findByText('Món ngoài danh mục vừa được duyệt hoặc từ chối ở nơi khác — mở lại hộp giao.');
    expect(within(status).getByText('Dây rút nhựa 20cm')).toBeInTheDocument();
    expect(within(status).getByText('Chưa gửi')).toBeInTheDocument();
    expect(props.onDone).not.toHaveBeenCalled();
  });

  it('dòng nợ (phiếu khác, đi trước) giao lỗi → không gửi phần ghi Không mua; món chờ báo chưa ghi Không mua', async () => {
    const f = stub((u) => (u === '/api/admin/lines/d/deliver' ? jsonResponse(409, { code: 'STOCK_INSUFFICIENT', available: 0 }) : OK(u, {})));
    const props = open(person({ lines: [debt, pendingA] }));
    await userEvent.click(confirmBtn());
    await userEvent.click(within(ask()).getByRole('button', { name: 'Xác nhận giao' }));
    const status = await within(main()).findByRole('status');
    expect(posts(f)).toEqual([['/api/admin/lines/d/deliver', { qty: 1, expected_delivered_qty: 0 }]]);
    await within(status).findByText('Chưa ghi Không mua vì có món giao lỗi');
    expect(props.onDone).not.toHaveBeenCalled();
  });

  it('dòng nợ giao lỗi, phiếu tháng này còn dòng giao → dòng đó giao từng dòng như cũ, không kèm reject_line_ids', async () => {
    const f = stub((u) => (u === '/api/admin/lines/d/deliver' ? jsonResponse(409, { code: 'STOCK_INSUFFICIENT', available: 0 }) : OK(u, {})));
    open(person({ lines: [debt, cur, pendingA] }));
    await userEvent.click(confirmBtn());
    await userEvent.click(within(ask()).getByRole('button', { name: 'Xác nhận giao' }));
    const status = await within(main()).findByRole('status');
    expect(posts(f)).toEqual([
      ['/api/admin/lines/d/deliver', { qty: 1, expected_delivered_qty: 0 }],
      ['/api/admin/lines/c/deliver', { qty: 2, expected_delivered_qty: 0 }],
    ]);
    await within(status).findByText('Chưa ghi Không mua vì có món giao lỗi');
  });

  it('không có món chờ duyệt → không hỏi lại, giao từng dòng như cũ', async () => {
    const f = stub();
    const props = open(person({ lines: [cur] }));
    await userEvent.click(confirmBtn());
    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    expect(screen.queryByText(/^Món ngoài danh mục chưa duyệt:/)).toBeNull();
    expect(posts(f)).toEqual([['/api/admin/lines/c/deliver', { qty: 2, expected_delivered_qty: 0 }]]);
  });
});
