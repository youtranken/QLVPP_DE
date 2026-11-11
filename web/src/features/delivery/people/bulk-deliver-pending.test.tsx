import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import { BulkDeliverDialog } from './bulk-deliver-dialog';
import { bulkPlan } from './bulk-plan';
import type { DeliveryPerson } from './delivery-people.api';
import { person, pLine } from './people-fixtures';

const URL = '/api/admin/deliveries/bulk';
const ASK = /^Món ngoài danh mục chưa duyệt:/;

// fail: request_id trả lỗi STOCK_INSUFFICIENT, còn lại ok
function stub(fail = new Set<string>()) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (String(url) !== URL) return Promise.resolve(jsonResponse(200, {}));
    const body = JSON.parse(String(init?.body)) as { requests: { request_id: string; lines: unknown[] }[] };
    return Promise.resolve(
      jsonResponse(200, {
        results: body.requests.map((r) =>
          fail.has(r.request_id) ? { request_id: r.request_id, ok: false, code: 'STOCK_INSUFFICIENT', available: 0 } : { request_id: r.request_id, ok: true, delivered_units: r.lines.length, request_complete: false },
        ),
      }),
    );
  });
  vi.stubGlobal('fetch', f);
  return f;
}
const bodies = (f: ReturnType<typeof stub>) => f.mock.calls.filter(([u]) => String(u) === URL).map(([, i]) => JSON.parse(String(i?.body)));

function open(people: DeliveryPerson[]) {
  const props = { onClose: vi.fn(), onDone: vi.fn() };
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <ConfirmProvider>
            <BulkDeliverDialog plan={bulkPlan(people, people)} people={people} {...props} />
          </ConfirmProvider>
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
  return props;
}

const custom = (i: number, request_id = 'r-1') => pLine({ line_id: `rv${i}`, request_id, item_id: null, name: `Món chờ ${i}`, review_status: 'pending', stock_qty: null });
const giver = (sub: string, request_id: string, extra = [] as ReturnType<typeof pLine>[]) =>
  person({ user_sub: sub, full_name: sub, request_id, lines: [pLine({ line_id: `l-${sub}`, request_id, stock_qty: 9 }), ...extra.map((l) => ({ ...l, request_id }))] });

afterEach(() => vi.unstubAllGlobals());

describe('BulkDeliverDialog — món ngoài danh mục chưa duyệt', () => {
  it('có món chờ → Xác nhận giao hỏi lại: tối đa 5 tên + "(và k món nữa)", focus ở Quay lại; Quay lại không gửi', async () => {
    const f = stub();
    open([giver('A', 'r-a', [custom(1), custom(2), custom(3)]), giver('B', 'r-b', [custom(4), custom(5), custom(6), custom(7)])]);
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận giao' }));
    const box = await screen.findByRole('dialog', { description: ASK });
    expect(box).toHaveAccessibleDescription('Món ngoài danh mục chưa duyệt: Món chờ 1, Món chờ 2, Món chờ 3, Món chờ 4, Món chờ 5 (và 2 món nữa). Giao sẽ ghi Không mua cho các món này.');
    await waitFor(() => expect(within(box).getByRole('button', { name: 'Quay lại' })).toHaveFocus());
    await userEvent.click(within(box).getByRole('button', { name: 'Quay lại' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { description: ASK })).toBeNull());
    expect(bodies(f)).toEqual([]);
  });

  it('xác nhận → POST kèm reject_line_ids đúng phiếu của từng người', async () => {
    const f = stub();
    const props = open([giver('A', 'r-a', [custom(1)]), giver('B', 'r-b')]);
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận giao' }));
    await userEvent.click(within(await screen.findByRole('dialog', { description: ASK })).getByRole('button', { name: 'Xác nhận giao' }));
    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    expect(bodies(f)).toEqual([
      {
        requests: [
          { request_id: 'r-a', lines: [{ line_id: 'l-A', qty: 3, expected_delivered_qty: 0 }], reject_line_ids: ['rv1'] },
          { request_id: 'r-b', lines: [{ line_id: 'l-B', qty: 3, expected_delivered_qty: 0 }] },
        ],
      },
    ]);
  });

  // A: nợ tháng 9 ở phiếu r-a0 + phiếu tháng này r-a1 chỉ còn món chờ; B giao bình thường
  const withDebt = () =>
    person({
      user_sub: 'A',
      full_name: 'A',
      request_id: 'r-a1',
      lines: [pLine({ line_id: 'd', request_id: 'r-a0', period_ym: '2026-09', is_debt: true, item_id: 'i-a4', name: 'Giấy A4', qty: 1, remaining_qty: 1, stock_qty: 9 }), custom(1, 'r-a1')],
    });
  const confirmAll = async () => {
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận giao' }));
    await userEvent.click(within(await screen.findByRole('dialog', { description: ASK })).getByRole('button', { name: 'Xác nhận giao' }));
  };

  it('phiếu chỉ có món chờ đi sau, khi phiếu nợ của cùng người đã giao xong; kết quả gộp một dòng mỗi người, không có dòng "Đã giao 0"', async () => {
    const f = stub(new Set(['r-b']));
    open([withDebt(), giver('B', 'r-b')]);
    await confirmAll();
    const status = await screen.findByRole('status');
    expect(bodies(f)).toEqual([
      { requests: [{ request_id: 'r-a0', lines: [{ line_id: 'd', qty: 1, expected_delivered_qty: 0 }] }] },
      { requests: [{ request_id: 'r-a1', lines: [], reject_line_ids: ['rv1'] }, { request_id: 'r-b', lines: [{ line_id: 'l-B', qty: 3, expected_delivered_qty: 0 }] }] },
    ]);
    const rows = within(status).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('AĐã giao 1 · 1 món ghi Không mua');
    expect(rows[0]).toHaveClass('is-ok');
    expect(rows[1]).toHaveClass('is-err');
    expect(within(status).queryByText('Đã giao 0')).toBeNull();
  });

  it('phiếu nợ của người đó giao lỗi → không gửi phần ghi Không mua, dòng kết quả nói rõ; người khác không ảnh hưởng', async () => {
    const f = stub(new Set(['r-a0']));
    open([withDebt(), giver('B', 'r-b', [custom(2)])]);
    await confirmAll();
    const status = await screen.findByRole('status');
    expect(bodies(f)).toEqual([
      { requests: [{ request_id: 'r-a0', lines: [{ line_id: 'd', qty: 1, expected_delivered_qty: 0 }] }] },
      { requests: [{ request_id: 'r-b', lines: [{ line_id: 'l-B', qty: 3, expected_delivered_qty: 0 }], reject_line_ids: ['rv2'] }] },
    ]);
    const rows = within(status).getAllByRole('listitem');
    expect(rows[0]).toHaveClass('is-err');
    expect(rows[0]).toHaveTextContent('Chưa ghi Không mua vì có món giao lỗi');
    expect(rows[1]).toHaveTextContent('BĐã giao 1 · 1 món ghi Không mua');
  });

  it('không có món chờ → không hỏi lại', async () => {
    const f = stub();
    const props = open([giver('A', 'r-a')]);
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận giao' }));
    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    expect(screen.queryByText(ASK)).toBeNull();
    expect(bodies(f)).toHaveLength(1);
  });
});
