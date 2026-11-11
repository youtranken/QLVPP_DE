import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ToastProvider } from '@/ui/toast-provider';
import { BulkDeliverDialog } from './bulk-deliver-dialog';
import { bulkPlan } from './bulk-plan';
import type { DeliveryPerson } from './delivery-people.api';
import { person, pLine } from './people-fixtures';

const URL = '/api/admin/deliveries/bulk';
const ASK = /^Món ngoài danh mục chưa duyệt:/;

function stub() {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (String(url) !== URL) return Promise.resolve(jsonResponse(200, {}));
    const body = JSON.parse(String(init?.body)) as { requests: { request_id: string }[] };
    return Promise.resolve(jsonResponse(200, { results: body.requests.map((r) => ({ request_id: r.request_id, ok: true, delivered_units: 1, request_complete: false })) }));
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
          <BulkDeliverDialog plan={bulkPlan(people, people)} people={people} {...props} />
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
  it('có món chờ → Xác nhận giao hỏi lại: tối đa 5 tên + "(và k món nữa)", focus ở Hủy; Hủy không gửi', async () => {
    const f = stub();
    open([giver('A', 'r-a', [custom(1), custom(2), custom(3)]), giver('B', 'r-b', [custom(4), custom(5), custom(6), custom(7)])]);
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận giao' }));
    const box = await screen.findByRole('dialog', { description: ASK });
    expect(box).toHaveAccessibleDescription('Món ngoài danh mục chưa duyệt: Món chờ 1, Món chờ 2, Món chờ 3, Món chờ 4, Món chờ 5 (và 2 món nữa). Giao sẽ ghi Không mua cho các món này.');
    await waitFor(() => expect(within(box).getByRole('button', { name: 'Hủy' })).toHaveFocus());
    await userEvent.click(within(box).getByRole('button', { name: 'Hủy' }));
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

  it('không có món chờ → không hỏi lại', async () => {
    const f = stub();
    const props = open([giver('A', 'r-a')]);
    await userEvent.click(screen.getByRole('button', { name: 'Xác nhận giao' }));
    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    expect(screen.queryByText(ASK)).toBeNull();
    expect(bodies(f)).toHaveLength(1);
  });
});
