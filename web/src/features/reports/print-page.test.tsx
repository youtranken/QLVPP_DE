import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { jsonResponse } from '@/test/test-utils';
import i18n from '@/lib/i18n';
import { handleSessionExpired } from '@/lib/session-relogin';
import { PEN_KEY, SNAPSHOT_ID, TAPE_KEY, snapshotDataFixture } from './reports-fixtures';
import { errorResponse } from './reports-test-stub';
import { openPrint } from './print-test-stub';

vi.mock('@/lib/session-relogin', () => ({ handleSessionExpired: vi.fn() }));

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.mocked(handleSessionExpired).mockClear();
  await i18n.changeLanguage('vi');
});

const formTable = async () => within(await screen.findByRole('region', { name: 'Phiếu đề xuất văn phòng phẩm' })).getByRole('table');
const bodyRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));

describe('Trang in · trang 1 Phiếu đề xuất (mẫu D&E)', () => {
  it('đầu tờ: "Phiếu đề xuất văn phòng phẩm", "STATIONERY REQUEST FORM", "Date : dd/MM/yyyy" theo giờ VN; không tiêu đề công ty, không công thức', async () => {
    openPrint(snapshotDataFixture({ created_at: '2026-10-27T17:00:00Z' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Phiếu đề xuất văn phòng phẩm' })).toBeInTheDocument();
    expect(screen.getByText('STATIONERY REQUEST FORM')).toBeInTheDocument();
    expect(screen.getByText('Date : 28/10/2026')).toBeInTheDocument();
    expect(screen.queryByText('Công ty Phú Mỹ Hưng')).not.toBeInTheDocument();
    expect(screen.queryByText(/Cần mua = /)).not.toBeInTheDocument();
  });

  it('bảng đúng 6 cột song ngữ STT No. · Mã Code · Tên vật dụng · Item name · ĐVT Unit · SL Qty', async () => {
    openPrint(snapshotDataFixture());
    const table = await formTable();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['STT No.', 'Mã Code', 'Tên vật dụng', 'Item name', 'ĐVT Unit', 'SL Qty']);
  });

  it('chỉ món order_qty > 0 (0 không in, 1 in), theo thứ tự bản chốt, ngoài DM cuối với Mã "—"; ĐVT tên vi đã chụp', async () => {
    openPrint(snapshotDataFixture({ order_qty: { [PEN_KEY]: 1, 'item-glue': 0, [TAPE_KEY]: 5 } }));
    expect(bodyRows(await formTable())).toEqual([
      ['1', 'B31', 'Bút bi xanh', 'Blue pen', 'cây', '1'],
      ['2', '—', 'Băng keo 2 mặt', '', 'cuộn', '5'],
    ]);
  });

  it('giao diện tiếng Anh: trang 1 vẫn song ngữ như mẫu, ĐVT vẫn tên vi', async () => {
    await i18n.changeLanguage('en');
    openPrint(snapshotDataFixture());
    const table = await formTable();
    expect(within(table).getAllByRole('columnheader')[0]).toHaveTextContent('STT No.');
    expect(bodyRows(table)[0]).toEqual(['1', 'B31', 'Bút bi xanh', 'Blue pen', 'cây', '14']);
  });

  it('bản chốt cũ: thiếu code → "—", thiếu tên ĐVT → lấy tên vi hiện tại của bảng ĐVT; thiếu khóa order_qty → Cần mua', async () => {
    const base = snapshotDataFixture();
    const old = base.byItem.map(({ code: _c, unit_name: _u, unit_name_en: _e, ...r }) => r);
    openPrint(snapshotDataFixture({ byItem: old, custom: [], order_qty: {} }));
    expect(bodyRows(await formTable())).toEqual([['1', '—', 'Bút bi xanh', 'Blue pen', 'cây', '10']]);
  });

  it('không món nào order_qty > 0 → một hàng "Không có món cần đặt mua."', async () => {
    openPrint(snapshotDataFixture({ order_qty: { [PEN_KEY]: 0, 'item-glue': 0, [TAPE_KEY]: 0 } }));
    expect(bodyRows(await formTable())).toEqual([['Không có món cần đặt mua.']]);
  });

  it('ô ký theo signature_boxes: chức danh, chức danh en, tên; tên trống → dòng chấm không chữ', async () => {
    openPrint(snapshotDataFixture({ signature_boxes: [{ title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: 'Ngô Văn Bảo' }, { title: 'Người yêu cầu', title_en: 'Applicant', name: '' }] }));
    const boxes = within(await screen.findByRole('group', { name: 'Chữ ký' })).getAllByRole('group');
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['Chủ quản đơn vị', 'Người yêu cầu']);
    expect(boxes[0].textContent).toBe('Chủ quản đơn vịHead of Dept.Ngô Văn Bảo');
    expect(boxes[1].textContent).toBe('Người yêu cầuApplicant');
    expect(within(boxes[1]).getByTestId('sign-dots')).toBeInTheDocument();
  });

  it.each([1, 3])('%i ô ký trong bản chốt → đúng %i ô', async (n) => {
    const boxes = ['A', 'B', 'C'].slice(0, n).map((x) => ({ title: `Ô ${x}`, title_en: '', name: x }));
    openPrint(snapshotDataFixture({ signature_boxes: boxes }));
    expect(within(await screen.findByRole('group', { name: 'Chữ ký' })).getAllByRole('group')).toHaveLength(n);
  });

  it('bản chốt cũ chỉ có signers → 3 ô "Người lập / Trưởng phòng / Duyệt", tên từ bản chốt, không in "undefined"', async () => {
    openPrint(snapshotDataFixture({ signature_boxes: undefined, signers: { preparer: 'Lê Thị Hoa', head: '', approver: 'Đỗ Minh Châu' } }));
    const boxes = within(await screen.findByRole('group', { name: 'Chữ ký' })).getAllByRole('group');
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['Người lập', 'Trưởng phòng', 'Duyệt']);
    expect(boxes.map((b) => b.textContent)).toEqual(['Người lậpLê Thị Hoa', 'Trưởng phòng', 'DuyệtĐỗ Minh Châu']);
    expect(document.body.textContent).not.toContain('undefined');
  });
});

describe('Trang in · thanh công cụ và công tắc phụ lục', () => {
  it('thanh công cụ có aria-label "Thanh công cụ bản in (không in ra giấy)": Quay lại về đúng tháng, mô tả bản chốt, In gọi window.print', async () => {
    openPrint(snapshotDataFixture());
    const bar = await screen.findByRole('toolbar', { name: 'Thanh công cụ bản in (không in ra giấy)' });
    expect(within(bar).getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/admin/reports?ym=2026-10');
    expect(within(bar).getByText('Bản in tháng 10/2026 · bản chốt 09:30 28/10 · A4 dọc')).toBeInTheDocument();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    await userEvent.click(within(bar).getByRole('button', { name: 'In' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('không có ?appendix → công tắc "In kèm phụ lục" tắt, không có phụ lục; bật → URL có appendix=1 và hiện phụ lục', async () => {
    openPrint(snapshotDataFixture());
    const toggle = await screen.findByRole('checkbox', { name: 'In kèm phụ lục' });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByRole('region', { name: 'Phụ lục · Chi tiết tháng 10/2026' })).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(await screen.findByRole('region', { name: 'Phụ lục · Chi tiết tháng 10/2026' })).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('?appendix=1');
  });

  it('?appendix=1 → công tắc bật, có phụ lục; tắt → bỏ khỏi URL và mất phụ lục', async () => {
    openPrint(snapshotDataFixture(), { query: '?appendix=1' });
    expect(await screen.findByRole('region', { name: 'Phụ lục · Chi tiết tháng 10/2026' })).toBeInTheDocument();
    const toggle = screen.getByRole('checkbox', { name: 'In kèm phụ lục' });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    expect(screen.queryByRole('region', { name: 'Phụ lục · Chi tiết tháng 10/2026' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent(/^$/);
  });
});

describe('Trang in · lỗi', () => {
  it('SNAPSHOT_NOT_FOUND → trang không tìm thấy', async () => {
    openPrint(errorResponse(404, 'SNAPSHOT_NOT_FOUND'));
    expect(await screen.findByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument();
  });

  it('id không phải uuid → không tìm thấy và không gọi api', async () => {
    const f = openPrint(snapshotDataFixture(), { id: 'abc' });
    expect(await screen.findByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument();
    expect(f.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('snapshots/'))).toEqual([]);
  });

  it('lỗi khác → thử lại, không giả không tìm thấy', async () => {
    openPrint(errorResponse(500, 'INTERNAL'));
    expect(await screen.findByRole('button', { name: /Thử lại/ })).toBeInTheDocument();
  });

  it('hết phiên (401) → đăng nhập lại tập trung', async () => {
    openPrint(errorResponse(401, 'UNAUTHENTICATED'));
    await vi.waitFor(() => expect(handleSessionExpired).toHaveBeenCalled());
  });

  it('thành viên thường bị chuyển về trang chủ, không gọi api bản chốt', async () => {
    const f = vi.fn(async (_url: string) => jsonResponse(200, { items: [], next_cursor: null, unread_count: 0 }));
    vi.stubGlobal('fetch', f);
    mockViewport(1280);
    renderApp(makeMe('member'), `/admin/reports/snapshots/${SNAPSHOT_ID}/print`);
    expect(await screen.findByTestId('location')).toHaveTextContent('/');
    expect(f.mock.calls.map((c) => String(c[0])).filter((u) => u.includes('snapshots/'))).toEqual([]);
  });
});
