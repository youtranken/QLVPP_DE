import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ToastProvider } from '@/ui/toast-provider';
import type { DeliveryPerson } from './delivery-people.api';
import { DeliverDialog } from './deliver-dialog';
import { person, pLine } from './people-fixtures';

type Reply = (url: string, body: Record<string, unknown>) => Response;
const OK: Reply = () => jsonResponse(200, {});

function stub(reply: Reply = OK) {
  const f = vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === 'POST') return Promise.resolve(reply(u, JSON.parse(String(init.body))));
    return Promise.resolve(jsonResponse(200, {}));
  });
  vi.stubGlobal('fetch', f);
  return f;
}
const posts = (f: ReturnType<typeof stub>) =>
  f.mock.calls.filter(([, i]) => i?.method === 'POST').map(([u, i]) => [String(u), JSON.parse(String(i?.body))] as const);

interface Opts {
  people?: DeliveryPerson[];
  initial?: Record<string, number>;
  onDone?: () => void;
  onClose?: () => void;
  onNext?: (sub: string) => void;
  next?: DeliveryPerson;
}
function open(p: DeliveryPerson, o: Opts = {}) {
  const props = { onDone: vi.fn(), onClose: vi.fn(), onOpenPerson: vi.fn(), ...o };
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <DeliverDialog person={p} people={o.people ?? [p]} initial={o.initial} next={o.next} onNext={o.onNext} onDone={props.onDone} onClose={props.onClose} onOpenPerson={props.onOpenPerson} />
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
  return props;
}
const dialog = () => screen.getByRole('dialog');
const spin = (name: string) => within(dialog()).getByRole('spinbutton', { name: `Giao lần này: ${name}` }) as HTMLInputElement;
const confirmBtn = () => within(dialog()).getByRole('button', { name: /^(Xác nhận giao|Đang giao…)/ });

afterEach(() => vi.unstubAllGlobals());

describe('DeliverDialog — mở hộp', () => {
  it('tiêu đề "Giao cho …?" nhận focus, cột có th scope, ghi chú không sửa được; chưa gửi gì', async () => {
    const f = stub();
    open(person());
    const title = await screen.findByRole('heading', { name: 'Giao cho Nguyễn Văn An?' });
    await waitFor(() => expect(title).toHaveFocus());
    expect(title).toHaveAttribute('tabindex', '-1');
    const heads = within(dialog()).getAllByRole('columnheader');
    expect(heads.map((h) => h.textContent)).toEqual(['Món', 'Cần giao', 'Giao lần này', 'Còn lại sau lần này']);
    heads.forEach((h) => expect(h).toHaveAttribute('scope', 'col'));
    expect(within(dialog()).getByText('Bấm Xác nhận là không sửa được. Nếu lỡ nhầm, vào Tủ / Kho để chỉnh số, ghi lý do.')).toBeInTheDocument();
    expect(posts(f)).toEqual([]);
  });

  it('cột "Còn lại sau lần này": tháng đang giao 5 giao 3 → "Chưa nhận 2"; tháng trước 4 giao 4 → không nhãn; giao 3 → "Nợ 1"', async () => {
    stub();
    const cur = pLine({ line_id: 'c', qty: 5, remaining_qty: 5, stock_qty: 9 });
    const debt = pLine({ line_id: 'd', period_ym: '2026-09', is_debt: true, item_id: 'i-a4', name: 'Giấy A4', qty: 4, remaining_qty: 4, stock_qty: 9 });
    open(person({ lines: [cur, debt] }), { initial: { c: 3 } });
    const rowOf = (name: string) => within(dialog()).getByRole('cell', { name: new RegExp(name) }).closest('tr') as HTMLElement;
    expect(within(rowOf('Bút bi xanh')).getByText('Chưa nhận 2')).toBeInTheDocument();
    expect(within(rowOf('Giấy A4')).getByText('Nợ tháng 9')).toBeInTheDocument();
    expect(within(rowOf('Giấy A4')).queryByText(/^Nợ \d/)).toBeNull();
    await userEvent.click(within(rowOf('Giấy A4')).getByRole('button', { name: /^Bớt/ }));
    expect(within(rowOf('Giấy A4')).getByText('Nợ 1')).toBeInTheDocument();
  });
});

describe('DeliverDialog — trần stepper', () => {
  it.each([
    ['còn 4 tủ 9', 4, 9],
    ['tủ 3 còn 9', 9, 3],
  ])('%s: gõ vượt → kẹp về trần + "Tối đa n"; nút + vô hiệu ở trần', async (_n, remaining, s) => {
    stub();
    open(person({ lines: [pLine({ qty: remaining, remaining_qty: remaining, stock_qty: s })] }));
    const cap = Math.min(remaining, s);
    const input = spin('Bút bi xanh');
    await userEvent.clear(input);
    await userEvent.type(input, String(cap + 1));
    expect(input.value).toBe(String(cap));
    expect(within(dialog()).getByText(`Tối đa ${cap}`)).toBeInTheDocument();
    expect(within(dialog()).getByRole('button', { name: /^Thêm/ })).toBeDisabled();
  });

  it('gõ "-1", "1.5", "e" giữ số hợp lệ; xóa trống → 0', async () => {
    stub();
    open(person({ lines: [pLine({ qty: 4, remaining_qty: 4, stock_qty: 9 })] }));
    const input = spin('Bút bi xanh');
    for (const bad of ['-1', '1.5']) {
      fireEvent.change(input, { target: { value: bad } });
      expect(input.value).toBe('4');
    }
    // Ô số của trình duyệt báo "e" là chuỗi rỗng → 0
    fireEvent.change(input, { target: { value: 'e' } });
    fireEvent.blur(input);
    expect(input.value).toBe('0');
    expect(within(dialog()).getByText('Chưa nhận 4')).toBeInTheDocument();
  });

  it('tổng 0, không dòng ADM → Xác nhận vô hiệu; tủ 0 mọi món → câu "Tủ chưa có hàng…"', async () => {
    stub();
    open(person({ lines: [pLine({ stock_qty: 0 })] }));
    expect(await within(dialog()).findByText('Tủ chưa có hàng cho món nào — ghi Hàng về trước.')).toBeInTheDocument();
    expect(confirmBtn()).toBeDisabled();
  });

  it('tủ 0 mọi món + 1 dòng chờ duyệt → vẫn liệt kê dòng chờ duyệt ở "Không giao lần này"', async () => {
    stub();
    open(person({ lines: [pLine({ stock_qty: 0 }), pLine({ line_id: 'rv', item_id: null, name: 'Kéo cắt', review_status: 'pending', stock_qty: null })] }));
    expect(await within(dialog()).findByText('Tủ chưa có hàng cho món nào — ghi Hàng về trước.')).toBeInTheDocument();
    expect(within(dialog()).getByText('Kéo cắt')).toBeInTheDocument();
  });

  it('tổng 0 nhưng có 1 dòng ADM hết hàng → Xác nhận bật, tổng có "Hủy 1 món ADM hết hàng"', async () => {
    stub();
    open(person({ lines: [pLine({ stock_qty: 0 }), pLine({ line_id: 'm', item_id: 'i-clip', stock_qty: 0, adm_out: true })] }));
    expect(confirmBtn()).toBeEnabled();
    expect(within(dialog()).getByText(/Hủy 1 món ADM hết hàng/)).toBeInTheDocument();
  });
});

describe('DeliverDialog — gợi ý theo người đăng ký trước', () => {
  const A = person({ user_sub: 'A', full_name: 'An', lines: [pLine({ line_id: 'a', qty: 5, remaining_qty: 5, stock_qty: 6, request_at: '2026-10-01T08:00:00.000000Z' })] });
  const B = person({ user_sub: 'B', full_name: 'Bình', lines: [pLine({ line_id: 'b', qty: 3, remaining_qty: 3, stock_qty: 6, request_at: '2026-10-01T09:00:00.000000Z' })] });

  it('tủ 6: hộp B đề xuất 1, "Giữ 5 cho 1 người đăng ký trước", sửa được tới 3, không tới 4', async () => {
    stub();
    open(B, { people: [A, B] });
    expect(spin('Bút bi xanh').value).toBe('1');
    expect(within(dialog()).getByText('Giữ 5 cho 1 người đăng ký trước')).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: /^Thêm/ }));
    await userEvent.click(within(dialog()).getByRole('button', { name: /^Thêm/ }));
    expect(spin('Bút bi xanh').value).toBe('3');
    expect(within(dialog()).getByRole('button', { name: /^Thêm/ })).toBeDisabled();
  });

  it('tủ 8: đề xuất 3, không có câu giữ', () => {
    stub();
    const at8 = (p: DeliveryPerson) => ({ ...p, lines: p.lines.map((l) => ({ ...l, stock_qty: 8 })) });
    open(at8(B), { people: [at8(A), at8(B)] });
    expect(spin('Bút bi xanh').value).toBe('3');
    expect(within(dialog()).queryByText(/^Giữ/)).toBeNull();
  });

  it('W19: tủ 3, hai người chờ 5 → "Tủ 3 không đủ cho 2 người đang chờ 5 — thiếu 2"', () => {
    stub();
    const a = person({ user_sub: 'a', lines: [pLine({ line_id: 'a', remaining_qty: 2, stock_qty: 3 })] });
    const b = person({ user_sub: 'b', full_name: 'Bình', lines: [pLine({ line_id: 'b', remaining_qty: 3, stock_qty: 3 })] });
    open(b, { people: [a, b] });
    expect(within(dialog()).getByText('Tủ 3 không đủ cho 2 người đang chờ 5 — thiếu 2')).toBeInTheDocument();
  });

  it('người đã nghỉ: nhãn, đề xuất 0; nâng lên 1 → gửi deliver qty 1', async () => {
    const f = stub();
    open(person({ user_status: 'inactive', lines: [pLine({ qty: 3, remaining_qty: 3, stock_qty: 9 })] }));
    expect(within(dialog()).getByText('Người đã nghỉ — giao chỉ khi có người nhận thay')).toBeInTheDocument();
    expect(spin('Bút bi xanh').value).toBe('0');
    expect(confirmBtn()).toBeDisabled();
    await userEvent.click(within(dialog()).getByRole('button', { name: /^Thêm/ }));
    await userEvent.click(confirmBtn());
    await waitFor(() => expect(posts(f)).toEqual([['/api/admin/lines/l-1/deliver', { qty: 1, expected_delivered_qty: 0 }]]));
  });
});

describe('DeliverDialog — ADM hết hàng', () => {
  it('tủ 2: B (trước) cần 1; A cần 2 → đề xuất 1 + "ADM hết hàng – tủ còn 1"; Xác nhận → giao 1 rồi hủy', async () => {
    const f = stub();
    const B = person({ user_sub: 'B', full_name: 'Bình', lines: [pLine({ line_id: 'b', qty: 1, remaining_qty: 1, stock_qty: 2, adm_out: true, request_at: '2026-10-01T07:00:00.000000Z' })] });
    const A = person({ user_sub: 'A', lines: [pLine({ line_id: 'a', qty: 2, remaining_qty: 2, stock_qty: 2, adm_out: true, request_at: '2026-10-01T08:00:00.000000Z' })] });
    const done = open(A, { people: [A, B] });
    expect(within(dialog()).getByRole('heading', { name: 'ADM hết hàng, số lượng sẽ trừ trong Tủ / Kho' })).toBeInTheDocument();
    expect(spin('Bút bi xanh').value).toBe('1');
    expect(within(dialog()).getByText('ADM hết hàng – tủ còn 1')).toBeInTheDocument();
    expect(within(dialog()).getByText('ADM hết hàng – tủ còn 1').closest('tr')).not.toHaveClass('dd-row--none');
    await userEvent.click(confirmBtn());
    await waitFor(() => expect(done.onDone).toHaveBeenCalled());
    expect(posts(f)).toEqual([
      ['/api/admin/lines/a/deliver', { qty: 1, expected_delivered_qty: 0 }],
      ['/api/admin/lines/a/cancel-remaining', { reason_code: 'adm_out_of_stock', expected_delivered_qty: 1, expected_qty: 2 }],
    ]);
  });
});

describe('DeliverDialog — ADM hết hàng, tủ không còn', () => {
  it('dòng ADM hết hàng tủ 0 → "ADM hết hàng – tủ còn 0", cả dòng tô đỏ (dd-row--none); dòng giao thường không tô', async () => {
    stub();
    const A = person({ lines: [pLine({ line_id: 'c', qty: 1, remaining_qty: 1, stock_qty: 3 }), pLine({ line_id: 'm', item_id: 'i-clip', name: 'Kẹp', qty: 2, remaining_qty: 2, stock_qty: 0, adm_out: true })] });
    open(A);
    const note = within(dialog()).getByText('ADM hết hàng – tủ còn 0');
    expect(note.closest('tr')).toHaveClass('dd-row--none');
    expect(spin('Bút bi xanh').closest('tr')).not.toHaveClass('dd-row--none');
  });
});

describe('DeliverDialog — gửi', () => {
  const debt = pLine({ line_id: 'd', period_ym: '2026-09', is_debt: true, item_id: 'i-a4', name: 'Giấy A4', unit: 'ream', qty: 4, remaining_qty: 4, stock_qty: 9 });
  const cur = pLine({ line_id: 'c', qty: 5, remaining_qty: 5, stock_qty: 9 });
  const adm = pLine({ line_id: 'm', item_id: 'i-clip', name: 'Kẹp', qty: 2, remaining_qty: 2, stock_qty: 1, adm_out: true });

  it('thứ tự: nợ, kỳ này, rồi hủy ADM; 403 CSRF ở request 2 → dừng, "Chưa gửi" + một thông báo hết phiên', async () => {
    const f = stub((u) => (u.includes('/c/') ? jsonResponse(403, { code: 'CSRF_TOKEN_INVALID' }) : jsonResponse(200, {})));
    const props = open(person({ lines: [adm, cur, debt] }));
    await userEvent.click(confirmBtn());
    await within(dialog()).findByText('Đã giao 4');
    const status = within(dialog()).getByRole('status');
    expect(posts(f).map(([u]) => u)).toEqual(['/api/admin/lines/d/deliver', '/api/admin/lines/c/deliver']);
    expect(within(status).getByText('Đã giao 4')).toBeInTheDocument();
    expect(within(status).getAllByText('Chưa gửi').length).toBeGreaterThan(0);
    expect(within(dialog()).getAllByText('Phiên đăng nhập đã hết — tải lại trang rồi giao tiếp.')).toHaveLength(1);
    expect(props.onDone).not.toHaveBeenCalled();
  });

  it('một dòng STOCK_INSUFFICIENT → hộp ở lại, ✗ dòng đó, ✓ dòng khác; nút Đóng + Mở chi tiết người', async () => {
    stub((u) => (u.includes('/d/') ? jsonResponse(409, { code: 'STOCK_INSUFFICIENT', available: 0 }) : jsonResponse(200, {})));
    const props = open(person({ lines: [cur, debt] }));
    await userEvent.click(confirmBtn());
    await within(dialog()).findByText('Đã giao 5');
    const status = within(dialog()).getByRole('status');
    expect(within(status).getByText('Đã giao 5')).toBeInTheDocument();
    expect(within(status).getByText(/Chỉ còn 0/)).toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Mở chi tiết người' }));
    expect(props.onOpenPerson).toHaveBeenCalled();
    expect(within(dialog()).getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
  });

  it('hết thành công → onDone, toast "Đã giao cho …" + "Người tiếp theo"', async () => {
    stub();
    const onNext = vi.fn();
    const props = open(person({ lines: [cur] }), { next: person({ user_sub: 'u-next' }), onNext });
    await userEvent.click(confirmBtn());
    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    expect(await screen.findByText('Đã giao cho Nguyễn Văn An')).toBeInTheDocument();
    // Hộp vẫn mở trong test (onDone giả) nên vùng toast bị che khỏi cây a11y
    fireEvent.click(screen.getByRole('button', { name: 'Người tiếp theo', hidden: true }));
    expect(onNext).toHaveBeenCalledWith('u-next');
  });

  it('bấm Xác nhận hai lần nhanh → mỗi dòng đúng 1 request; Esc khi đang gửi không đóng', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const f = vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.method === 'POST') await gate;
      return jsonResponse(200, {});
    });
    vi.stubGlobal('fetch', f);
    const props = open(person({ lines: [cur] }));
    const btn = confirmBtn();
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(confirmBtn()).toHaveAttribute('aria-busy', 'true'));
    expect(confirmBtn()).toHaveTextContent('Đang giao…');
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(props.onClose).not.toHaveBeenCalled();
    release();
    await waitFor(() => expect(props.onDone).toHaveBeenCalled());
    expect(f.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(1);
  });

  it('Enter lặp (repeat) trên Xác nhận không gửi; Enter trong stepper không gửi', async () => {
    const f = stub();
    open(person({ lines: [cur] }));
    fireEvent.keyDown(spin('Bút bi xanh'), { key: 'Enter' });
    const btn = confirmBtn();
    btn.focus();
    fireEvent.keyDown(btn, { key: 'Enter', repeat: true });
    await new Promise((r) => setTimeout(r, 20));
    expect(posts(f)).toEqual([]);
  });

  it('Quay lại → onClose, không gửi', async () => {
    const f = stub();
    const props = open(person({ lines: [cur] }));
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Quay lại' }));
    expect(props.onClose).toHaveBeenCalled();
    expect(posts(f)).toEqual([]);
  });
});
