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

const shell = (node: React.ReactNode) => (
  <MeContext.Provider value={makeMe('admin')}>
    <MemoryRouter>
      <ToastProvider>{node}</ToastProvider>
    </MemoryRouter>
  </MeContext.Provider>
);
const wrap = (node: React.ReactNode) => renderWithI18n(shell(node));

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
  it('người đã nghỉ: nút đóng hộp ghi "Đóng" (không "Hủy" cạnh "Hủy phiếu" dễ nhầm)', () => {
    open(LEFT);
    const d = within(screen.getByRole('dialog'));
    expect(d.getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
    expect(d.queryByRole('button', { name: 'Hủy' })).toBeNull();
  });
  it('người đang làm: không có "Hủy phiếu"', () => {
    open(ACTIVE);
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Hủy phiếu' })).toBeNull();
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
  });
});

describe('Hộp xác nhận Hủy phiếu', () => {
  function stub(fail?: string, ok: object = { cancelled_now: 9, lines: [{ id: 'l1' }, { id: 'l2' }], undo_id: 'undo-u-n' }) {
    let failures = fail ? 1 : 0;
    const f = vi.fn((url: string, _init?: RequestInit) => {
      const u = String(url);
      if (u.endsWith('/undo/cancel')) return Promise.resolve(jsonResponse(200, { undone: 3 }));
      if (u.includes('/cancel-remaining')) {
        if (failures-- > 0) return Promise.resolve(jsonResponse(409, { code: fail, message: 'x' }));
        return Promise.resolve(jsonResponse(200, ok));
      }
      return Promise.resolve(jsonResponse(200, {}));
    });
    vi.stubGlobal('fetch', f);
    return f;
  }
  const show = () => {
    const onDone = vi.fn();
    const view = wrap(<CancelRequestDialog person={LEFT} onClose={vi.fn()} onDone={onDone} />);
    const reload = (p: DeliveryPerson) => view.rerender(shell(<CancelRequestDialog person={p} onClose={vi.fn()} onDone={onDone} />));
    return Object.assign(onDone, { reload });
  };
  const posts = (f: ReturnType<typeof stub>) =>
    f.mock.calls.filter(([u]) => String(u).includes('/cancel-remaining')).map(([u, init]) => [String(u), JSON.parse(String(init?.body))]);

  it('"Các món sau sẽ không giao nữa:" + món còn nợ với số (không dấu +, không món chờ duyệt), ghi phần đã giao giữ nguyên', () => {
    stub();
    show();
    const dlg = screen.getByRole('dialog', { name: 'Hủy phiếu của Trần Văn Nam?' });
    expect(within(dlg).getAllByRole('row')).toHaveLength(3);
    expect(within(dlg).getByText('Các món sau sẽ không giao nữa:')).toBeInTheDocument();
    expect(within(dlg).getByText(/^6 /)).toBeInTheDocument();
    expect(within(dlg).queryByText(/^\+/)).toBeNull();
    expect(within(dlg).queryByText(/Tủ/)).toBeNull();
    expect(within(dlg).queryByText('Món lạ')).toBeNull();
    expect(within(dlg).getByText(/giữ nguyên trong lịch sử/)).toBeInTheDocument();
  });

  it('bấm Hủy phiếu → MỘT POST theo người gồm mọi phiếu (tháng này + nợ cũ) với số đang hiện; toast lấy số món từ kết quả server "(2 món chưa giao)" có Hoàn tác gọi undo/cancel', async () => {
    const f = stub();
    const onDone = show();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy phiếu' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(posts(f)).toEqual([
      [
        '/api/admin/users/u-n/cancel-remaining',
        { expected_lines: [{ line_id: 'l1', remaining: 6 }, { line_id: 'l2', remaining: 2 }, { line_id: 'l3', remaining: 1 }] },
      ],
    ]);
    expect(await screen.findByText('Đã hủy phiếu của Trần Văn Nam (2 món chưa giao).')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Hoàn tác/, hidden: true }));
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).endsWith('/undo/cancel'))).toBe(true));
    const undo = f.mock.calls.find(([u]) => String(u).endsWith('/undo/cancel'))!;
    expect(JSON.parse(String(undo[1]?.body))).toEqual({ ids: ['undo-u-n'] });
  });

  it('STALE_UPDATE → báo phiếu vừa đổi, nạp lại món theo dữ liệu mới, mở lại nút; bấm lại gửi số mới', async () => {
    const f = stub('STALE_UPDATE');
    const onDone = show();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy phiếu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Phiếu vừa đổi ở nơi khác — đã tải lại số mới, xem lại rồi bấm Hủy phiếu.');
    expect(onDone).not.toHaveBeenCalled();
    onDone.reload({ ...LEFT, lines: LEFT.lines.map((l) => (l.line_id === 'l1' ? { ...l, delivered_qty: 5, remaining_qty: 5 } : l)) });
    const dlg = screen.getByRole('dialog');
    expect(await within(dlg).findByText(/^5 /)).toBeInTheDocument();
    expect(within(dlg).queryByText(/^6 /)).toBeNull();
    const confirm = screen.getByRole('button', { name: 'Hủy phiếu' });
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(posts(f)[1][1].expected_lines[0]).toEqual({ line_id: 'l1', remaining: 5 });
  });

  it('server trả cancelled_now 0 (đã hủy ở nơi khác) → "Phiếu này đã được hủy trước đó.", không Hoàn tác', async () => {
    stub(undefined, { cancelled_now: 0, lines: [], undo_id: null });
    const onDone = show();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy phiếu' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(await screen.findByText('Phiếu này đã được hủy trước đó.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hoàn tác/, hidden: true })).toBeNull();
  });

  it('sau STALE chỉ chụp lại một lần: dữ liệu đổi tiếp lần nữa không thay danh sách đang hiện', async () => {
    stub('STALE_UPDATE');
    const onDone = show();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy phiếu' }));
    await screen.findByRole('alert');
    const at = (n: number) => ({ ...LEFT, lines: LEFT.lines.map((l) => (l.line_id === 'l1' ? { ...l, remaining_qty: n } : l)) });
    onDone.reload(at(5));
    const dlg = screen.getByRole('dialog');
    expect(await within(dlg).findByText(/^5 /)).toBeInTheDocument();
    onDone.reload(at(4));
    expect(within(dlg).getByText(/^5 /)).toBeInTheDocument();
    expect(within(dlg).queryByText(/^4 /)).toBeNull();
  });
});
