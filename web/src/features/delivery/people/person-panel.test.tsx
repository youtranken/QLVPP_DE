import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ToastProvider } from '@/ui/toast-provider';
import type { DeliveryPerson } from './delivery-people.api';
import { PersonPanel } from './person-panel';
import { A, B, C, PEOPLE, person, pLine } from './people-fixtures';

type Deliver = (url: string, body: { qty: number; expected_delivered_qty: number }) => Response;

function stub(deliver: Deliver = () => jsonResponse(200, { request_complete: false })) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    if (String(url).endsWith('/deliver')) return Promise.resolve(deliver(String(url), JSON.parse(String(init?.body))));
    return Promise.resolve(jsonResponse(200, {}));
  });
  vi.stubGlobal('fetch', f);
  return f;
}
const deliverCalls = (f: ReturnType<typeof stub>) =>
  f.mock.calls.filter(([u]) => String(u).endsWith('/deliver')).map(([u, i]) => [String(u), JSON.parse(String(i?.body))] as const);

function open(p: DeliveryPerson, extra: { next?: DeliveryPerson; onNext?: (s: string) => void } = {}) {
  return renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <PersonPanel ym="2026-10" person={p} people={PEOPLE} {...extra} />
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
}
const spin = (name: string) => screen.getByRole('spinbutton', { name }) as HTMLInputElement;

afterEach(() => vi.unstubAllGlobals());

describe('PersonPanel — thứ tự và mặc định', () => {
  it('nhóm "Nợ kỳ trước" đứng trước "Tháng 10"; dòng nợ đứng trước dòng tháng', () => {
    stub();
    open(B);
    const heads = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(heads).toEqual(['Nợ kỳ trước', 'Tháng 10']);
    const names = screen.getAllByRole('spinbutton').map((s) => s.getAttribute('aria-label'));
    expect(names).toEqual(['Giao Giấy A4', 'Giao Bút bi xanh']);
  });

  it('không có nợ → không có nhóm "Nợ kỳ trước"; người chỉ có nợ → không có nhóm "Tháng 10"', () => {
    stub();
    const { unmount } = open(A);
    expect(screen.queryByRole('heading', { name: 'Nợ kỳ trước' })).toBeNull();
    unmount();
    open(C);
    expect(screen.getByRole('heading', { name: 'Nợ kỳ trước' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tháng 10' })).toBeNull();
  });

  it('B cần 10 bút, tủ 7 → stepper mặc định 7, cảnh báo "Giao 7, còn nợ 3" và "Còn 1 người chờ món này, cần thêm 3"', () => {
    stub();
    open(B);
    expect(spin('Giao Bút bi xanh').value).toBe('7');
    expect(screen.getByText('Cần 10 · Tủ còn 7')).toBeInTheDocument();
    expect(screen.getByText('Giao 7, còn nợ 3')).toBeInTheDocument();
    expect(screen.getByText('Còn 1 người chờ món này, cần thêm 3')).toBeInTheDocument();
  });

  it('đủ hàng → không cảnh báo; hạ xuống dưới mức cần thì cảnh báo hiện theo số mới', async () => {
    stub();
    open(A);
    expect(spin('Giao Bút bi xanh').value).toBe('3');
    expect(screen.queryByText(/còn nợ/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Giao Bút bi xanh' }));
    expect(screen.getByText('Giao 2, còn nợ 1')).toBeInTheDocument();
    expect(screen.getByText('Còn 1 người chờ món này, cần thêm 10')).toBeInTheDocument();
  });

  it('không ai khác chờ món → cảnh báo nợ nhưng không có câu "Còn n người chờ"', () => {
    stub();
    const solo = person({ lines: [pLine({ item_id: 'i-solo', remaining_qty: 5, qty: 5, stock_qty: 2 })] });
    open(solo);
    expect(screen.getByText('Giao 2, còn nợ 3')).toBeInTheDocument();
    expect(screen.queryByText(/người chờ món này/)).toBeNull();
  });
});

describe('PersonPanel — biên stepper', () => {
  it.each([
    ['tủ 7 < cần 10', 10, 7, 7],
    ['tủ = cần', 10, 10, 10],
    ['tủ 11 > cần 10', 10, 11, 10],
  ])('%s → mặc định %i/%i = %i và nút Thêm bị vô hiệu', (_n, remaining, stock, want) => {
    stub();
    open(person({ lines: [pLine({ remaining_qty: remaining, qty: remaining, stock_qty: stock })] }));
    expect(spin('Giao Bút bi xanh').value).toBe(String(want));
    expect(screen.getByRole('button', { name: 'Thêm Giao Bút bi xanh' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bớt Giao Bút bi xanh' })).toBeEnabled();
  });

  it('stepper xuống tới 0 (bỏ qua dòng): từ 2 bấm Bớt hai lần → 0, nút Bớt vô hiệu ở 0', async () => {
    stub();
    open(person({ lines: [pLine({ remaining_qty: 2, qty: 2, stock_qty: 9 })] }));
    const dec = screen.getByRole('button', { name: 'Bớt Giao Bút bi xanh' });
    await userEvent.click(dec);
    expect(spin('Giao Bút bi xanh').value).toBe('1');
    expect(dec).toBeEnabled();
    await userEvent.click(dec);
    expect(spin('Giao Bút bi xanh').value).toBe('0');
    expect(dec).toBeDisabled();
    expect(screen.getByText('Giao 0, còn nợ 2')).toBeInTheDocument();
  });

  it('mọi dòng đặt 0 → nút Giao vô hiệu; đặt lại 1 → bật', async () => {
    stub();
    open(person({ lines: [pLine({ remaining_qty: 1, qty: 1, stock_qty: 9 })] }));
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Giao Bút bi xanh' }));
    expect(screen.getByRole('button', { name: 'Giao' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Giao Bút bi xanh' }));
    expect(screen.getByRole('button', { name: 'Giao' })).toBeEnabled();
  });

  it('dòng đặt 0 không được gửi; dòng còn lại vẫn gửi', async () => {
    const f = stub();
    open(B);
    const input = spin('Giao Giấy A4');
    await userEvent.clear(input);
    await userEvent.type(input, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    await screen.findByText('Đã giao cho Lê Thị Bình');
    expect(deliverCalls(f).map(([u]) => u)).toEqual(['/api/admin/lines/lb/deliver']);
  });

  it('tủ 0 → không có stepper, chữ "Tủ hết món này", nút Giao vô hiệu nếu không còn dòng nào giao được', () => {
    stub();
    open(person({ lines: [pLine({ stock_qty: 0 })] }));
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByText('Tủ hết món này')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Giao' })).toBeDisabled();
  });

  it('tủ 1: stepper mặc định 1, Thêm vô hiệu, Bớt còn bấm được (để bỏ qua dòng)', () => {
    stub();
    open(person({ lines: [pLine({ remaining_qty: 4, qty: 4, stock_qty: 1 })] }));
    expect(spin('Giao Bút bi xanh').value).toBe('1');
    expect(screen.getByRole('button', { name: 'Bớt Giao Bút bi xanh' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Thêm Giao Bút bi xanh' })).toBeDisabled();
  });
});

describe('PersonPanel — tồn chia theo món', () => {
  const debt = pLine({ line_id: 'd', period_ym: '2026-09', is_debt: true, qty: 3, remaining_qty: 3, stock_qty: 6 });
  const cur = pLine({ line_id: 'c', qty: 5, remaining_qty: 5, stock_qty: 6 });

  it('nợ 3 + kỳ này 5 cùng món, tủ 6: mặc định 3 rồi 3, cảnh báo "Giao 3, còn nợ 2" ở dòng kỳ này', () => {
    stub();
    open(person({ lines: [cur, debt] }));
    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(inputs.map((i) => i.value)).toEqual(['3', '3']);
    expect(screen.getAllByText('Giao 3, còn nợ 2')).toHaveLength(1);
    expect(screen.getByText('Giao 6 đơn vị, ghi nợ 2')).toBeInTheDocument();
  });

  it('hạ dòng nợ xuống 1 thì dòng kỳ này được thêm tồn (tối đa 5)', async () => {
    stub();
    open(person({ lines: [cur, debt] }));
    const [debtInput, curInput] = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    await userEvent.click(screen.getAllByRole('button', { name: /^Bớt/ })[0]);
    expect(debtInput.value).toBe('2');
    expect(curInput.max).toBe('4');
  });

  it('giao: gửi 3 cho dòng nợ rồi 3 cho dòng kỳ này', async () => {
    const f = stub();
    open(person({ lines: [cur, debt] }));
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    await waitFor(() => expect(deliverCalls(f)).toHaveLength(2));
    expect(deliverCalls(f).map(([u, b]) => [u, b.qty])).toEqual([['/api/admin/lines/d/deliver', 3], ['/api/admin/lines/c/deliver', 3]]);
  });
});

describe('PersonPanel — dòng chờ duyệt', () => {
  it('có nhãn "Chờ duyệt" + liên kết /admin/review, không có spinbutton; người chỉ có dòng chờ duyệt không bấm Giao được', () => {
    stub();
    open(person({ status: 'pending', lines: [pLine({ review_status: 'pending', name: 'Băng keo', item_id: null })] }));
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xem/ })).toHaveAttribute('href', '/admin/review?status=pending&ym=2026-10');
    expect(screen.getByRole('button', { name: 'Giao' })).toBeDisabled();
  });
});

describe('PersonPanel — giao', () => {
  it('Giao: tuần tự dòng nợ trước, đúng qty và expected_delivered_qty, rồi toast "Đã giao cho …" + "Người tiếp theo"', async () => {
    const f = stub();
    const onNext = vi.fn();
    const withDelivered = person({
      ...B,
      lines: [B.lines[0], { ...B.lines[1], delivered_qty: 0 }],
    });
    open(withDelivered, { next: C, onNext });
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    await waitFor(() => expect(deliverCalls(f)).toHaveLength(2));
    expect(deliverCalls(f)).toEqual([
      ['/api/admin/lines/lb-debt/deliver', { qty: 2, expected_delivered_qty: 0 }],
      ['/api/admin/lines/lb/deliver', { qty: 7, expected_delivered_qty: 0 }],
    ]);
    const toast = await screen.findByText('Đã giao cho Lê Thị Bình');
    expect(toast).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Người tiếp theo' }));
    expect(onNext).toHaveBeenCalledWith('u-c');
  });

  it('giá trị người dùng chỉnh được gửi đi; không có người kế → toast không có nút "Người tiếp theo"', async () => {
    const f = stub();
    open(A);
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Giao Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    await screen.findByText('Đã giao cho Nguyễn Văn An');
    expect(deliverCalls(f)[0][1]).toEqual({ qty: 2, expected_delivered_qty: 0 });
    expect(screen.queryByRole('button', { name: 'Người tiếp theo' })).toBeNull();
  });

  it('tủ vừa bị lấy: STOCK_INSUFFICIENT available 2 → "Chỉ còn 2 cây.", stepper hạ trần xuống 2 và về 2', async () => {
    stub(() => jsonResponse(409, { code: 'STOCK_INSUFFICIENT', available: 2 }));
    open(B);
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    const row = (await screen.findByText('Chỉ còn 2 cây.')).closest('li') as HTMLElement;
    const input = within(row).getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('2');
    expect(input.max).toBe('2');
    expect(within(row).getByRole('button', { name: /^Thêm/ })).toBeDisabled();
    expect(screen.queryByText('Đã giao cho Lê Thị Bình')).toBeNull();
  });

  it('một dòng lỗi không chặn dòng sau: nợ lỗi, dòng tháng vẫn được giao; toast báo giao một phần', async () => {
    const f = stub((url) => (url.includes('lb-debt') ? jsonResponse(409, { code: 'STOCK_INSUFFICIENT', available: 1 }) : jsonResponse(200, {})));
    open(B);
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    await screen.findByText('Chỉ còn 1 ream.');
    expect(deliverCalls(f)).toHaveLength(2);
    expect(await screen.findByText('Đã giao một phần cho Lê Thị Bình — còn dòng chưa giao được.')).toBeInTheDocument();
  });

  it('STALE_UPDATE hiện câu "đã cập nhật" ở dòng', async () => {
    stub(() => jsonResponse(409, { code: 'STALE_UPDATE' }));
    open(A);
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    expect(await screen.findByText('Dòng vừa được giao ở nơi khác — đã cập nhật.')).toBeInTheDocument();
  });

  it('người đã nhận đủ: câu "Đã nhận đủ phần đang có." và không có nút Giao', () => {
    stub();
    open(PEOPLE[3]);
    expect(screen.getByText('Đã nhận đủ phần đang có.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Giao' })).toBeNull();
  });
});
