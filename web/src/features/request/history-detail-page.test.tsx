import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { PERIOD, PEN, NOTE, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';

afterEach(() => vi.unstubAllGlobals());

const past = (lines: ReturnType<typeof lineView>[], extra: Partial<ReturnType<typeof view>> = {}) =>
  stubRequestApi({ others: { '2026-10': view({ period_ym: '2026-10', is_open: false, lines, ...extra }) } });

const L = (id: string, name: string, over: Partial<ReturnType<typeof lineView>> = {}) => lineView({ id, custom_name: name, custom_unit: 'cay', qty: 1, ...over });
const rowOf = (name: string) => screen.getByRole('rowheader', { name: new RegExp(`^${name}`) }).closest('tr')!;

describe('HistoryDetailPage', () => {
  it('chi tiết: tiêu đề, phụ đề "5 loại món · 5 đơn vị · lưu lúc 07/11 · 21:38" (không "· Phòng"), nhãn "Còn chờ 3 món" như danh sách tháng', async () => {
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
    expect(screen.getByText('5 loại món · 5 đơn vị · lưu lúc 07/11 · 21:38')).toBeInTheDocument();
    expect(screen.queryByText(/Phòng Test/)).toBeNull();
    expect(screen.getByText('Còn chờ 3 món')).toBeInTheDocument();
    expect(screen.queryByText(/Đã giao \d/)).toBeNull();
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
        L('3', 'Bút dạ', { qty: 4, item_id: 'i-3', item: { name: 'Bút dạ', name_en: null, unit: 'cay', pack_note: null, image_file_id: null, active: false } }),
      ],
      { saved_at: '2026-11-07T14:38:00.000Z', department: null },
    );
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByText(/^1 loại món · 2 đơn vị · 1 món đã chấp nhận/)).toBeInTheDocument();
    expect(screen.getByText('Đã nhận đủ')).toBeInTheDocument();
  });

  it('bảng Món · ĐVT · Đăng ký · Được giao (vì có món bị bỏ: 1 → 0) · Đã nhận · Còn chờ · Nhận lần cuối (không "Tình trạng", "Ghi chú"); ô nhận lần cuối chỉ giờ ngày; lý do bỏ món dưới tên', async () => {
    past([L('1', 'Bút bảng', { delivered_qty: 1, last_delivered_at: '2026-11-08T02:10:00.000Z' }), L('3', 'Bút dạ')], {
      removed_lines: [{ name: 'Bút ghi đĩa', name_en: null, unit: 'cay', before: 1, reason_code: 'adm_out_of_stock', reason_note: null, at: '2026-11-08T01:30:00.000Z' }],
    });
    renderApp(makeMe('member'), '/history/2026-10');
    await screen.findByRole('columnheader', { name: 'Món' });
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Món', 'ĐVT', 'Đăng ký', 'Được giao', 'Đã nhận', 'Còn chờ', 'Nhận lần cuối']);
    expect(within(rowOf('Bút bảng')).getByText('09:10 08/11')).toBeInTheDocument();
    expect(within(rowOf('Bút bảng')).queryByText(/Nhận 09:10/)).toBeNull();
    expect(within(rowOf('Bút dạ')).getAllByRole('cell').map((c) => c.textContent)).toEqual(['cây', '1', '1', '0', '1', '—Chưa có']);
    expect(within(rowOf('Bút ghi đĩa')).getByText('Không giao')).toBeInTheDocument();
    expect(within(rowOf('Bút ghi đĩa')).getByText('Adm D&E bỏ món · Hết hàng')).toBeInTheDocument();
  });

  it('biên "Được giao": bằng số đăng ký ở mọi dòng → không có cột; một dòng lệch 1 (3 → 2) → có cột', async () => {
    past([L('1', 'Bút bảng', { qty: 3 }), L('2', 'Bút bi', { qty: 2 })]);
    const first = renderApp(makeMe('member'), '/history/2026-10');
    await screen.findByRole('columnheader', { name: 'Món' });
    expect(screen.queryByRole('columnheader', { name: 'Được giao' })).toBeNull();
    first.unmount();
    vi.unstubAllGlobals();
    past([L('1', 'Bút bảng', { qty: 2, adjustments: [{ before: 3, after: 2, reason_code: 'over_quota', reason_note: null, at: '2026-11-08T02:00:00.000Z' }] }), L('2', 'Bút bi', { qty: 2 })]);
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByRole('columnheader', { name: 'Được giao' })).toBeInTheDocument();
    expect(within(rowOf('Bút bảng')).getAllByRole('cell').map((c) => c.textContent).slice(0, 3)).toEqual(['cây', '3', '2']);
  });

  it('390: mỗi món một dòng "{tên} · {sl} {đvt} — đã nhận a, còn chờ b", không bảng 6 cặp nhãn', async () => {
    mockViewport(390);
    past([L('1', 'Băng keo 5cm', { qty: 4, delivered_qty: 2 }), L('2', 'Hồ khô', { qty: 3, delivered_qty: 3 })]);
    renderApp(makeMe('member'), '/history/2026-10');
    const list = await screen.findByRole('list', { name: 'Phiếu tháng 10/2026' });
    expect(within(list).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Băng keo 5cm · 4 cây — đã nhận 2, còn chờ 2',
      'Hồ khô · 3 cây — đã nhận 3, còn chờ 0',
    ]);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('bảng chi tiết có colgroup khớp số cột, chỉ cột Món không đặt bề rộng: đổi tháng thì cột không co giãn theo chữ', async () => {
    past([L('1', 'Bút bảng')]);
    renderApp(makeMe('member'), '/history/2026-10');
    const table = (await screen.findByRole('columnheader', { name: 'Món' })).closest('table')!;
    const cols = [...table.querySelectorAll(':scope > colgroup > col')];
    expect(cols).toHaveLength(table.querySelectorAll('thead th').length);
    expect(cols.filter((c) => !c.className)).toHaveLength(1);
    expect(cols[0]!.className).toBe('');
  });

  it('tháng chưa nhận lần nào vẫn giữ cột "Nhận lần cuối" ("—"), colgroup cố định: đổi tháng không dời cột', async () => {
    past([L('1', 'Bút bảng'), L('3', 'Bút dạ')]);
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByRole('columnheader', { name: 'Nhận lần cuối' })).toBeInTheDocument();
    const table = screen.getByRole('columnheader', { name: 'Món' }).closest('table')!;
    expect([...table.querySelectorAll(':scope > colgroup > col')].map((c) => c.className)).toEqual(['', 'hs-c-unit', 'hs-c-reg', 'hs-c-recv', 'hs-c-wait', 'hs-c-last']);
    expect(within(rowOf('Bút bảng')).getAllByRole('cell').at(-1)).toHaveTextContent('—');
  });

  it('khối "Điều chỉnh của Adm D&E": "08/11 · 08:30 · Bút ghi đĩa 1 thành 0 · Lý do: Hết hàng"; lý do over_quota hiện "Số lượng quá nhiều" (G2)', async () => {
    past(
      [L('1', 'Bút bi', { qty: 2, adjustments: [{ before: 3, after: 2, reason_code: 'over_quota', reason_note: null, at: '2026-11-08T02:00:00.000Z' }] })],
      { removed_lines: [{ name: 'Bút ghi đĩa', name_en: null, unit: 'cay', before: 1, reason_code: 'adm_out_of_stock', reason_note: null, at: '2026-11-08T01:30:00.000Z' }] },
    );
    renderApp(makeMe('member'), '/history/2026-10');
    const box = (await screen.findByRole('heading', { name: 'Điều chỉnh của Adm D&E' })).closest('section')!;
    expect(within(box).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      '08/11 · 08:30 · Bút ghi đĩa 1 thành 0 · Lý do: Hết hàng',
      '08/11 · 09:00 · Bút bi 3 thành 2 · Lý do: Số lượng quá nhiều',
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

  it.each([1280, 390])('%i: kỳ không có phiếu, chưa có lịch sử → đúng một trạng thái rỗng, h1 "Phiếu tháng 9/2026", có lối về Đăng ký', async (width) => {
    mockViewport(width);
    stubRequestApi();
    renderApp(makeMe('member'), '/history/2026-09');
    expect(await screen.findByText('Không có phiếu tháng này')).toBeInTheDocument();
    expect(document.querySelectorAll('.empty, .empty-state')).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Phiếu tháng 9/2026' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Về trang Đăng ký' })).toHaveAttribute('href', '/');
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

  it('dòng 5 giao 3 hủy 2: Được giao 3, Đã nhận 3, Còn chờ 0 và "đã hủy 2 — lý do" dưới tên', async () => {
    past([lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 5, delivered_qty: 3, cancelled_qty: 2, cancel_note: 'Người đã nghỉ' })]);
    renderApp(makeMe('member'), '/history/2026-10');
    const row = (await screen.findByRole('rowheader', { name: new RegExp(`^${PEN.name}`) })).closest('tr')!;
    expect(within(row).getAllByRole('cell').map((c) => c.textContent).slice(1, 5)).toEqual(['5', '3', '3', '0']);
    expect(within(row).getByText('đã hủy 2 — Người đã nghỉ')).toBeInTheDocument();
  });

  it('hủy hết 5: "Không giao" + "Đã hủy 5 — lý do"', async () => {
    past([lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 5, cancelled_qty: 5, cancel_note: 'Hết hàng' })]);
    renderApp(makeMe('member'), '/history/2026-10');
    const row = (await screen.findByRole('rowheader', { name: new RegExp(`^${PEN.name}`) })).closest('tr')!;
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
    expect(screen.queryByText(/hủy \d —/)).toBeNull();
  });
});
