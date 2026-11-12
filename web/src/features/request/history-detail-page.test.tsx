import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { PERIOD, PEN, NOTE, facts, stubRequestApi, view } from '@/test/request-api-stub';

afterEach(() => vi.unstubAllGlobals());

const past = (lines: ReturnType<typeof lineView>[], extra: Partial<ReturnType<typeof view>> = {}) =>
  stubRequestApi({ others: { '2026-10': view({ period_ym: '2026-10', is_open: false, lines, ...extra }) } });

const L = (id: string, name: string, over: Partial<ReturnType<typeof lineView>> = {}) => lineView({ id, custom_name: name, custom_unit: 'cay', qty: 1, ...over });
const rowOf = (name: string) => screen.getByRole('rowheader', { name }).closest('tr')!;

describe('HistoryDetailPage', () => {
  it('chi tiết: tiêu đề, phụ đề "5 loại món · 5 đơn vị · lưu lúc 07/11 21:38 · Phòng Test", chip "Đang giao · đã nhận 2/5 món"', async () => {
    past([
      L('1', 'Bút bảng', { delivered_qty: 1, last_delivered_at: '2026-11-08T02:10:00.000Z' }),
      L('2', 'Bút bi', { delivered_qty: 1, last_delivered_at: '2026-11-08T02:10:00.000Z' }),
      L('3', 'Bút dạ'),
      L('4', 'Bút kim'),
      L('5', 'Bút chì'),
    ], {
      updated_at: '2026-11-09T03:00:00.000Z',
      saved_at: '2026-11-07T14:38:00.000Z',
      department: 'Phòng Test',
      removed_lines: [{ name: 'Bút ghi đĩa', name_en: null, unit: 'cay', before: 1, reason_code: 'adm_out_of_stock', reason_note: null, at: '2026-11-08T01:30:00.000Z' }],
    });
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByRole('heading', { name: 'Phiếu tháng 10/2026' })).toBeInTheDocument();
    expect(screen.getByText('5 loại món · 5 đơn vị · lưu lúc 07/11 21:38 · Phòng Test')).toBeInTheDocument();
    expect(screen.getByText('Đang giao · đã nhận 2/5 món')).toBeInTheDocument();
  });

  it('món ngoài danh mục không cộng vào số món: "1 loại món · 2 đơn vị · 1 sản phẩm ngoài danh mục, chờ phê duyệt"', async () => {
    past([L('1', 'Bút bảng', { qty: 2 }), L('2', 'Ghim bấm loại lớn', { review_status: 'pending' })], { saved_at: '2026-11-07T14:38:00.000Z', department: null });
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByText(/^1 loại món · 2 đơn vị · 1 sản phẩm ngoài danh mục, chờ phê duyệt/)).toBeInTheDocument();
  });

  it('đầu chi tiết: món ngoài DM đã duyệt và món tạm ngưng chưa giao không vào số món/đơn vị/chip giao', async () => {
    past(
      [
        L('1', 'Bút bảng', { qty: 2, delivered_qty: 2 }),
        L('2', 'Bìa còng', { qty: 3, review_status: 'accepted' }),
        L('3', 'Bút dạ', { qty: 4, item_id: 'i-3', item: { name: 'Bút dạ', name_en: null, unit: 'cay', pack_note: null, image_file_id: null, active: false, admin_only: false } }),
      ],
      { saved_at: '2026-11-07T14:38:00.000Z', department: null },
    );
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByText(/^1 loại món · 2 đơn vị · 1 món đã chấp nhận/)).toBeInTheDocument();
    expect(screen.getByText('Đã nhận đủ')).toBeInTheDocument();
  });

  it('bảng Món · ĐVT · Đăng ký · Được giao · Đã nhận · Tình trạng · Ghi chú; ghi chú "Nhận 09:10 08/11" và "Adm D&E bỏ món · Không có hàng"', async () => {
    past([L('1', 'Bút bảng', { delivered_qty: 1, last_delivered_at: '2026-11-08T02:10:00.000Z' }), L('3', 'Bút dạ')], {
      removed_lines: [{ name: 'Bút ghi đĩa', name_en: null, unit: 'cay', before: 1, reason_code: 'adm_out_of_stock', reason_note: null, at: '2026-11-08T01:30:00.000Z' }],
    });
    renderApp(makeMe('member'), '/history/2026-10');
    for (const h of ['Món', 'ĐVT', 'Đăng ký', 'Được giao', 'Đã nhận', 'Tình trạng', 'Ghi chú']) expect(await screen.findByRole('columnheader', { name: h })).toBeInTheDocument();
    expect(within(rowOf('Bút bảng')).getByText('Đã nhận 1/1')).toBeInTheDocument();
    expect(within(rowOf('Bút bảng')).getByText('Nhận 09:10 08/11')).toBeInTheDocument();
    expect(within(rowOf('Bút dạ')).getByText('Chờ 1')).toBeInTheDocument();
    expect(within(rowOf('Bút ghi đĩa')).getByText('Không giao')).toBeInTheDocument();
    expect(within(rowOf('Bút ghi đĩa')).getByText('Adm D&E bỏ món · Không có hàng')).toBeInTheDocument();
  });

  it('bảng chi tiết có colgroup khớp số cột (cột Ghi chú bỏ thì col cũng bỏ), chỉ cột Món không đặt bề rộng: đổi tháng thì cột không co giãn theo chữ', async () => {
    past([L('1', 'Bút bảng')]);
    renderApp(makeMe('member'), '/history/2026-10');
    const table = (await screen.findByRole('columnheader', { name: 'Món' })).closest('table')!;
    const cols = [...table.querySelectorAll(':scope > colgroup > col')];
    expect(cols).toHaveLength(table.querySelectorAll('thead th').length);
    expect(cols.filter((c) => !c.className)).toHaveLength(1);
    expect(cols[0]!.className).toBe('');
  });

  it('ô Ghi chú trống không ghi gì (thẻ không còn "Ghi chú:" trơ trọi); cả cột trống thì bỏ cột', async () => {
    past([L('1', 'Bút bảng', { delivered_qty: 1, last_delivered_at: '2026-11-08T02:10:00.000Z' }), L('3', 'Bút dạ')]);
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByRole('columnheader', { name: 'Ghi chú' })).toBeInTheDocument();
    const empty = rowOf('Bút dạ').querySelector('td.hs-note')!;
    expect(empty).toBeEmptyDOMElement();
  });

  it('không dòng nào có ghi chú → không có cột Ghi chú', async () => {
    past([L('1', 'Bút bảng'), L('3', 'Bút dạ')]);
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByRole('columnheader', { name: 'Tình trạng' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Ghi chú' })).toBeNull();
    expect(document.querySelector('td.hs-note')).toBeNull();
  });

  it('khối "Điều chỉnh của Adm D&E": "08/11 08:30 · Bút ghi đĩa 1 thành 0 · Lý do: Không có hàng"; lý do cũ over_quota hiện "Vượt định mức"', async () => {
    past(
      [L('1', 'Bút bi', { qty: 2, adjustments: [{ before: 3, after: 2, reason_code: 'over_quota', reason_note: null, at: '2026-11-08T02:00:00.000Z' }] })],
      { removed_lines: [{ name: 'Bút ghi đĩa', name_en: null, unit: 'cay', before: 1, reason_code: 'adm_out_of_stock', reason_note: null, at: '2026-11-08T01:30:00.000Z' }] },
    );
    renderApp(makeMe('member'), '/history/2026-10');
    const box = (await screen.findByRole('heading', { name: 'Điều chỉnh của Adm D&E' })).closest('section')!;
    expect(within(box).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '08/11 08:30 · Bút ghi đĩa 1 thành 0 · Lý do: Không có hàng',
      '08/11 09:00 · Bút bi 3 thành 2 · Lý do: Vượt định mức',
    ]);
  });

  it('dòng ngoài DM: nhãn theo trạng thái, lý do từ chối hiển thị, dòng chờ/từ chối không có hàng', async () => {
    past([
      lineView({ id: 'a', custom_name: 'Bìa còng', custom_unit: 'cai', review_status: 'pending' }),
      lineView({ id: 'b', custom_name: 'Bút lông', custom_unit: 'cai', review_status: 'accepted', qty: 2, delivered_qty: 1 }),
      lineView({ id: 'c', custom_name: 'Giấy màu', custom_unit: 'ram', review_status: 'converted' }),
      lineView({ id: 'd', custom_name: 'Kéo', custom_unit: 'cai', review_status: 'rejected', review_note: 'Đã có trong kho' }),
    ]);
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByText('Sản phẩm ngoài danh mục, chờ phê duyệt')).toBeInTheDocument();
    expect(screen.getByText('Đã chấp nhận')).toBeInTheDocument();
    expect(screen.getByText('Đã thêm vào danh mục')).toBeInTheDocument();
    expect(screen.getByText('Từ chối: Đã có trong kho')).toBeInTheDocument();
    expect(within(rowOf('Kéo')).queryByText(/Chờ \d/)).toBeNull();
  });

  it('kỳ đang mở: chuyển về / (không có bản chỉ đọc)', async () => {
    past([]);
    renderApp(makeMe('member'), '/history/2026-11');
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(/^\/$/));
  });

  it('không có phiếu kỳ đó: báo "Không có phiếu tháng này"', async () => {
    stubRequestApi();
    renderApp(makeMe('member'), '/history/2026-09');
    expect(await screen.findByText('Không có phiếu tháng này')).toBeInTheDocument();
  });

  it('kỳ sau kỳ đang mở: báo không có phiếu, không hiện lỗi "Thử lại"', async () => {
    stubRequestApi();
    renderApp(makeMe('member'), '/history/2026-12');
    expect(await screen.findByText('Không có phiếu tháng này')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('INVALID_PERIOD từ api coi như không có phiếu (không phải lỗi tải)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve(
          url === '/api/periods/current'
            ? jsonResponse(200, { ...PERIOD, ym: '2026-09' })
            : url.startsWith('/api/me/request?')
              ? jsonResponse(400, { code: 'INVALID_PERIOD' })
              : jsonResponse(200, { items: [], next_cursor: null }),
        ),
      ),
    );
    renderApp(makeMe('member'), '/history/2026-08');
    expect(await screen.findByText('Không có phiếu tháng này')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dòng 5 giao 3 hủy 2: "Đã nhận 3/3" và ghi chú "đã hủy 2 — lý do"', async () => {
    past([lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 5, delivered_qty: 3, cancelled_qty: 2, cancel_note: 'Người đã nghỉ' })]);
    renderApp(makeMe('member'), '/history/2026-10');
    const row = (await screen.findByRole('rowheader', { name: PEN.name })).closest('tr')!;
    expect(within(row).getByText('Đã nhận 3/3')).toBeInTheDocument();
    expect(within(row).getByText('đã hủy 2 — Người đã nghỉ')).toBeInTheDocument();
  });

  it('hủy hết 5: "Không giao" + "Đã hủy 5 — lý do"', async () => {
    past([lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 5, cancelled_qty: 5, cancel_note: 'Hết hàng' })]);
    renderApp(makeMe('member'), '/history/2026-10');
    const row = (await screen.findByRole('rowheader', { name: PEN.name })).closest('tr')!;
    expect(within(row).getByText('Không giao')).toBeInTheDocument();
    expect(within(row).getByText('Đã hủy 5 — Hết hàng')).toBeInTheDocument();
  });

  it('lý do hủy rỗng/khoảng trắng → "đã hủy n" không có dấu gạch; hủy hết cũng vậy', async () => {
    past([
      lineView({ id: 'a', item_id: PEN.id, item: facts(PEN), qty: 5, delivered_qty: 1, cancelled_qty: 2, cancel_note: '  ' }),
      lineView({ id: 'b', item_id: NOTE.id, item: facts(NOTE), qty: 3, cancelled_qty: 3, cancel_note: null }),
    ]);
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByText('đã hủy 2')).toBeInTheDocument();
    expect(screen.getByText('Đã hủy 3')).toBeInTheDocument();
    expect(screen.queryByText(/—/)).toBeNull();
  });
});
