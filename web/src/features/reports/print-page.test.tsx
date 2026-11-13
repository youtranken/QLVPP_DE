import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { jsonResponse } from '@/test/test-utils';
import i18n from '@/lib/i18n';
import { handleSessionExpired } from '@/lib/session-relogin';
import { PEN_KEY, SNAPSHOT_ID, TAPE_KEY, snapshotDataFixture } from './reports-fixtures';
import { errorResponse } from './reports-test-stub';
import { openPrint } from './print-test-stub';

vi.mock('@/lib/session-relogin', () => ({ handleSessionExpired: vi.fn(), isLoggingOut: () => false }));

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.mocked(handleSessionExpired).mockClear();
  await i18n.changeLanguage('vi');
});

// Thanh công cụ có cả lúc đang tải (Quay lại chung, In khóa): chờ bản chốt về — link Quay lại đã theo tháng
const loadedBar = async () => {
  const bar = () => screen.getByRole('toolbar', { name: 'Thanh công cụ bản in (không in ra giấy)' });
  await waitFor(() => expect(within(bar()).getByRole('link', { name: 'Quay lại' }).getAttribute('href')).toMatch(/\?ym=/));
  return bar();
};
const formTable = async () => within(await screen.findByRole('region', { name: 'Phiếu đề xuất văn phòng phẩm' })).getByRole('table');
const bodyRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));

describe('Trang in · trang 1 Phiếu đề xuất (mẫu D&E)', () => {
  it('đầu tờ: "Phiếu đề xuất văn phòng phẩm", "STATIONERY REQUEST FORM", "Date : MM/YYYY" của kỳ (không phải ngày lập); không tiêu đề công ty, không công thức', async () => {
    openPrint(snapshotDataFixture({ created_at: '2026-11-02T17:00:00Z' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Phiếu đề xuất văn phòng phẩm' })).toBeInTheDocument();
    expect(screen.getByText('STATIONERY REQUEST FORM')).toBeInTheDocument();
    expect(screen.getByText('Date : 10/2026')).toBeInTheDocument();
    expect(screen.queryByText(/Date : \d\d\/\d\d\/\d{4}/)).toBeNull();
    expect(screen.queryByText('Công ty Phú Mỹ Hưng')).not.toBeInTheDocument();
    expect(screen.queryByText(/Đề nghị mặc định = /)).not.toBeInTheDocument();
  });

  it('bảng đúng 6 cột song ngữ STT No. · Mã Code · Tên vật dụng · Item name · ĐVT Unit · SL Qty', async () => {
    openPrint(snapshotDataFixture());
    const table = await formTable();
    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['STT No.', 'Mã Code', 'Tên vật dụng', 'Item name', 'ĐVT Unit', 'SL Qty']);
  });

  it('bản có order_basis: mọi hàng của bản theo thứ tự (Đề nghị 0 vẫn in số 0, 1 in 1), ngoài DM cuối với Mã "—"; ĐVT tên vi đã chụp', async () => {
    openPrint(snapshotDataFixture({ order_qty: { [PEN_KEY]: 1, 'item-glue': 0, [TAPE_KEY]: 5 }, order_basis: {} }));
    expect(bodyRows(await formTable())).toEqual([
      ['1', 'B31', 'Bút bi xanh', 'Blue pen', 'cây', '1'],
      ['2', '—', 'Hồ dán', '', 'lọ', '0'],
      ['3', '—', 'Băng keo 2 mặt', '', 'cuộn', '5'],
    ]);
  });

  it('bản cũ không có order_basis: in lại không thêm hàng Đề nghị 0 (giữ như tờ đã gửi NCC)', async () => {
    openPrint(snapshotDataFixture({ order_qty: { [PEN_KEY]: 1, 'item-glue': 0, [TAPE_KEY]: 5 } }));
    expect(bodyRows(await formTable())).toEqual([
      ['1', 'B31', 'Bút bi xanh', 'Blue pen', 'cây', '1'],
      ['2', '—', 'Băng keo 2 mặt', '', 'cuộn', '5'],
    ]);
  });

  it('bản có replaces → dòng đầu đậm "Thay thế bản in lúc 09:02 12/12" trên tiêu đề; bản không replaces → không có dòng này', async () => {
    openPrint(snapshotDataFixture({ replaces: { id: 'old', created_at: '2026-12-12T02:02:00Z' } }));
    const form = await screen.findByRole('region', { name: 'Phiếu đề xuất văn phòng phẩm' });
    const line = within(form).getByText('Thay thế bản in lúc 09:02 12/12');
    expect(line.tagName).toBe('STRONG');
    expect(line.compareDocumentPosition(within(form).getByRole('heading', { level: 1 })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('bản không có replaces → không có dòng "Thay thế bản in"', async () => {
    openPrint(snapshotDataFixture());
    await formTable();
    expect(screen.queryByText(/^Thay thế bản in lúc/)).toBeNull();
  });

  it('bản rỗng (mọi Đề nghị 0) → "Bản này không có món nào — không cần trình ký.", nút In vô hiệu, không có tờ phiếu', async () => {
    openPrint(snapshotDataFixture({ order_qty: { [PEN_KEY]: 0, 'item-glue': 0, [TAPE_KEY]: 0 } }));
    expect(await screen.findByText('Bản này không có món nào — không cần trình ký.')).toBeInTheDocument();
    const bar = screen.getByRole('toolbar', { name: 'Thanh công cụ bản in (không in ra giấy)' });
    expect(within(bar).getByRole('button', { name: 'In' })).toBeDisabled();
    expect(screen.queryByRole('region', { name: 'Phiếu đề xuất văn phòng phẩm' })).toBeNull();
  });

  it('bản có hàng (một ô 1, còn lại 0) → nút In bật (hai phía mốc)', async () => {
    openPrint(snapshotDataFixture({ order_qty: { [PEN_KEY]: 1, 'item-glue': 0, [TAPE_KEY]: 0 } }));
    const bar = await loadedBar();
    expect(within(bar).getByRole('button', { name: 'In' })).toBeEnabled();
    expect(screen.queryByText('Bản này không có món nào — không cần trình ký.')).toBeNull();
  });

  it('giao diện tiếng Anh: trang 1 vẫn song ngữ như mẫu, ĐVT vẫn tên vi', async () => {
    await i18n.changeLanguage('en');
    openPrint(snapshotDataFixture());
    const table = await formTable();
    expect(within(table).getAllByRole('columnheader')[0]).toHaveTextContent('STT No.');
    expect(bodyRows(table)[0]).toEqual(['1', 'B31', 'Bút bi xanh', 'Blue pen', 'cây', '14']);
  });

  it('bản chốt cũ: thiếu code → "—", thiếu tên ĐVT → lấy tên vi hiện tại của bảng ĐVT', async () => {
    const base = snapshotDataFixture();
    const old = base.byItem.map(({ code: _c, unit_name: _u, unit_name_en: _e, ...r }) => r);
    openPrint(snapshotDataFixture({ byItem: [old[0]], custom: [], order_qty: { [PEN_KEY]: 2, 'item-x': 1 } }));
    expect(bodyRows(await formTable())).toEqual([['1', '—', 'Bút bi xanh', 'Blue pen', 'cây', '2']]);
  });

  it('bản chốt cũ không có khóa order_qty của hàng → in số gộp 15', async () => {
    openPrint(snapshotDataFixture({ custom: [], order_qty: { 'item-glue': 1 } }));
    expect(bodyRows(await formTable())[0]).toEqual(['1', 'B31', 'Bút bi xanh', 'Blue pen', 'cây', '15']);
  });

  it('bản chốt không có hàng nào → một hàng "Không có món cần đặt mua."', async () => {
    openPrint(snapshotDataFixture({ byItem: [], custom: [], order_qty: { 'item-gone': 2 } }));
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

  it.each([
    [1, 1],
    [2, 2],
    [3, 2],
  ])('%i ô ký trong bản chốt → in %i ô (tối đa 2 ô đầu)', async (n, shown) => {
    const boxes = ['A', 'B', 'C'].slice(0, n).map((x) => ({ title: `Ô ${x}`, title_en: '', name: x }));
    openPrint(snapshotDataFixture({ signature_boxes: boxes }));
    const printed = within(await screen.findByRole('group', { name: 'Chữ ký' })).getAllByRole('group');
    expect(printed.map((b) => b.getAttribute('aria-label'))).toEqual(['Ô A', 'Ô B', 'Ô C'].slice(0, shown));
  });

  it('cấu hình 3 ô có "Duyệt" → chỉ in "Chủ quản đơn vị" và "Người yêu cầu"', async () => {
    const boxes = [
      { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: '' },
      { title: 'Người yêu cầu', title_en: 'Applicant', name: '' },
      { title: 'Duyệt', title_en: 'Approved by', name: '' },
    ];
    openPrint(snapshotDataFixture({ signature_boxes: boxes }));
    const sign = await screen.findByRole('group', { name: 'Chữ ký' });
    expect(within(sign).getAllByRole('group').map((b) => b.getAttribute('aria-label'))).toEqual(['Chủ quản đơn vị', 'Người yêu cầu']);
    expect(sign).not.toHaveTextContent('Duyệt');
  });

  it.each(['vi', 'en'])('bản chốt cũ chỉ có signers, giao diện %s → 2 ô song ngữ theo mẫu (Chủ quản đơn vị ← head, Người yêu cầu ← preparer), bỏ Duyệt, không in "undefined"', async (lang) => {
    await i18n.changeLanguage(lang);
    openPrint(snapshotDataFixture({ signature_boxes: undefined, signers: { preparer: 'Lê Thị Hoa', head: '', approver: 'Đỗ Minh Châu' } }));
    const sign = await screen.findByRole('group', { name: lang === 'en' ? 'Signatures' : 'Chữ ký' });
    const boxes = within(sign).getAllByRole('group');
    expect(boxes.map((b) => b.getAttribute('aria-label'))).toEqual(['Chủ quản đơn vị', 'Người yêu cầu']);
    expect(boxes.map((b) => b.textContent)).toEqual(['Chủ quản đơn vịHead of Dept.', 'Người yêu cầuApplicantLê Thị Hoa']);
    expect(document.body.textContent).not.toContain('undefined');
    expect(document.body.textContent).not.toContain('Đỗ Minh Châu');
  });
});

describe('Trang in · thanh công cụ và công tắc phụ lục', () => {
  it('thanh công cụ có aria-label "Thanh công cụ bản in (không in ra giấy)": Quay lại về đúng tháng, mô tả bản chốt, In gọi window.print', async () => {
    openPrint(snapshotDataFixture());
    const bar = await loadedBar();
    expect(within(bar).getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', '/admin/reports?ym=2026-10');
    expect(within(bar).getByText('Bản in tháng 10/2026 · bản chốt 09:30 28/10 · A4 dọc')).toBeInTheDocument();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    await userEvent.click(within(bar).getByRole('button', { name: 'In' }));
    expect(print).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['?from=send-adm', '/admin/reports?ym=2026-10'],
    ['?from=reports', '/admin/reports?ym=2026-10'],
    ['', '/admin/reports?ym=2026-10'],
    ['?from=rac', '/admin/reports?ym=2026-10'],
  ])('Quay lại theo trang đã mở: "%s" → %s; trang in riêng không tự gọi print', async (query, href) => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    openPrint(snapshotDataFixture(), { query });
    // Thanh công cụ có cả lúc đang tải (Quay lại chung): chờ tờ in để đọc link theo tháng bản chốt
    await screen.findByRole('heading', { level: 1, name: 'Phiếu đề xuất văn phòng phẩm' });
    const bar = await loadedBar();
    expect(within(bar).getByRole('link', { name: 'Quay lại' })).toHaveAttribute('href', href);
    expect(print).not.toHaveBeenCalled();
  });

  it('trang in riêng chèn @page A4 dọc khi mở, gỡ khi rời trang', async () => {
    const view = openPrint(snapshotDataFixture());
    await loadedBar();
    expect(document.head.querySelector('style[data-print-page]')).toHaveTextContent('@page { size: A4 portrait; margin: 14mm 14mm 16mm; }');
    view.unmount();
    expect(document.head.querySelector('style[data-print-page]')).toBeNull();
  });

  it('không còn công tắc "In kèm phụ lục"; link cũ ?appendix=1 vẫn mở được, chỉ có Phiếu đề xuất', async () => {
    openPrint(snapshotDataFixture(), { query: '?appendix=1' });
    await screen.findByRole('heading', { level: 1, name: 'Phiếu đề xuất văn phòng phẩm' });
    expect(screen.queryByRole('checkbox', { name: 'In kèm phụ lục' })).toBeNull();
    expect(screen.queryByRole('region', { name: /Phụ lục/ })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Phiếu đề xuất văn phòng phẩm' })).toBeInTheDocument();
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
