import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { expectFixedColumns } from '@/test/fixed-columns';
import i18n from '@/lib/i18n';
import { plan, planRow } from './arrivals-fixtures';
import { FUTURE, PLAN, RECEIPT_URL, bodiesOf, box, groupBtn, open, pickBox, pickedBtn, stub, type } from './arrivals-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

const loc = () => screen.getByTestId('location-search').textContent ?? '';
const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

describe('Hàng về — bảng theo bản in', () => {
  it('cột: Sản phẩm · Tồn kho · Đề nghị mua · Nhận đợt này · Còn thiếu · Tình trạng · Sau nhập kho; điền sẵn = phần còn lại; dòng phụ dưới tiêu đề "Theo bản gửi NCC lúc hh:mm dd/mm · Xem bản in" (chỉ "Xem bản in" là link)', async () => {
    stub();
    await open();
    expect(await screen.findByDisplayValue('6')).toBe(box('Bút bi'));
    expect(box('Kẹp giấy')).toHaveValue(10);
    const heads = screen.getAllByRole('columnheader').map((c) => c.textContent);
    expect(heads).toEqual(['Món', 'Tồn kho', 'Đề nghị mua', 'Nhận đợt này', 'Còn thiếu', 'Tình trạng', 'Sau nhập kho']);
    expect(heads).not.toContain('Đã về các đợt trước');
    const sub = screen.getByText((_, el) => el?.classList.contains('page-head__sub') ?? false);
    expect(sub).toHaveTextContent('Theo bản gửi NCC lúc 09:05 02/11 · Xem bản in');
    expect(within(sub).getByRole('link', { name: 'Xem bản in' })).toHaveAttribute('href', '/admin/reports/snapshots/s-1/print');
  });

  it('món có đợt trước: dưới số Đề nghị mua có chữ nhỏ đỏ "đã nhận 4" (class ar-received); món chưa nhận đợt nào không có', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    expect(within(rowOf('Bút bi')).getByText('đã nhận 4')).toHaveClass('ar-received');
    expect(within(rowOf('Kẹp giấy')).queryByText(/đã nhận/)).toBeNull();
  });

  it('gom theo nhóm: đầu nhóm "sản phẩm a/b" theo số đã lưu, không "sau lưu"; chip "Thiếu 6" = đã lưu, không chip "Sau lưu"', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    const but = screen.getByRole('rowgroup', { name: 'Bút' });
    expect(but).toHaveTextContent('sản phẩm 0/1');
    expect(but).not.toHaveTextContent('sau lưu');
    const row = within(rowOf('Bút bi'));
    expect(row.getByText('Thiếu 6')).toHaveClass('tag');
    expect(row.queryByText(/Sau lưu/)).toBeNull();
    await type(box('Bút bi'), '0');
    expect(row.getByText('Thiếu 6')).toBeInTheDocument();
  });

  it('nhóm đã có món đủ: "sản phẩm 1/2"; dòng đã nhận đủ khóa: "✓ Đã nhận", không ô số, không nút NCC, chip "Nhận đủ hàng"', async () => {
    stub({ plan: plan([...PLAN.rows, planRow({ item_id: 'i-c', name: 'Bút chì', category_id: 'c-but', received: 10, remaining: 0 })]) });
    await open();
    const but = await screen.findByRole('rowgroup', { name: 'Bút' });
    expect(but).toHaveTextContent('sản phẩm 1/2');
    expect(but).not.toHaveTextContent('sau lưu');
    const row = within(rowOf('Bút chì'));
    expect(row.getByText('✓ Đã nhận')).toBeInTheDocument();
    expect(row.queryByRole('spinbutton')).toBeNull();
    expect(row.queryByRole('button', { name: /NCC hết hàng/ })).toBeNull();
    expect(row.getByText('Nhận đủ hàng', { selector: '.tag' })).toBeInTheDocument();
    expect(box('Bút bi')).toBeEnabled();
  });

  it('cột "Còn thiếu" luôn có: gõ đủ → "—", gõ thiếu → số thiếu; bảng cột cố định (gõ số, đổi nút nhóm không làm cột nhảy)', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    expectFixedColumns(screen.getByRole('table', { name: 'Hàng về theo món' }), { cssWidths: true });
    const shortCell = () => within(rowOf('Bút bi')).getAllByRole('cell')[4];
    expect(screen.getByRole('columnheader', { name: 'Còn thiếu' })).toBeInTheDocument();
    expect(shortCell()).toHaveTextContent('—');
    await type(box('Bút bi'), '4');
    expect(shortCell()).toHaveTextContent('2');
    await type(box('Bút bi'), '6');
    expect(shortCell()).toHaveTextContent('—');
    expect(screen.getByRole('columnheader', { name: 'Còn thiếu' })).toBeInTheDocument();
  });

  it('chip "NCC hết hàng" ở cột Tình trạng là chip nhỏ (tag--sm); nút nhóm có bề rộng cố định (ar-ghead__btn) cho cả hai chữ', async () => {
    stub({ plan: plan([...PLAN.rows, planRow({ item_id: 'i-x', name: 'Giấy than', category_id: 'c-but', adm_out: true })]) });
    await open();
    await screen.findByDisplayValue('6');
    expect(within(rowOf('Giấy than')).getByText('NCC hết hàng', { selector: '.tag' })).toHaveClass('tag--sm');
    expect(groupBtn('Bút')).toHaveClass('ar-ghead__btn');
  });

  it('chưa tick nhóm: không có dòng "Đã chọn…" và nút nhận hàng loạt; tick → "Nhận đủ hàng (1 nhóm)" + "Đã chọn 1 nhóm · 1 món" ngay trên hàng ô tìm; không còn "Lưu hàng về", "Điền đủ cả nhóm", "Đặt lại", "Hoàn tác"', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    expect(screen.queryByRole('button', { name: /^Nhận (đủ )?hàng \(\d+ nhóm\)$/ })).toBeNull();
    expect(screen.queryByText(/^Đã chọn \d+ nhóm/)).toBeNull();
    const slot = screen.getByText(/^Đang hiện \d+\/\d+ món$/).closest('.list-meta');
    await userEvent.click(pickBox('Kẹp & dán'));
    // Thế chỗ dòng đếm ngay trong ô cuối hàng tìm (không thêm hàng mới đẩy bảng xuống; màn rộng CSS ẩn dòng đếm); bỏ tick thì về như cũ
    expect(screen.getByText(/^Đang hiện \d+\/\d+ món$/)).toHaveClass('ar-count--picked');
    expect(pickedBtn().closest('.list-meta')).toBe(slot);
    expect(screen.getByText('Đã chọn 1 nhóm · 1 món').closest('.list-meta')).toBe(slot);
    expect(pickedBtn().closest('.toolbar')).toContainElement(screen.getByRole('searchbox', { name: /Tìm món/ }));
    expect(pickedBtn()).toHaveAccessibleName('Nhận đủ hàng (1 nhóm)');
    expect(pickedBtn()).toBeEnabled();
    expect(screen.getByText('Đã chọn 1 nhóm · 1 món')).toBeInTheDocument();
    for (const n of ['Lưu hàng về', 'Điền đủ cả nhóm', 'Đủ hàng', 'Đặt lại', 'Điền lại số gợi ý', 'Hoàn tác']) expect(screen.queryByRole('button', { name: n })).toBeNull();
    await userEvent.click(pickBox('Kẹp & dán'));
    expect(screen.getByText(/^Đang hiện \d+\/\d+ món$/).closest('.list-meta')).toBe(slot);
    expect(screen.getByText(/^Đang hiện \d+\/\d+ món$/)).not.toHaveClass('ar-count--picked');
    expect(screen.queryByText(/^Đã chọn \d+ nhóm/)).toBeNull();
  });

  it('chưa gửi NCC báo cáo tháng: lời nhắn + lối sang Báo cáo & gửi NCC; không ô nhận, không nút nhận, không thanh lọc', async () => {
    const makeup = [{ ym: '2026-09', rows: [{ key: 'i-a', item_id: 'i-a', name: 'Bút bi', name_en: null, unit: 'cay', stock_qty: 2, ordered: 7, received: 3, adm_owed: 4 }] }];
    stub({ plan: plan([planRow({ item_id: 'i-a', ordered: 10, remaining: 10, stock_qty: 5 })], { snapshot: null, makeup }) });
    await open();
    const gate = await screen.findByText('Chưa gửi NCC báo cáo tháng 10. Vào Báo cáo & gửi NCC để chốt trước khi nhận hàng.');
    expect(gate.closest('[role="status"]')).not.toBeNull();
    expect(within(gate.closest('section')!).getByRole('link', { name: 'Báo cáo & gửi NCC' })).toHaveAttribute('href', '/admin/reports');
    expect(screen.queryByRole('spinbutton', { name: /Nhận đợt này/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Nhận đủ hàng|^Nhận hàng/ })).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByLabelText('Ghi chú cho đợt này (không bắt buộc)')).toBeNull();
    // Về bù kỳ trước (kỳ đó đã gửi) vẫn nhận được
    expect(screen.getByText('Về bù kỳ trước (1)')).toBeInTheDocument();
  });

  it('tháng "Không cần đề nghị": không có hàng kỳ này để nhận — lời nhắn có giờ đánh dấu, không ô nhận; Về bù kỳ trước vẫn còn', async () => {
    const makeup = [{ ym: '2026-09', rows: [{ key: 'i-a', item_id: 'i-a', name: 'Bút bi', name_en: null, unit: 'cay', stock_qty: 2, ordered: 7, received: 3, adm_owed: 4 }] }];
    stub({ plan: plan([planRow({ ordered: 0, remaining: 0 })], { snapshot: null, no_order: { at: '2026-11-12T03:00:00.000Z', by_name: 'Hà' }, makeup }) });
    await open();
    expect(await screen.findByText('Tháng 10 không có đơn gửi NCC (10:00 12/11) — không có hàng kỳ này để nhận.')).toBeInTheDocument();
    expect(screen.queryByText(/Chưa gửi NCC báo cáo/)).toBeNull();
    expect(screen.queryByRole('spinbutton', { name: /Nhận đợt này/ })).toBeNull();
    expect(screen.getByText('Về bù kỳ trước (1)')).toBeInTheDocument();
  });

  it('cột Tình trạng: gõ 9/10 → chữ đỏ hai dòng "Nhập: 9" / "NCC còn nợ: 1" (không chip); gõ đủ 10 → giữ "Thiếu 10"; gõ 11 → chip "Dư 1"; sau nhập kho đổi theo', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await type(box('Kẹp giấy'), '9');
    const row = within(rowOf('Kẹp giấy'));
    const owe = row.getByText('NCC còn nợ: 1').parentElement!;
    expect(owe).toHaveClass('ar-owe');
    expect([...owe.children].map((c) => c.textContent)).toEqual(['Nhập: 9', 'NCC còn nợ: 1']);
    expect(row.queryByText('Thiếu 10')).toBeNull();
    await type(box('Kẹp giấy'), '10');
    expect(row.getByText('Thiếu 10')).toHaveClass('tag');
    expect(row.queryByText(/còn nợ/)).toBeNull();
    await type(box('Kẹp giấy'), '11');
    expect(row.getByText('Dư 1')).toHaveClass('tag');
    expect(row.queryByText(/Thiếu|Sau lưu/)).toBeNull();
    expect(within(rowOf('Kẹp giấy')).getAllByRole('cell').at(-1)).toHaveTextContent('11');
  });

  it('W14: hàng giảm sau khi gửi có nhãn, đầu trang đếm món', async () => {
    stub({ plan: plan([planRow({ item_id: 'i-a', reduced_after_snapshot: 3 }), planRow({ item_id: 'i-b', name: 'Kẹp giấy' })]) });
    await open();
    expect(await screen.findByText('Đã giảm 3 sau khi gửi NCC — phần dư vào tủ')).toBeInTheDocument();
    expect(screen.getByText('1 món đã giảm sau khi gửi NCC — phần dư sẽ vào tủ')).toBeInTheDocument();
  });

  it('món ngừng có trong bản in: ô nhập được + nhãn "Ngừng dùng — đã đặt trong bản in"; Lưu gửi món đó', async () => {
    const f = stub({ plan: plan([planRow({ item_id: 'i-off', name: 'Món ngừng', usable: false, inactive_reason: 'item', remaining: 3, stock_qty: 1 })]) });
    await open();
    expect(await screen.findByText('Ngừng dùng — đã đặt trong bản in')).toBeInTheDocument();
    expect(box('Món ngừng')).toBeEnabled();
    await userEvent.click(groupBtn('Bút'));
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
    const rowOf = async (name: string) => (await screen.findByRole('spinbutton', { name: `Nhận đợt này: ${name}` })).closest('tr')!;
    expect(within(await rowOf('Món ngừng')).getByText('Ngừng riêng')).toBeInTheDocument();
    expect(within(await rowOf('Kẹp giấy')).getByText('Ngừng theo nhóm')).toBeInTheDocument();
    expect(within(await rowOf('Bút bi')).queryByText(/^Ngừng (riêng|theo nhóm)$/)).not.toBeInTheDocument();
  });
});

describe('Hàng về — ô Nhận đợt này', () => {
  it('bấm vào ô thì tô hết số (gõ đè), không có nút ▲▼', async () => {
    stub();
    await open();
    const input = (await screen.findByDisplayValue('6')) as HTMLInputElement;
    const select = vi.spyOn(input, 'select');
    await userEvent.click(input);
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    expect(select).toHaveBeenCalled();
    expect(within(input.closest('td')!).queryByRole('button', { name: /^Thêm / })).toBeNull();
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
    expect(screen.queryByRole('spinbutton', { name: 'Nhận đợt này: Bút bi' })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('spinbutton', { name: 'Nhận đợt này: Bút bi' })).not.toBeInTheDocument();
    expect(box('Kẹp giấy')).toBeInTheDocument();
  });

  it('không khớp → "Không có món nào khớp" + "Xóa lọc"', async () => {
    stub();
    await open('/admin/arrivals?q=zzz');
    expect(await screen.findByText('Không có món nào khớp')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(box('Bút bi')).toBeInTheDocument();
    expect(loc()).toBe('');
  });

  it('lọc không xóa số đã gõ; nhóm đã tick đang bị lọc ẩn vẫn được lưu', async () => {
    const f = stub();
    await open();
    await screen.findByDisplayValue('6');
    await type(box('Bút bi'), '5');
    await userEvent.click(pickBox('Bút'));
    await userEvent.click(screen.getByRole('button', { name: 'Kẹp & dán 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Tất cả 2' }));
    expect(box('Bút bi')).toHaveValue(5);
    await userEvent.click(screen.getByRole('button', { name: 'Kẹp & dán 1' }));
    await userEvent.click(pickBox('Kẹp & dán'));
    await userEvent.click(pickedBtn());
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    expect(bodiesOf(f, RECEIPT_URL)[0].lines).toEqual([
      { item_id: 'i-a', qty: 5, expected_stock_qty: 2 },
      { item_id: 'i-b', qty: 10, expected_stock_qty: 0 },
    ]);
  });
});

describe('Hàng về — biên ô Về đợt này', () => {
  it('1 được; -1 lỗi gắn ô + nút nhóm và nút trên thanh tắt; 99999 được; 100000 "Tối đa 99.999"', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(pickBox('Bút'));
    await type(box('Bút bi'), '1');
    expect(box('Bút bi')).not.toHaveAttribute('aria-invalid', 'true');
    expect(groupBtn('Bút')).toBeEnabled();
    expect(pickedBtn()).toBeEnabled();
    await type(box('Bút bi'), '-1');
    expect(document.getElementById(box('Bút bi').getAttribute('aria-describedby') ?? '')).toHaveTextContent('Nhập số nguyên từ 0 trở lên');
    expect(groupBtn('Bút')).toBeDisabled();
    expect(pickedBtn()).toBeDisabled();
    await type(box('Bút bi'), '99999');
    expect(groupBtn('Bút')).toBeEnabled();
    await type(box('Bút bi'), '100000');
    expect(document.getElementById(box('Bút bi').getAttribute('aria-describedby') ?? '')).toHaveTextContent('Tối đa 99.999');
    expect(groupBtn('Bút')).toBeDisabled();
  });

  it('xóa trống ô rồi rời ô → về "0", không báo lỗi', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.clear(box('Bút bi'));
    expect(box('Bút bi')).not.toHaveAttribute('aria-invalid', 'true');
    await userEvent.tab();
    expect(box('Bút bi')).toHaveDisplayValue('0');
    expect(box('Bút bi')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('Nhập số nguyên từ 0 trở lên')).toBeNull();
  });

  it('kỳ chưa khóa: thông báo, không bảng', async () => {
    stub({ summary: FUTURE });
    await open();
    expect(await screen.findByText('Kỳ tháng 10 chưa khóa sổ — xem được từ 00:00 ngày 11/10.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nhận (đủ )?hàng/ })).not.toBeInTheDocument();
  });

  it('giao diện tiếng Anh: tên món theo name_en', async () => {
    stub();
    await i18n.changeLanguage('en');
    try {
      mockViewport(1280);
      renderApp(makeMe('admin'), '/admin/arrivals');
      expect(await screen.findByRole('spinbutton', { name: 'Received now: Ballpoint pen' })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});
