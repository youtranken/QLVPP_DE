import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { plan, planRow } from './arrivals-fixtures';
import { PLAN, PLAN_URL, RECEIPT_URL, bodiesOf, box, callsTo, groupBtn, open, pickBox, pickedBtn, stub, type } from './arrivals-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

const rowOf = (name: string) => screen.getByRole('row', { name: new RegExp(name) });

// Thao tác theo nhóm trên trang Nhận hàng: nhận đủ cả nhóm, đánh dấu NCC hết hàng
describe('Nhận hàng — "Nhận đủ hàng" theo nhóm', () => {
  const KEP = [
    planRow({ item_id: 'k1', name: 'Kẹp 1', category_id: 'c-kep', ordered: 3, remaining: 3 }),
    planRow({ item_id: 'k2', name: 'Kẹp 2', category_id: 'c-kep', ordered: 4, remaining: 4 }),
    planRow({ item_id: 'k3', name: 'Kẹp 3', category_id: 'c-kep', remaining: 5, adm_out: true }),
    planRow({ item_id: 'k4', name: 'Kẹp ngừng', category_id: 'c-kep', ordered: 2, remaining: 2, usable: false }),
    planRow({ item_id: 'k5', name: 'Kẹp đủ', category_id: 'c-kep', ordered: 2, received: 2, remaining: 0 }),
  ];
  const BUT = planRow({ item_id: 'b1', name: 'Bút 1', category_id: 'c-but', remaining: 6, stock_qty: 1 });

  it('tick nhóm Kẹp → "Nhận đủ hàng (1 nhóm)"; bấm → 1 POST chỉ dòng nhóm Kẹp: ô chưa gõ = phần còn thiếu, ô đã gõ = đúng số, bỏ NCC hết hàng và dòng đủ; không hộp xác nhận; xong bỏ tick', async () => {
    const f = stub({ plan: plan([BUT, ...KEP]) });
    await open();
    await screen.findByDisplayValue('6');
    await type(box('Kẹp 2'), '1');
    await userEvent.click(pickBox('Kẹp & dán'));
    expect(pickBox('Kẹp & dán')).toBeChecked();
    await userEvent.click(pickedBtn());
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodiesOf(f, RECEIPT_URL)[0].lines).toEqual([
      { item_id: 'k1', qty: 3, expected_stock_qty: 0 },
      { item_id: 'k2', qty: 1, expected_stock_qty: 0 },
      { item_id: 'k4', qty: 2, expected_stock_qty: 0 },
    ]);
    await waitFor(() => expect(pickBox('Kẹp & dán')).not.toBeChecked());
  });

  it('nút "Nhận đủ hàng" đầu nhóm lưu ngay nhóm đó (1 POST, không hộp), giữ số đang gõ ở nhóm khác', async () => {
    const f = stub({ plan: plan([BUT, ...KEP]) });
    await open();
    await screen.findByDisplayValue('6');
    await type(box('Bút 1'), '2');
    await userEvent.click(groupBtn('Kẹp & dán'));
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodiesOf(f, RECEIPT_URL)[0].lines.map((l: { item_id: string }) => l.item_id)).toEqual(['k1', 'k2', 'k4']);
    expect(await screen.findByText('Đã nhập 3 món vào tủ.')).toBeInTheDocument();
    expect(box('Bút 1')).toHaveValue(2);
  });

  it('lưu thiếu rồi lưu nốt: món gõ 0 trong nhóm vừa lưu về lại số điền sẵn (phần còn thiếu), lần "Nhận đủ hàng" sau nhận cả món đó', async () => {
    const f = stub({ plan: plan([BUT, ...KEP]) });
    await open();
    await screen.findByDisplayValue('6');
    await type(box('Kẹp 2'), '0');
    await userEvent.click(groupBtn('Kẹp & dán'));
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    expect(bodiesOf(f, RECEIPT_URL)[0].lines.map((l: { item_id: string }) => l.item_id)).toEqual(['k1', 'k4']);
    expect(await screen.findByText('Đã nhập 2 món vào tủ.')).toBeInTheDocument();
    await waitFor(() => expect(box('Kẹp 2')).toHaveValue(4));
    await userEvent.click(groupBtn('Kẹp & dán'));
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(2));
    expect(bodiesOf(f, RECEIPT_URL)[1].lines.map((l: { item_id: string }) => l.item_id)).toContain('k2');
  });

  it('món thêm bằng "Thêm món khác" chưa gõ số không bị bỏ khi nhóm của nó "Nhận đủ hàng"; ghi chú đi theo đợt vừa lưu rồi xóa', async () => {
    const f = stub();
    await open();
    await screen.findByDisplayValue('6');
    const combo = screen.getByRole('combobox', { name: 'Tìm món để thêm' });
    await userEvent.click(combo);
    await userEvent.type(combo, 'buom');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(box('Kẹp bướm')).toHaveValue(0);
    await userEvent.type(screen.getByLabelText('Ghi chú cho đợt này (không bắt buộc)'), 'đợt 1');
    await userEvent.click(groupBtn('Kẹp & dán'));
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    const body = bodiesOf(f, RECEIPT_URL)[0];
    expect(body.lines.map((l: { item_id: string }) => l.item_id)).toEqual(['i-b']);
    expect(body.note).toBe('đợt 1');
    expect(await screen.findByText('Đã nhập 1 món vào tủ.')).toBeInTheDocument();
    expect(box('Kẹp bướm')).toHaveValue(0);
    expect(screen.getByLabelText('Ghi chú cho đợt này (không bắt buộc)')).toHaveValue('');
  });

  it('nhóm mọi ô 0 → nút nhóm tắt; nhóm chỉ còn dòng đủ hoặc NCC hết hàng → ô tick tắt, không nút nhóm', async () => {
    stub({ plan: plan([BUT, planRow({ item_id: 'k5', name: 'Kẹp đủ', category_id: 'c-kep', ordered: 2, received: 2, remaining: 0 }), planRow({ item_id: 'k3', name: 'Kẹp 3', category_id: 'c-kep', adm_out: true })]) });
    await open();
    await screen.findByDisplayValue('6');
    expect(pickBox('Kẹp & dán')).toBeDisabled();
    expect(within(screen.getByRole('rowgroup', { name: 'Kẹp & dán' })).queryByRole('button', { name: 'Nhận đủ hàng' })).toBeNull();
    await type(box('Bút 1'), '0');
    expect(groupBtn('Bút')).toBeDisabled();
  });
});

describe('Hàng về — NCC hết hàng', () => {
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
    const btn = screen.getByRole('button', { name: 'NCC hết hàng: Bút bi' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'true'));
    expect(callsTo(f, ADM_URL, 'PUT')).toEqual([`${ADM_URL}i-a`]);
    expect(box('Bút bi')).toHaveValue(0);
    expect(box('Bút bi')).toBeDisabled();
    expect(within(rowOf('Bút bi')).getByText('NCC hết hàng', { selector: '.tag' })).toBeInTheDocument();
    await userEvent.click(btn);
    await waitFor(() => expect(btn).toHaveAttribute('aria-pressed', 'false'));
    expect(callsTo(f, ADM_URL, 'DELETE')).toHaveLength(1);
    expect(box('Bút bi')).toHaveValue(6);
    expect(box('Bút bi')).toBeEnabled();
  });

  it('dòng NCC hết hàng chưa nhận đủ: dưới tên chỉ ghi "NCC hết hàng – tủ còn x", kể cả tủ 0', async () => {
    stub({ plan: plan([planRow({ item_id: 'i-a', remaining: 5, stock_qty: 2, adm_out: true }), planRow({ item_id: 'i-b', name: 'Kẹp giấy', category_id: 'c-kep', remaining: 3, stock_qty: 0, adm_out: true }), planRow({ item_id: 'i-c', name: 'Bút chì' })]) });
    await open();
    await screen.findByDisplayValue('10');
    expect(within(rowOf('Bút bi')).getByText('NCC hết hàng – tủ còn 2')).toHaveClass('ar-note');
    expect(within(rowOf('Kẹp giấy')).getByText('NCC hết hàng – tủ còn 0')).toBeInTheDocument();
    expect(screen.queryByText(/hủy/)).toBeNull();
  });

  it('đã xử lý xong → nút khóa "NCC hết hàng · đã xử lý xong"; lỗi ADM_OUT_FINAL → báo lỗi, tải lại kế hoạch', async () => {
    const f = stub({
      plan: plan([planRow({ item_id: 'i-a', adm_out: true, adm_out_final: true }), planRow({ item_id: 'i-b', name: 'Kẹp giấy', adm_out: true }), planRow({ item_id: 'i-c', name: 'Bút chì', remaining: 2 })]),
      routes: { [ADM_URL]: () => jsonResponse(409, { code: 'ADM_OUT_FINAL' }) },
    });
    await open();
    expect(await screen.findByRole('button', { name: 'NCC hết hàng · đã xử lý xong: Bút bi' })).toBeDisabled();
    const before = callsTo(f, PLAN_URL).length;
    await userEvent.click(screen.getByRole('button', { name: 'NCC hết hàng: Kẹp giấy' }));
    expect(await screen.findByText('Các dòng của món này đã giao/hủy xong — không bỏ đánh dấu được nữa.')).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, PLAN_URL).length).toBeGreaterThan(before));
  });
});
