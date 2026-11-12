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

interface Extra {
  next?: DeliveryPerson;
  onNext?: (s: string) => void;
  onDelivered?: () => void;
  people?: DeliveryPerson[];
}
function open(p: DeliveryPerson, extra: Extra = {}) {
  return renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <PersonPanel ym="2026-10" person={p} people={extra.people ?? PEOPLE} {...extra} />
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
}
const spin = (name: string) => screen.getByRole('spinbutton', { name }) as HTMLInputElement;
const deliverBtn = () => screen.getByRole('button', { name: 'Giao…' });
const values = () => (screen.getAllByRole('spinbutton') as HTMLInputElement[]).map((i) => i.value);

afterEach(() => vi.unstubAllGlobals());

describe('PersonPanel — thứ tự và mặc định', () => {
  it('nhóm "Nợ kỳ trước" đứng trước "Tháng 10"; dòng nợ đứng trước dòng tháng', () => {
    stub();
    open(B);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['Nợ kỳ trước', 'Tháng 10']);
    expect(screen.getAllByRole('spinbutton').map((s) => s.getAttribute('aria-label'))).toEqual(['Giao Giấy A4', 'Giao Bút bi xanh']);
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

  it('B cần 10 bút, tủ 7, A đăng ký trước cần 3 → mặc định 4 (theo người đăng ký trước); "Giao 4 · Chưa nhận 6"', () => {
    stub();
    open(B);
    expect(spin('Giao Bút bi xanh').value).toBe('4');
    expect(screen.getByText('Cần 10 · Tủ 7 · 1 người khác còn chờ 3')).toBeInTheDocument();
    expect(screen.getByText('Giao 4 · Chưa nhận 6')).toBeInTheDocument();
  });

  it('W19 trong panel: tủ 7, A + B chờ 13 → "Tủ 7 không đủ cho 2 người đang chờ 13 — thiếu 6"', () => {
    stub();
    open(B);
    expect(screen.getByText('Tủ 7 không đủ cho 2 người đang chờ 13 — thiếu 6')).toBeInTheDocument();
  });

  it('dòng panel: "Cần 2 · Tủ 20 · 4 người khác còn chờ 18" (đếm cả nợ của người khác, không đếm dòng chờ duyệt)', () => {
    stub();
    const me = person({ user_sub: 'u-me', lines: [pLine({ line_id: 'm', qty: 2, remaining_qty: 2, stock_qty: 20 })] });
    const others = [
      person({ user_sub: 'o1', lines: [pLine({ line_id: 'o1', remaining_qty: 5 })] }),
      person({ user_sub: 'o2', lines: [pLine({ line_id: 'o2', remaining_qty: 4 })] }),
      person({ user_sub: 'o3', lines: [pLine({ line_id: 'o3', is_debt: true, period_ym: '2026-09', remaining_qty: 6 })] }),
      person({ user_sub: 'o4', lines: [pLine({ line_id: 'o4', remaining_qty: 3 })] }),
      person({ user_sub: 'o5', lines: [pLine({ line_id: 'o5', review_status: 'pending', remaining_qty: 9 })] }),
    ];
    open(me, { people: [me, ...others] });
    expect(screen.getByText('Cần 2 · Tủ 20 · 4 người khác còn chờ 18')).toBeInTheDocument();
  });

  it('đủ hàng → không cảnh báo; hạ xuống dưới mức cần thì cảnh báo hiện theo số mới', async () => {
    stub();
    open(A);
    expect(spin('Giao Bút bi xanh').value).toBe('3');
    expect(screen.queryByText(/Chưa nhận/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Giao Bút bi xanh' }));
    expect(screen.getByText('Giao 2 · Chưa nhận 1')).toBeInTheDocument();
  });
});

describe('PersonPanel — biên stepper', () => {
  it.each([
    ['tủ 7 < cần 10', 10, 7, 7],
    ['tủ = cần', 10, 10, 10],
    ['tủ 11 > cần 10', 10, 11, 10],
  ])('%s → mặc định %i/%i = %i và nút Thêm bị vô hiệu', (_n, remaining, s, want) => {
    stub();
    open(person({ lines: [pLine({ remaining_qty: remaining, qty: remaining, stock_qty: s })] }));
    expect(spin('Giao Bút bi xanh').value).toBe(String(want));
    expect(screen.getByRole('button', { name: 'Thêm Giao Bút bi xanh' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Bớt Giao Bút bi xanh' })).toBeEnabled();
  });

  it('mọi dòng đặt 0 → nút Giao… vô hiệu; đặt lại 1 → bật', async () => {
    stub();
    open(person({ lines: [pLine({ remaining_qty: 1, qty: 1, stock_qty: 9 })] }));
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Giao Bút bi xanh' }));
    expect(deliverBtn()).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Giao Bút bi xanh' }));
    expect(deliverBtn()).toBeEnabled();
  });

  it('tủ 0 → không có stepper, chữ "Tủ hết món này", nút Giao… vô hiệu', () => {
    stub();
    open(person({ lines: [pLine({ stock_qty: 0 })] }));
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByText('Tủ hết món này')).toBeInTheDocument();
    expect(deliverBtn()).toBeDisabled();
  });

  it('món ngoài DM đã duyệt chưa nhận hàng (deliver_cap 0) → "Chưa nhận hàng", không stepper', () => {
    stub();
    open(person({ lines: [pLine({ item_id: null, stock_qty: null, name: '#%$#', review_status: 'accepted', remaining_qty: 1, deliver_cap: 0 })] }));
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByText('Chưa nhận hàng')).toBeInTheDocument();
    expect(screen.queryByText('Tủ hết món này')).toBeNull();
    expect(deliverBtn()).toBeDisabled();
  });
});

describe('PersonPanel — tồn chia theo món', () => {
  const debt = pLine({ line_id: 'd', period_ym: '2026-09', is_debt: true, qty: 3, remaining_qty: 3, stock_qty: 6 });
  const cur = pLine({ line_id: 'c', qty: 5, remaining_qty: 5, stock_qty: 6 });

  it('dòng sau cùng món bị dòng trên lấy hết tồn: "Đã dành hết cho dòng trên"; hạ dòng trên thì dòng sau được nâng tới phần dư', async () => {
    stub();
    open(person({ lines: [{ ...cur, stock_qty: 3 }, { ...debt, stock_qty: 3 }] }));
    expect(screen.getAllByRole('spinbutton')).toHaveLength(1);
    expect(screen.getByText('Đã dành hết cho dòng trên')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Bớt/ }));
    expect(screen.queryByText('Đã dành hết cho dòng trên')).toBeNull();
    expect(values()).toEqual(['2', '0']);
    expect((screen.getAllByRole('spinbutton') as HTMLInputElement[])[1].max).toBe('1');
  });

  it('nợ 3 + kỳ này 5 cùng món, tủ 6: mặc định 3 rồi 3; tổng "Giao 6 · còn 2 chưa nhận"', () => {
    stub();
    open(person({ lines: [cur, debt] }));
    expect(values()).toEqual(['3', '3']);
    expect(screen.getAllByText('Giao 3 · Chưa nhận 2')).toHaveLength(1);
    expect(screen.getByText('Giao 6 · còn 2 chưa nhận')).toBeInTheDocument();
  });

  it('tủ 2 cho nợ 3: dòng nợ "Giao 2 · Nợ 1"; tổng thêm "· nợ tháng trước 1"', () => {
    stub();
    open(person({ lines: [debt, cur].map((l) => ({ ...l, stock_qty: 2 })) }));
    expect(screen.getByText('Giao 2 · Nợ 1')).toBeInTheDocument();
    expect(screen.getByText('Giao 2 · còn 5 chưa nhận · nợ tháng trước 1')).toBeInTheDocument();
  });
});

describe('PersonPanel — dòng chờ duyệt', () => {
  it('có nhãn "Chờ duyệt" + liên kết /admin/review, không có spinbutton; người chỉ có dòng chờ duyệt không bấm Giao… được', () => {
    stub();
    open(person({ status: 'pending', lines: [pLine({ review_status: 'pending', name: 'Băng keo', item_id: null })] }));
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.getByText('Chờ duyệt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Xem/ })).toHaveAttribute('href', '/admin/review?status=pending&ym=2026-10');
    expect(deliverBtn()).toBeDisabled();
  });
});

describe('PersonPanel — "Giao…" mở hộp xác nhận trên panel', () => {
  it('bấm Giao… chưa gửi gì; hộp lấy số panel đang chọn; Xác nhận gửi nợ trước rồi kỳ này; xong → onDelivered + toast', async () => {
    const f = stub();
    const onDelivered = vi.fn();
    const onNext = vi.fn();
    open(B, { next: C, onNext, onDelivered });
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Giao Bút bi xanh' }));
    await userEvent.click(deliverBtn());
    const dlg = await screen.findByRole('dialog', { name: 'Giao cho Lê Thị Bình?' });
    expect(deliverCalls(f)).toEqual([]);
    expect((within(dlg).getByRole('spinbutton', { name: 'Giao lần này: Bút bi xanh' }) as HTMLInputElement).value).toBe('3');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Xác nhận giao' }));
    await waitFor(() => expect(onDelivered).toHaveBeenCalled());
    expect(deliverCalls(f)).toEqual([
      ['/api/admin/lines/lb-debt/deliver', { qty: 2, expected_delivered_qty: 0 }],
      ['/api/admin/lines/lb/deliver', { qty: 3, expected_delivered_qty: 0 }],
    ]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await screen.findByText('Đã giao cho Lê Thị Bình')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Người tiếp theo' }));
    expect(onNext).toHaveBeenCalledWith('u-c');
  });

  it('giao có lỗi → hộp ở lại ở chế độ kết quả, panel không bị đóng', async () => {
    stub(() => jsonResponse(409, { code: 'STOCK_INSUFFICIENT', available: 2 }));
    const onDelivered = vi.fn();
    open(A, { onDelivered });
    await userEvent.click(deliverBtn());
    const dlg = await screen.findByRole('dialog');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Xác nhận giao' }));
    expect(await within(dlg).findByText('Chỉ còn 2 cây.')).toBeInTheDocument();
    expect(onDelivered).not.toHaveBeenCalled();
    await userEvent.click(within(dlg).getByRole('button', { name: 'Đóng' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(deliverBtn()).toBeInTheDocument();
  });

  it('người đã nhận đủ: câu "Đã nhận đủ phần đang có." và không có nút Giao…', () => {
    stub();
    open(PEOPLE[3]);
    expect(screen.getByText('Đã nhận đủ phần đang có.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Giao…' })).toBeNull();
  });
});
