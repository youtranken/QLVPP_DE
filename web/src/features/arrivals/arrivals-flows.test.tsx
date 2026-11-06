import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { customRow, plan, planRow } from './arrivals-fixtures';
import { CUSTOM_URL, PLAN, PLAN_URL, RECEIPT_URL, bodiesOf, box, callsTo, open, saveBtn, stub, type } from './arrivals-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

const fullBtn = () => screen.getByRole('button', { name: 'Đủ hàng' });

describe('Lưu — hộp W15 khi khác bản in', () => {
  it('về 3/7 Bút bi và 2/2 Kẹp → hộp liệt kê 1 món; Quay lại → 0 request', async () => {
    const f = stub({ plan: plan([planRow({ item_id: 'i-a', remaining: 7 }), planRow({ item_id: 'i-b', name: 'Kẹp giấy', remaining: 2 })]) });
    await open();
    await screen.findByDisplayValue('7');
    await type(box('Bút bi'), '3');
    await userEvent.click(saveBtn());
    const dlg = await screen.findByRole('dialog');
    expect(dlg).toHaveTextContent('Đợt này khác bản in ở 1 món: Bút bi: về 3 / còn 7. Phần thiếu chờ đợt sau.');
    await userEvent.click(within(dlg).getByRole('button', { name: 'Quay lại' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(0);
  });

  it('khớp hết → 0 hộp, 1 request đúng body (expected_stock_qty = tủ, ym kỳ khóa, ghi chú)', async () => {
    const f = stub();
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.type(screen.getByRole('textbox', { name: 'Ghi chú cho đợt này (không bắt buộc)' }), 'đợt 2');
    await userEvent.click(saveBtn());
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodiesOf(f, RECEIPT_URL)[0]).toEqual({
      lines: [
        { item_id: 'i-a', qty: 6, expected_stock_qty: 2 },
        { item_id: 'i-b', qty: 10, expected_stock_qty: 0 },
      ],
      ym: '2026-10',
      note: 'đợt 2',
    });
    expect(await screen.findByText('Đã nhập 2 món vào tủ.')).toBeInTheDocument();
  });

  it('12 món khác → 8 dòng + "và 4 món khác"', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => planRow({ item_id: `m${i}`, name: `Món ${i + 1}`, remaining: 5 }));
    stub({ plan: plan(rows) });
    await open();
    await screen.findAllByDisplayValue('5');
    for (let i = 1; i <= 12; i++) await type(box(`Món ${i}`), '1');
    await userEvent.click(saveBtn());
    const dlg = await screen.findByRole('dialog');
    expect(within(dlg).getAllByRole('listitem')).toHaveLength(9);
    expect(dlg).toHaveTextContent('Đợt này khác bản in ở 12 món');
    expect(within(dlg).getByText('và 4 món khác')).toBeInTheDocument();
    expect(dlg).toHaveTextContent('Món 8: về 1 / còn 5');
    expect(dlg).not.toHaveTextContent('Món 9: về');
  });

  it('409 STALE_UPDATE → "Hàng về vừa được ghi ở nơi khác — tải lại." và tải lại kế hoạch', async () => {
    const f = stub({ receipt: () => jsonResponse(409, { code: 'STALE_UPDATE', item_id: 'i-a' }) });
    await open();
    await screen.findByDisplayValue('6');
    const before = callsTo(f, PLAN_URL).length;
    await userEvent.click(saveBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Hàng về vừa được ghi ở nơi khác — tải lại.');
    await waitFor(() => expect(callsTo(f, PLAN_URL).length).toBeGreaterThan(before));
  });

  it('404 ITEM_NOT_FOUND → báo tên món', async () => {
    stub({ receipt: () => jsonResponse(404, { code: 'ITEM_NOT_FOUND', item_id: 'i-a' }) });
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(saveBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Bút bi');
  });
});

describe('"Đủ hàng" — hộp W18', () => {
  const FULL = plan(
    [
      planRow({ item_id: 'a', name: 'A', remaining: 6, stock_qty: 1 }),
      planRow({ item_id: 'b', name: 'B', remaining: 0, received: 10 }),
      planRow({ item_id: 'c', name: 'C', remaining: 4, stock_qty: 3 }),
      planRow({ item_id: 'd', name: 'D', remaining: 5, adm_out: true }),
      planRow({ item_id: 'e', name: 'E', remaining: 2, usable: false }),
    ],
    { custom: [customRow({ remaining: 2 })] },
  );

  it('tóm tắt "Nhập 2 món, 10 đơn vị…" + bỏ qua có số; Xác nhận → 1 POST 2 dòng + ghi ngoài DM; bấm đúp → 1 request', async () => {
    const f = stub({ plan: FULL });
    await open();
    await screen.findByDisplayValue('6');
    await type(box('A'), '1');
    await userEvent.click(fullBtn());
    const dlg = await screen.findByRole('dialog');
    expect(dlg).toHaveTextContent('Nhập 2 món, 10 đơn vị vào tủ theo bản in 09:05 02/11.');
    for (const s of ['1 món ADM hết hàng', '1 món đã ngừng', '1 món đã về đủ', 'Các số đang gõ ở bảng sẽ được thay.']) expect(dlg).toHaveTextContent(s);
    expect(dlg).toHaveTextContent('Ghi "Đã về" 1 món ngoài danh mục');
    const ok = within(dlg).getByRole('button', { name: 'Nhập vào tủ' });
    await userEvent.dblClick(ok);
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    expect(bodiesOf(f, RECEIPT_URL)[0]).toEqual({
      lines: [
        { item_id: 'a', qty: 6, expected_stock_qty: 1 },
        { item_id: 'c', qty: 4, expected_stock_qty: 3 },
      ],
      ym: '2026-10',
    });
    await waitFor(() => expect(bodiesOf(f, CUSTOM_URL)).toHaveLength(1));
    expect(bodiesOf(f, CUSTOM_URL)[0]).toEqual({ line_key: 'custom:["kéo cắt giấy", "cái"]', qty: 2, expected_received: 0 });
    expect(await screen.findByText('Đã nhập 2 món vào tủ')).toBeInTheDocument();
  });

  it('chưa có bản chốt → vô hiệu "Chưa in trình ký gửi ADM"', async () => {
    stub({ plan: plan([planRow({ remaining: 3 })], { snapshot: null }) });
    await open();
    await screen.findByDisplayValue('3');
    expect(fullBtn()).toBeDisabled();
    expect(screen.getByText('Chưa in trình ký gửi ADM')).toBeInTheDocument();
  });

  it('có bản, 1 hàng remaining 1 (+ 1 hàng ADM) → bật', async () => {
    stub({ plan: plan([planRow({ remaining: 1 }), planRow({ item_id: 'x', remaining: 4, adm_out: true })]) });
    await open();
    await screen.findByDisplayValue('1');
    expect(fullBtn()).toBeEnabled();
  });

  it('409 STALE_UPDATE từ "Đủ hàng" → báo và tải lại kế hoạch', async () => {
    const f = stub({ receipt: () => jsonResponse(409, { code: 'STALE_UPDATE' }) });
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(fullBtn());
    const before = callsTo(f, PLAN_URL).length;
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Nhập vào tủ' }));
    expect(await screen.findByText('Hàng về vừa được ghi ở nơi khác — tải lại.')).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, PLAN_URL).length).toBeGreaterThan(before));
  });
});

describe('Trạng thái "đã về đủ"', () => {
  const batches = [
    { at: '2026-11-03T03:30:00.000Z', actor_name: 'Lê Bình', items: 1, units: 6, note: 'đợt 2' },
    { at: '2026-11-02T03:00:00.000Z', actor_name: 'Lê Bình', items: 2, units: 14, note: null },
  ];

  it('mọi remaining 0 → khối xong + "Sang Giao hàng →" + danh sách 2 đợt; không bảng số, Đủ hàng vô hiệu', async () => {
    stub({ plan: plan([planRow({ received: 10, remaining: 0 }), planRow({ item_id: 'b', name: 'Kẹp', received: 10, remaining: 0 }), planRow({ item_id: 'x', adm_out: true })], { batches }) });
    await open();
    expect(await screen.findByText('Hàng kỳ tháng 10 đã về đủ — 2 món, 20 đơn vị (nhập lần cuối 10:30 03/11).')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sang Giao hàng →' })).toHaveAttribute('href', '/admin/delivery');
    const list = screen.getByRole('table', { name: 'Các đợt đã nhập' });
    expect(within(list).getAllByRole('row')).toHaveLength(3);
    expect(list).toHaveTextContent('đợt 2');
    expect(screen.queryByRole('spinbutton', { name: /Về đợt này/ })).not.toBeInTheDocument();
    expect(fullBtn()).toBeDisabled();
    expect(screen.getByText('Đã về đủ theo bản in')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Tìm món để thêm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ADM hết hàng: Bút bi' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('còn 1 hàng remaining 1 → bảng thường, không khối xong', async () => {
    stub({ plan: plan([planRow({ received: 9, remaining: 1 })], { batches }) });
    await open();
    expect(await screen.findByDisplayValue('1')).toBeInTheDocument();
    expect(screen.queryByText(/đã về đủ —/)).not.toBeInTheDocument();
  });
});

describe('Về bù kỳ trước', () => {
  const MAKEUP = plan(PLAN.rows, {
    makeup: [{ ym: '2026-09', rows: [{ key: 'i-a', item_id: 'i-a', name: 'Bút bi', name_en: null, unit: 'cay', stock_qty: 2, ordered: 7, received: 3, adm_owed: 4 }] }],
  });

  it('nhập 4 → POST ym kỳ cũ (2026-09), không đụng kỳ 10', async () => {
    const f = stub({ plan: MAKEUP });
    await open();
    const summary = await screen.findByText('Về bù kỳ trước (1)');
    await userEvent.click(summary);
    const row = within(summary.closest('details') as HTMLElement).getByRole('row', { name: /Bút bi/ });
    expect(row).toHaveTextContent('9');
    expect(row).toHaveTextContent('4');
    await type(within(row).getByRole('spinbutton', { name: 'Về bù đợt này: Bút bi (tháng 9)' }), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu về bù' }));
    await waitFor(() => expect(bodiesOf(f, RECEIPT_URL)).toHaveLength(1));
    expect(bodiesOf(f, RECEIPT_URL)[0]).toEqual({ lines: [{ item_id: 'i-a', qty: 4, expected_stock_qty: 2 }], ym: '2026-09' });
  });

  it('"ADM không giao nữa" → PUT adm-owed-closed của kỳ cũ; Hoàn tác → DELETE', async () => {
    const url = '/api/admin/periods/2026-09/adm-owed-closed/';
    const f = stub({ plan: MAKEUP, routes: { [url]: (init) => jsonResponse(init?.method === 'PUT' ? 200 : 204, {}) } });
    await open();
    await userEvent.click(await screen.findByText('Về bù kỳ trước (1)'));
    await userEvent.click(screen.getByRole('button', { name: 'ADM không giao nữa: Bút bi (tháng 9)' }));
    await waitFor(() => expect(callsTo(f, url, 'PUT')).toEqual([`${url}i-a`]));
    await userEvent.click(await screen.findByRole('button', { name: 'Hoàn tác' }));
    await waitFor(() => expect(callsTo(f, url, 'DELETE')).toHaveLength(1));
  });
});

describe('Món ngoài danh mục', () => {
  it('khối thu gọn có số; ô "Đã về" → POST custom-receipts với expected_received; khóa custom: mã hóa ở nút ADM hết hàng', async () => {
    const key = 'custom:["kéo cắt giấy", "cái"]';
    const admUrl = `/api/admin/periods/2026-10/adm-out/${encodeURIComponent(key)}`;
    const f = stub({ plan: plan(PLAN.rows, { custom: [customRow({ received: 1, remaining: 1 })] }), routes: { [admUrl]: () => jsonResponse(200, {}) } });
    await open();
    await userEvent.click(await screen.findByText('Món ngoài danh mục — giao thẳng, không vào tủ (1)'));
    await type(screen.getByRole('spinbutton', { name: 'Đã về đợt này: Kéo cắt giấy' }), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Ghi đã về: Kéo cắt giấy' }));
    await waitFor(() => expect(bodiesOf(f, CUSTOM_URL)).toEqual([{ line_key: key, qty: 1, expected_received: 1 }]));
    await userEvent.click(screen.getByRole('button', { name: 'ADM hết hàng: Kéo cắt giấy' }));
    await waitFor(() => expect(callsTo(f, admUrl, 'PUT')).toEqual([admUrl]));
  });
});
