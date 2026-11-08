import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import { plan, planRow } from './arrivals-fixtures';
import { FUTURE, PLAN, PLAN_URL, RECEIPT_URL, bodiesOf, box, callsTo, open, saveBtn, stub, type } from './arrivals-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

const loc = () => screen.getByTestId('location-search').textContent ?? '';
const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('Hàng về — bảng theo bản in', () => {
  it('cột: Sản phẩm · Tồn kho · Đề nghị mua · Hàng về · Tình trạng · Sau nhập kho; điền sẵn = phần còn lại; link "theo bản gửi ADM hh:mm dd/mm"', async () => {
    stub();
    await open();
    expect(await screen.findByDisplayValue('6')).toBe(box('Bút bi'));
    expect(box('Kẹp giấy')).toHaveValue(10);
    const heads = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(heads).toEqual(['Món', 'Tồn kho', 'Đề nghị mua', 'Hàng về', 'Tình trạng', 'Sau nhập kho']);
    expect(heads).not.toContain('Đã về các đợt trước');
    expect(screen.getByRole('link', { name: 'theo bản gửi ADM 09:05 02/11' })).toHaveAttribute('href', '/admin/reports/snapshots/s-1/print');
  });

  it('món có đợt trước: dưới số Đề nghị mua có chữ nhỏ "đã về 4"; món chưa về đợt nào không có', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    expect(within(rowOf('Bút bi')).getByText('đã về 4')).toBeInTheDocument();
    expect(within(rowOf('Kẹp giấy')).queryByText(/đã về/)).toBeNull();
  });

  it('gom theo nhóm: đầu nhóm "đủ a/b, sau lưu c/b" khớp chip: chip nền "Thiếu 6" = đã lưu, chip viền đứt "Sau lưu: Đủ"', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    const but = screen.getByRole('rowgroup', { name: 'Bút' });
    expect(but).toHaveTextContent('đủ 0/1, sau lưu 1/1');
    const row = within(rowOf('Bút bi'));
    expect(row.getByText('Thiếu 6')).toHaveClass('tag');
    expect(row.getByText('Sau lưu: Đủ')).toHaveClass('ar-after-chip');
    await type(box('Bút bi'), '0');
    expect(but).toHaveTextContent('đủ 0/1');
    expect(but).not.toHaveTextContent('sau lưu');
    expect(row.queryByText(/Sau lưu/)).toBeNull();
    expect(row.getByText('Thiếu 6')).toBeInTheDocument();
  });

  it('nhóm đã có món đủ: "đủ 1/2, sau lưu 2/2"; hàng đủ điền 0', async () => {
    stub({ plan: plan([...PLAN.rows, planRow({ item_id: 'i-c', name: 'Bút chì', category_id: 'c-but', received: 10, remaining: 0 })]) });
    await open();
    const but = await screen.findByRole('rowgroup', { name: 'Bút' });
    expect(but).toHaveTextContent('đủ 1/2, sau lưu 2/2');
    expect(within(but).getByRole('spinbutton', { name: 'Hàng về: Bút chì' })).toHaveValue(0);
  });

  it('nhập 0 ở một món còn thiếu → hiện cột "Còn thiếu"; sửa lại đủ → cột biến mất', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    expect(screen.queryByRole('columnheader', { name: 'Còn thiếu' })).toBeNull();
    await type(box('Bút bi'), '4');
    expect(screen.getByRole('columnheader', { name: 'Còn thiếu' })).toBeInTheDocument();
    expect(within(rowOf('Bút bi')).getAllByRole('cell').map((c) => c.textContent)).toContain('2');
    await type(box('Bút bi'), '6');
    expect(screen.queryByRole('columnheader', { name: 'Còn thiếu' })).toBeNull();
  });

  it('chỉ một nút chính "Lưu hàng về"; không có "Đủ hàng", "Đặt lại", "Điền lại số gợi ý", "Hoàn tác" trong bảng', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    expect(screen.getAllByRole('button', { name: 'Lưu hàng về' })).toHaveLength(1);
    for (const n of ['Đủ hàng', 'Đặt lại', 'Điền lại số gợi ý', 'Hoàn tác']) expect(screen.queryByRole('button', { name: n })).toBeNull();
    expect(screen.getByText('Đợt này: 2 món · 16 đơn vị')).toBeInTheDocument();
  });

  it('chưa có bản chốt: ghi chú số gộp, điền sẵn remaining theo ordered gộp', async () => {
    stub({ plan: plan([planRow({ item_id: 'i-a', ordered: 10, remaining: 10, stock_qty: 5 })], { snapshot: null }) });
    await open();
    expect(await screen.findByText('Chưa in trình ký gửi ADM — số điền sẵn theo tổng đăng ký + nợ tháng trước')).toBeInTheDocument();
    expect(box('Bút bi')).toHaveValue(10);
  });

  it('Tháng này không cần đề nghị ADM: băng "Không có đơn gửi ADM · hh:mm dd/mm", vẫn còn Thêm món khác và Về bù kỳ trước', async () => {
    const makeup = [{ ym: '2026-09', rows: [{ key: 'i-a', item_id: 'i-a', name: 'Bút bi', name_en: null, unit: 'cay', stock_qty: 2, ordered: 7, received: 3, adm_owed: 4 }] }];
    stub({ plan: plan([], { snapshot: null, no_order: { at: '2026-11-12T03:00:00.000Z', by_name: 'Hà' }, makeup }) });
    await open();
    expect(await screen.findByText('Không có đơn gửi ADM · 10:00 12/11')).toBeInTheDocument();
    expect(screen.queryByText(/Chưa in trình ký gửi ADM/)).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Tìm món để thêm' })).toBeInTheDocument();
    expect(screen.getByText('Về bù kỳ trước (1)')).toBeInTheDocument();
  });

  it('chip tình trạng: nhập đủ → không có chip Sau lưu; nhập 9 → "Sau lưu: Thiếu 1"; 11 → "Sau lưu: Dư 1"; sau nhập kho đổi theo', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await type(box('Kẹp giấy'), '9');
    expect(rowOf('Kẹp giấy')).toHaveTextContent('Sau lưu: Thiếu 1');
    await type(box('Kẹp giấy'), '10');
    expect(rowOf('Kẹp giấy')).toHaveTextContent('Sau lưu: Đủ');
    await type(box('Kẹp giấy'), '11');
    expect(rowOf('Kẹp giấy')).toHaveTextContent('Sau lưu: Dư 1');
    expect(within(rowOf('Kẹp giấy')).getAllByRole('cell').at(-1)).toHaveTextContent('11');
  });

  it('W14: hàng giảm sau khi gửi có nhãn, đầu trang đếm món', async () => {
    stub({ plan: plan([planRow({ item_id: 'i-a', reduced_after_snapshot: 3 }), planRow({ item_id: 'i-b', name: 'Kẹp giấy' })]) });
    await open();
    expect(await screen.findByText('Đã giảm 3 sau khi gửi ADM — phần dư vào tủ')).toBeInTheDocument();
    expect(screen.getByText('1 món đã giảm sau khi gửi ADM — phần dư sẽ vào tủ')).toBeInTheDocument();
  });

  it('món ngừng có trong bản in: ô nhập được + nhãn "Ngừng dùng — đã đặt trong bản in"; Lưu gửi món đó', async () => {
    const f = stub({ plan: plan([planRow({ item_id: 'i-off', name: 'Món ngừng', usable: false, inactive_reason: 'item', remaining: 3, stock_qty: 1 })]) });
    await open();
    expect(await screen.findByText('Ngừng dùng — đã đặt trong bản in')).toBeInTheDocument();
    expect(box('Món ngừng')).toBeEnabled();
    await userEvent.click(saveBtn());
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    expect(bodiesOf(f, RECEIPT_URL)[0].lines).toEqual([{ item_id: 'i-off', qty: 3, expected_stock_qty: 1 }]);
  });

  it('món ngừng có trong bản in hiện lý do ngừng: "Ngừng riêng" / "Ngừng theo nhóm"; món đang dùng không có nhãn', async () => {
    stub({
      plan: plan([
        planRow({ item_id: 'i-off', name: 'Món ngừng', usable: false, inactive_reason: 'item', remaining: 3, stock_qty: 1 }),
        planRow({ item_id: 'i-b', name: 'Kẹp giấy', usable: false, inactive_reason: 'category' }),
        planRow({ item_id: 'i-a', name: 'Bút bi' }),
      ]),
    });
    await open();
    const rowOf = async (name: string) => (await screen.findByRole('spinbutton', { name: `Hàng về: ${name}` })).closest('tr')!;
    expect(within(await rowOf('Món ngừng')).getByText('Ngừng riêng')).toBeInTheDocument();
    expect(within(await rowOf('Kẹp giấy')).getByText('Ngừng theo nhóm')).toBeInTheDocument();
    expect(within(await rowOf('Bút bi')).queryByText(/^Ngừng (riêng|theo nhóm)$/)).not.toBeInTheDocument();
  });
});

describe('Hàng về — lọc ?q=&g=&short=1', () => {
  it('chip nhóm có số; bấm nhóm → URL g=, "Đang hiện 1/2 món"; "Tất cả" bỏ lọc', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    expect(screen.getByText('Đang hiện 2/2 món')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Kẹp & dán 1' }));
    expect(loc()).toContain('g=c-kep');
    expect(screen.getByText('Đang hiện 1/2 món')).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Hàng về: Bút bi' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tất cả 2' }));
    expect(loc()).not.toContain('g=');
  });

  it('?q=but&short=1 khôi phục sau F5; công tắc "Chỉ món chưa về đủ (n)"', async () => {
    stub({ plan: plan([...PLAN.rows, planRow({ item_id: 'i-c', name: 'Bút chì', category_id: 'c-but', received: 10, remaining: 0 })]) });
    await open('/admin/arrivals?q=but&short=1');
    expect(await screen.findByRole('searchbox', { name: 'Tìm món (không cần dấu)' })).toHaveValue('but');
    expect(screen.getByRole('switch', { name: 'Chỉ món chưa về đủ (2)' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Đang hiện 1/3 món')).toBeInTheDocument();
    expect(box('Bút bi')).toBeInTheDocument();
  });

  it('gõ tìm "kep" → URL q=kep (không dấu khớp "Kẹp giấy")', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món (không cần dấu)' }), 'kep');
    await waitFor(() => expect(loc()).toContain('q=kep'));
    expect(screen.queryByRole('spinbutton', { name: 'Hàng về: Bút bi' })).not.toBeInTheDocument();
    expect(box('Kẹp giấy')).toBeInTheDocument();
  });

  it('không khớp → "Không có món khớp" + "Xóa lọc"', async () => {
    stub();
    await open('/admin/arrivals?q=zzz');
    expect(await screen.findByText('Không có món khớp')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(box('Bút bi')).toBeInTheDocument();
    expect(loc()).toBe('');
  });

  it('lọc không xóa số đã gõ; Lưu gửi cả hàng đang ẩn có số > 0', async () => {
    const f = stub();
    await open();
    await screen.findByDisplayValue('6');
    await type(box('Bút bi'), '5');
    await userEvent.click(screen.getByRole('button', { name: 'Kẹp & dán 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tất cả 2' }));
    expect(box('Bút bi')).toHaveValue(5);
    await userEvent.click(screen.getByRole('button', { name: 'Kẹp & dán 1' }));
    await userEvent.click(saveBtn());
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu hàng về' }));
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    expect(bodiesOf(f, RECEIPT_URL)[0].lines).toEqual([
      { item_id: 'i-a', qty: 5, expected_stock_qty: 2 },
      { item_id: 'i-b', qty: 10, expected_stock_qty: 0 },
    ]);
  });
});

describe('Hàng về — Điền đủ cả nhóm', () => {
  it('điền remaining cho hàng của nhóm (gồm món ngừng đã đặt), bỏ qua ADM hết hàng; 0 request; không có "Bỏ điền" và không có "ADM hết hàng cả nhóm"', async () => {
    const rows = [
      planRow({ item_id: 'k1', name: 'Kẹp 1', category_id: 'c-kep', remaining: 3 }),
      planRow({ item_id: 'k2', name: 'Kẹp 2', category_id: 'c-kep', remaining: 4 }),
      planRow({ item_id: 'k3', name: 'Kẹp 3', category_id: 'c-kep', remaining: 5, adm_out: true }),
      planRow({ item_id: 'k4', name: 'Kẹp ngừng', category_id: 'c-kep', remaining: 2, usable: false }),
    ];
    const f = stub({ plan: plan(rows) });
    await open();
    await screen.findByDisplayValue('3');
    await type(box('Kẹp 1'), '1');
    await type(box('Kẹp 2'), '0');
    await type(box('Kẹp ngừng'), '0');
    const before = f.mock.calls.length;
    const group = screen.getByRole('rowgroup', { name: 'Kẹp & dán' });
    await userEvent.click(within(group).getByRole('button', { name: 'Điền đủ cả nhóm' }));
    expect(box('Kẹp 1')).toHaveValue(3);
    expect(box('Kẹp 2')).toHaveValue(4);
    expect(box('Kẹp 3')).toHaveValue(0);
    expect(box('Kẹp ngừng')).toHaveValue(2);
    expect(within(group).queryByRole('button', { name: /Bỏ điền/ })).toBeNull();
    expect(f.mock.calls.length).toBe(before);
    expect(screen.queryByRole('button', { name: /ADM hết hàng cả nhóm/ })).not.toBeInTheDocument();
  });
});

describe('Hàng về — ADM hết hàng', () => {
  const ADM_URL = '/api/admin/periods/2026-10/adm-out/';

  it('bấm → 1 PUT, aria-pressed, ô 0 + khóa + nhãn xám; bấm lại → 1 DELETE, ô về số điền sẵn', async () => {
    let marked = false;
    const f = stub({
      plan: () => plan([planRow({ item_id: 'i-a', remaining: 6, adm_out: marked }), PLAN.rows[1]]),
      routes: {
        [ADM_URL]: (init) => {
          marked = init?.method === 'PUT';
          return init?.method === 'PUT' ? jsonResponse(200, { adm_out: true }) : jsonResponse(204, null);
        },
      },
    });
    await open();
    await screen.findByDisplayValue('6');
    await type(box('Bút bi'), '4');
    const btn = screen.getByRole('button', { name: 'ADM hết hàng: Bút bi' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
    expect(callsTo(f, ADM_URL, 'PUT')).toEqual([`${ADM_URL}i-a`]);
    expect(box('Bút bi')).toHaveValue(0);
    expect(box('Bút bi')).toBeDisabled();
    expect(within(rowOf('Bút bi')).getByText('ADM hết hàng', { selector: '.tag' })).toBeInTheDocument();
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'false'));
    expect(callsTo(f, ADM_URL, 'DELETE')).toHaveLength(1);
    expect(box('Bút bi')).toHaveValue(6);
    expect(box('Bút bi')).toBeEnabled();
  });

  it('W17: hàng ADM hết hàng có tủ hiện câu chia từ tủ', async () => {
    stub({ plan: plan([planRow({ item_id: 'i-a', remaining: 5, stock_qty: 2, adm_out: true }), PLAN.rows[1]]) });
    await open();
    expect(await screen.findByText('ADM hết hàng — tủ còn 2: khi giao chia từ tủ theo thứ tự đăng ký, phần thiếu 3 hủy')).toBeInTheDocument();
  });

  it('đã xử lý xong → nút khóa "ADM hết hàng · đã xử lý xong"; lỗi ADM_OUT_FINAL → báo lỗi, tải lại kế hoạch', async () => {
    const f = stub({
      plan: plan([planRow({ item_id: 'i-a', adm_out: true, adm_out_final: true }), planRow({ item_id: 'i-b', name: 'Kẹp giấy', adm_out: true }), planRow({ item_id: 'i-c', name: 'Bút chì', remaining: 2 })]),
      routes: { [ADM_URL]: () => jsonResponse(409, { code: 'ADM_OUT_FINAL' }) },
    });
    await open();
    expect(await screen.findByRole('button', { name: 'ADM hết hàng · đã xử lý xong: Bút bi' })).toBeDisabled();
    const before = callsTo(f, PLAN_URL).length;
    await userEvent.click(screen.getByRole('button', { name: 'ADM hết hàng: Kẹp giấy' }));
    expect(await screen.findByText('Các dòng của món này đã giao/hủy xong — không bỏ đánh dấu được nữa.')).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, PLAN_URL).length).toBeGreaterThan(before));
  });
});

describe('Hàng về — Thêm món khác (GroupedCombobox)', () => {
  it('gõ "kep" → ↓ Enter thêm Kẹp bướm; hàng thêm điền 0 + W16; món ngừng và món đã có không là ứng viên', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    const combo = screen.getByRole('combobox', { name: 'Tìm món để thêm' });
    await userEvent.click(combo);
    expect(screen.queryByRole('option', { name: 'Món ngừng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Bút bi' })).not.toBeInTheDocument();
    await userEvent.type(combo, 'kep');
    expect(within(screen.getByRole('group', { name: 'Kẹp & dán' })).getByRole('option', { name: 'Kẹp bướm' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(box('Kẹp bướm')).toHaveValue(0);
    expect(screen.getByText('Món này không có trong bản in gửi ADM — nhập thẳng vào tủ')).toBeInTheDocument();
  });
});

describe('Hàng về — biên ô Về đợt này', () => {
  it('0 được; -1 lỗi gắn ô + Lưu vô hiệu; 99999 được; 100000 "Tối đa 99.999"', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await type(box('Bút bi'), '0');
    expect(box('Bút bi')).not.toHaveAttribute('aria-invalid', 'true');
    expect(saveBtn()).toBeEnabled();
    await type(box('Bút bi'), '-1');
    expect(document.getElementById(box('Bút bi').getAttribute('aria-describedby') ?? '')).toHaveTextContent('Nhập số nguyên từ 0 trở lên');
    expect(saveBtn()).toBeDisabled();
    await type(box('Bút bi'), '99999');
    expect(saveBtn()).toBeEnabled();
    await type(box('Bút bi'), '100000');
    expect(document.getElementById(box('Bút bi').getAttribute('aria-describedby') ?? '')).toHaveTextContent('Tối đa 99.999');
    expect(saveBtn()).toBeDisabled();
  });

  it('kỳ chưa khóa: thông báo, không bảng', async () => {
    stub({ summary: FUTURE });
    await open();
    expect(await screen.findByText('Kỳ tháng 10 chưa khóa sổ — xem được từ 00:00 ngày 11/10.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Lưu hàng về' })).not.toBeInTheDocument();
  });

  it('giao diện tiếng Anh: tên món theo name_en', async () => {
    stub();
    await i18n.changeLanguage('en');
    try {
      mockViewport(1280);
      renderApp(makeMe('admin'), '/admin/arrivals');
      expect(await screen.findByRole('spinbutton', { name: 'Arrived: Ballpoint pen' })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});
