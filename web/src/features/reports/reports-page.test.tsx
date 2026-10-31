import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { PEN_KEY, TAPE_KEY, reportFixture } from './reports-fixtures';
import { captureDownloads, errorResponse, exportsOf, postsOf, stubReports } from './reports-test-stub';

function openPage(path = '/admin/reports') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}

const orderCell = (name: string) => screen.findByRole('textbox', { name: `Đặt mua ${name}` });
const exportBtn = () => screen.getByRole('button', { name: 'Xuất Excel' });
const printBtn = () => screen.getByRole('button', { name: 'In trình ký' });

async function typeInto(cell: HTMLElement, text: string) {
  await userEvent.clear(cell);
  await userEvent.type(cell, text);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ReportsPage — ô Đặt mua', () => {
  it('đúng một h1 "Báo cáo & in"; mặc định kỳ khóa gần nhất (10/2026); Đặt mua = Cần mua; hai nút chốt bật', async () => {
    const f = stubReports();
    openPage();
    expect(await orderCell('Bút bi xanh')).toHaveValue('10');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Báo cáo & in');
    expect(await orderCell('Băng keo 2 mặt')).toHaveValue('5');
    expect(screen.getByText('Tháng 10/2026')).toBeInTheDocument();
    expect(f.mock.calls.some((c) => c[0] === '/api/admin/reports/2026-10')).toBe(true);
    expect(exportBtn()).toBeEnabled();
    expect(printBtn()).toBeEnabled();
    expect(screen.queryByRole('button', { name: /^Về Cần mua/ })).toBeNull();
  });

  it.each(['-1', '100000', '1.5', 'a'])('gõ "%s" → lỗi "Từ 0 đến 99 999." gắn đúng ô, ô khác không lỗi', async (text) => {
    stubReports();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await typeInto(pen, text);
    expect(pen).toHaveAttribute('aria-invalid', 'true');
    expect(pen).toHaveAccessibleDescription('Từ 0 đến 99 999.');
    expect(await orderCell('Băng keo 2 mặt')).not.toHaveAttribute('aria-invalid');
  });

  it.each([
    ['0', 0],
    ['99999', 99999],
  ])('biên hợp lệ "%s" → không lỗi, POST gửi %d', async (text, n) => {
    const f = stubReports();
    captureDownloads();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await typeInto(pen, text);
    expect(pen).not.toHaveAttribute('aria-invalid');
    await userEvent.click(exportBtn());
    await waitFor(() => expect(postsOf(f)).toHaveLength(1));
    expect(postsOf(f)[0].body.order_qty).toEqual({ [PEN_KEY]: n });
  });

  it('bấm chốt khi có 2 ô lỗi → "Sửa 2 ô Đặt mua đang lỗi trước khi chốt.", không POST; sửa hết thì cảnh báo mất', async () => {
    const f = stubReports();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await typeInto(pen, '100000');
    await typeInto(await orderCell('Băng keo 2 mặt'), '-1');
    await userEvent.click(exportBtn());
    expect(await screen.findByText('Sửa 2 ô Đặt mua đang lỗi trước khi chốt.')).toBeInTheDocument();
    await userEvent.click(printBtn());
    expect(postsOf(f)).toEqual([]);
    await userEvent.click(screen.getByRole('button', { name: 'Về Cần mua tất cả (2)' }));
    expect(screen.queryByText(/ô Đặt mua đang lỗi/)).toBeNull();
    expect(pen).toHaveValue('10');
  });

  it('sửa 7 → nút "Về Cần mua (10)"; bấm → ô về 10', async () => {
    stubReports();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await typeInto(pen, '7');
    await userEvent.click(screen.getByRole('button', { name: 'Về Cần mua (10) Bút bi xanh' }));
    expect(pen).toHaveValue('10');
    expect(screen.queryByRole('button', { name: /^Về Cần mua tất cả/ })).toBeNull();
  });

  it('chỉ gửi order_qty của ô khác Cần mua; Xuất Excel tải tệp của bản mới + toast "Đã xuất Excel tháng 10/2026 · bản chốt 10:00"', async () => {
    const f = stubReports();
    const downloads = captureDownloads();
    openPage();
    await typeInto(await orderCell('Bút bi xanh'), '7');
    await typeInto(await orderCell('Hồ dán'), '0');
    await typeInto(await orderCell('Băng keo 2 mặt'), '5');
    await userEvent.click(exportBtn());
    await waitFor(() => expect(downloads.map((d) => d.name)).toEqual(['vpp-bao-cao-2026-10.xlsx']));
    expect(postsOf(f)).toEqual([{ url: '/api/admin/reports/2026-10/snapshots', body: { kind: 'xlsx', order_qty: { [PEN_KEY]: 7 } } }]);
    expect(exportsOf(f)).toEqual(['/api/admin/reports/snapshots/snap-1/export.xlsx?lang=vi']);
    expect(await screen.findByText('Đã xuất Excel tháng 10/2026 · bản chốt 10:00')).toBeInTheDocument();
  });

  it('VALIDATION fields order_qty.<khóa> → lỗi tại đúng ô đó, ô khác không, không tải tệp', async () => {
    stubReports({ post: () => jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: [`order_qty.${TAPE_KEY}`] }) });
    const downloads = captureDownloads();
    openPage();
    const tape = await orderCell('Băng keo 2 mặt');
    await typeInto(tape, '8');
    await userEvent.click(exportBtn());
    await waitFor(() => expect(tape).toHaveAttribute('aria-invalid', 'true'));
    expect(tape).toHaveAccessibleDescription('Từ 0 đến 99 999.');
    expect(await orderCell('Bút bi xanh')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByText('Sửa 1 ô Đặt mua đang lỗi trước khi chốt.')).toBeInTheDocument();
    expect(downloads).toEqual([]);
  });

  it('dòng biến mất giữa lúc tải và chốt → "Báo cáo đã đổi…", ô biến mất; chốt lại không gửi khóa cũ', async () => {
    const f = stubReports({
      reportLoads: [reportFixture(), reportFixture({ custom: [] })],
      post: (body) =>
        TAPE_KEY in body.order_qty ? jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: [`order_qty.${TAPE_KEY}`] }) : jsonResponse(201, { id: 'snap-9', created_at: '2026-10-29T03:00:00Z' }),
    });
    captureDownloads();
    openPage();
    await typeInto(await orderCell('Băng keo 2 mặt'), '8');
    await userEvent.click(exportBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Báo cáo đã đổi, đã tải lại — xem lại số Đặt mua rồi chốt lại.');
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Đặt mua Băng keo 2 mặt' })).toBeNull());
    await userEvent.click(exportBtn());
    await waitFor(() => expect(postsOf(f)).toHaveLength(2));
    expect(postsOf(f)[1].body.order_qty).toEqual({});
  });
});

describe('ReportsPage — chốt', () => {
  it('pending_custom_count 1 → hộp thoại; "Xem món chờ" không POST, sang Món ngoài danh mục của tháng; quay lại "Vẫn chốt" POST đúng 1 lần', async () => {
    const f = stubReports({ reports: { '2026-10': reportFixture({ pending_custom_count: 1 }) } });
    captureDownloads();
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(exportBtn());
    const dialog = await screen.findByRole('dialog', { name: 'Còn 1 món ngoài danh mục chưa xem' });
    expect(within(dialog).getByText('Các món này chưa được tính vào báo cáo. Chốt bây giờ thì bản chốt không có chúng.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Xem món chờ' }));
    expect(postsOf(f)).toEqual([]);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/review'));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-10');
  });

  it('pending_custom_count 1 → "Vẫn chốt" POST 1 lần; cảnh báo warn "Còn 1 món … chưa được tính vào báo cáo này."', async () => {
    const f = stubReports({ reports: { '2026-10': reportFixture({ pending_custom_count: 1 }) } });
    captureDownloads();
    openPage();
    await orderCell('Bút bi xanh');
    expect(screen.getByText('Còn 1 món ngoài danh mục chưa xem — chưa được tính vào báo cáo này.')).toBeInTheDocument();
    await userEvent.click(printBtn());
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Vẫn chốt' }));
    await waitFor(() => expect(postsOf(f)).toHaveLength(1));
    expect(postsOf(f)[0].body).toEqual({ kind: 'print', order_qty: {} });
  });

  it('pending_custom_count 0 → không hỏi', async () => {
    const f = stubReports();
    captureDownloads();
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(exportBtn());
    await waitFor(() => expect(postsOf(f)).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('bấm đúp Xuất Excel khi POST chưa xong → chỉ một bản chốt, nút hiện "Đang chốt…"', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const f = stubReports({ post: async () => (await gate, jsonResponse(201, { id: 'snap-9', created_at: '2026-10-29T03:00:00Z' })) });
    const downloads = captureDownloads();
    openPage();
    await orderCell('Bút bi xanh');
    const user = userEvent.setup();
    await user.dblClick(exportBtn());
    expect(screen.getByRole('button', { name: 'Đang chốt…' })).toBeDisabled();
    release();
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(postsOf(f)).toHaveLength(1);
  });

  it('In trình ký → POST kind print, ở lại trang, toast "Đã tạo bản in tháng 10/2026 · bản chốt 10:00"; "Mở bản in" mở trang in ở tab mới', async () => {
    const f = stubReports();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(printBtn());
    expect(await screen.findByText('Đã tạo bản in tháng 10/2026 · bản chốt 10:00')).toBeInTheDocument();
    expect(postsOf(f)[0].body).toEqual({ kind: 'print', order_qty: {} });
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/admin\/reports$/);
    await userEvent.click(screen.getByRole('button', { name: 'Mở bản in' }));
    expect(open).toHaveBeenCalledWith('/admin/reports/snapshots/snap-1/print', '_blank', 'noopener');
  });

  it('POST 500 → khối "Chưa chốt được, thử lại sau." ở đầu trang, không toast', async () => {
    stubReports({ post: () => errorResponse(500, 'INTERNAL') });
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(exportBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa chốt được, thử lại sau.');
    expect(screen.queryByText(/^Đã xuất Excel/)).toBeNull();
  });

  it('kỳ đang mở → cảnh báo info "tạm tính", hai nút chốt vẫn bật và POST được (Q2)', async () => {
    const f = stubReports();
    captureDownloads();
    openPage('/admin/reports?ym=2026-11');
    await orderCell('Bút bi xanh');
    expect(screen.getByText('Kỳ tháng 11 đang mở — số liệu tạm tính theo phiếu đã lưu.')).toBeInTheDocument();
    expect(exportBtn()).toBeEnabled();
    expect(printBtn()).toBeEnabled();
    await userEvent.click(exportBtn());
    await waitFor(() => expect(postsOf(f).map((p) => p.url)).toEqual(['/api/admin/reports/2026-11/snapshots']));
  });

  it('kỳ đã khóa → không có cảnh báo tạm tính', async () => {
    stubReports();
    openPage();
    await orderCell('Bút bi xanh');
    expect(screen.queryByText(/số liệu tạm tính/)).toBeNull();
  });
});
