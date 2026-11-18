import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ToastProvider } from '@/ui/toast-provider';
import type { DeliveryPerson } from './delivery-people.api';
import { CancelRequestDialog } from './cancel-request-dialog';
import { DeliverDialog } from './deliver-dialog';
import { PeopleTable } from './people-table';
import { person, pLine } from './people-fixtures';

afterEach(() => vi.unstubAllGlobals());

const LEFT = person({
  user_sub: 'u-n',
  full_name: 'Trần Văn Nam',
  user_status: 'locked',
  lines: [
    pLine({ line_id: 'l1', request_id: 'r-cur', qty: 10, delivered_qty: 4, remaining_qty: 6, name: 'Bút bi' }),
    pLine({ line_id: 'l2', request_id: 'r-cur', item_id: 'i-a4', qty: 2, remaining_qty: 2, name: 'Giấy A4' }),
    pLine({ line_id: 'l3', request_id: 'r-old', item_id: 'i-clip', is_debt: true, qty: 3, remaining_qty: 1, delivered_qty: 2, name: 'Kẹp giấy' }),
    pLine({ line_id: 'l4', request_id: 'r-cur', item_id: null, review_status: 'pending', remaining_qty: 1, name: 'Món lạ' }),
  ],
});
const ACTIVE = person({ user_sub: 'u-a', full_name: 'Nguyễn Văn An' });
const LEFT_DONE = person({ user_sub: 'u-d', full_name: 'Lê Thị Xong', user_status: 'locked', status: 'done', lines: [pLine({ remaining_qty: 0, delivered_qty: 3 })] });

const wrap = (node: React.ReactNode) =>
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>{node}</ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );

function table(rows: DeliveryPerson[]) {
  const onCancelRequest = vi.fn();
  const fns = { onToggle: vi.fn(), onToggleAll: vi.fn(), onView: vi.fn(), onDeliver: vi.fn(), onHistory: vi.fn() };
  renderWithI18n(<PeopleTable rows={rows} shortages={new Map()} selected={new Set()} selectable={() => true} canDeliver={() => true} onCancelRequest={onCancelRequest} {...fns} />);
  return onCancelRequest;
}

describe('Hủy phiếu người đã nghỉ — nút ở bảng Giao hàng', () => {
  it('người đã nghỉ còn nợ có nút "Hủy phiếu" cạnh "Giao"; người đang làm và người nghỉ đã giao xong không có', async () => {
    const onCancel = table([LEFT, ACTIVE, LEFT_DONE]);
    expect(screen.getAllByRole('button', { name: /^Hủy phiếu/ })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Hủy phiếu, Trần Văn Nam' }));
    expect(onCancel).toHaveBeenCalledWith('u-n');
  });
});

describe('Hủy phiếu người đã nghỉ — nút ở hộp Giao', () => {
  const open = (p: DeliveryPerson, onCancelRequest = vi.fn()) => {
    wrap(<DeliverDialog person={p} people={[p]} onDone={vi.fn()} onClose={vi.fn()} onOpenPerson={vi.fn()} onCancelRequest={onCancelRequest} />);
    return onCancelRequest;
  };
  it('người đã nghỉ: chân hộp có "Hủy phiếu", bấm gọi mở hộp xác nhận', async () => {
    const onCancel = open(LEFT);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy phiếu' }));
    expect(onCancel).toHaveBeenCalled();
  });
  it('người đang làm: không có "Hủy phiếu"', () => {
    open(ACTIVE);
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Hủy phiếu' })).toBeNull();
  });
});

describe('Hộp xác nhận Hủy phiếu', () => {
  function stub(fail?: string) {
    const f = vi.fn((url: string, _init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/undo/cancel')) return Promise.resolve(jsonResponse(200, { undone: 3 }));
      if (u.includes('/cancel-remaining')) {
        if (fail) return Promise.resolve(jsonResponse(409, { code: fail, message: 'x' }));
        return Promise.resolve(jsonResponse(200, { cancelled_now: 1, undo_id: `undo-${u.split('/')[4]}` }));
      }
      return Promise.resolve(jsonResponse(200, {}));
    });
    vi.stubGlobal('fetch', f);
    return f;
  }
  const show = () => {
    const onDone = vi.fn();
    wrap(<CancelRequestDialog person={LEFT} onClose={vi.fn()} onDone={onDone} />);
    return onDone;
  };
  const posts = (f: ReturnType<typeof stub>) =>
    f.mock.calls.filter(([u]) => String(u).includes('/cancel-remaining')).map(([u, init]) => [String(u), JSON.parse(String(init?.body))]);

  it('liệt kê món còn nợ với số trả về Tủ (không món chờ duyệt), ghi phần đã giao giữ nguyên', () => {
    stub();
    show();
    const dlg = screen.getByRole('dialog', { name: 'Hủy phiếu của Trần Văn Nam?' });
    expect(within(dlg).getAllByRole('row')).toHaveLength(3);
    expect(within(dlg).getByText(/^\+6/)).toBeInTheDocument();
    expect(within(dlg).queryByText('Món lạ')).toBeNull();
    expect(within(dlg).getByText(/giữ nguyên trong lịch sử/)).toBeInTheDocument();
  });

  it('bấm Hủy phiếu → mỗi phiếu một POST với expected_lines đang hiện; toast "trả 3 món về Tủ" có Hoàn tác gọi undo/cancel', async () => {
    const f = stub();
    const onDone = show();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy phiếu' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(posts(f)).toEqual([
      ['/api/admin/requests/r-cur/cancel-remaining', { expected_lines: [{ line_id: 'l1', remaining: 6 }, { line_id: 'l2', remaining: 2 }] }],
      ['/api/admin/requests/r-old/cancel-remaining', { expected_lines: [{ line_id: 'l3', remaining: 1 }] }],
    ]);
    expect(await screen.findByText('Đã hủy phiếu của Trần Văn Nam, trả 3 món về Tủ.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hoàn tác/, hidden: true }));
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).endsWith('/undo/cancel'))).toBe(true));
    const undo = f.mock.calls.find(([u]) => String(u).endsWith('/undo/cancel'))!;
    expect(JSON.parse(String(undo[1]?.body))).toEqual({ ids: ['undo-r-cur', 'undo-r-old'] });
  });

  it('STALE_UPDATE → báo phiếu vừa đổi ngay trong hộp, nút Hủy phiếu khóa, không đóng hộp', async () => {
    stub('STALE_UPDATE');
    const onDone = show();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy phiếu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Phiếu vừa đổi ở nơi khác');
    expect(screen.getByRole('button', { name: 'Hủy phiếu' })).toBeDisabled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
