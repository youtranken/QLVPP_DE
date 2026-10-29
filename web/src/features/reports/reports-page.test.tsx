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

const orderCell = (name: string) => screen.findByRole('spinbutton', { name: `Đặt mua ${name}` });
const exportBtn = () => screen.getByRole('button', { name: 'Xuất Excel' });
const printBtn = () => screen.getByRole('button', { name: 'In trình ký' });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ReportsPage — cột Đặt mua và chốt', () => {
  it('mặc định kỳ khóa gần nhất (tháng 10/2026, kỳ mở 11); đầu trang có "Xuất Excel" + "In trình ký"; Đặt mua = Cần mua', async () => {
    const f = stubReports();
    openPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Báo cáo & in' })).toBeInTheDocument();
    expect(await orderCell('Bút bi xanh')).toHaveValue(10);
    expect(await orderCell('Băng keo 2 mặt')).toHaveValue(5);
    expect(screen.getByText('Tháng 10/2026')).toBeInTheDocument();
    expect(f.mock.calls.some((c) => c[0] === '/api/admin/reports/2026-10')).toBe(true);
    expect(exportBtn()).toBeEnabled();
    expect(printBtn()).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Về Cần mua Bút bi xanh' })).toBeNull();
  });

  it('nhóm "Ngoài danh mục": Tồn "—", kèm số người', async () => {
    stubReports();
    openPage();
    const row = (await orderCell('Băng keo 2 mặt')).closest('tr')!;
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect(within(row).getByText('2 người')).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'Ngoài danh mục' })).toBeInTheDocument();
  });

  it('sửa 7 → ô nền vàng + "Về Cần mua"; Xuất Excel gửi body chỉ có khóa đó rồi tải export.xlsx?lang=vi của bản mới', async () => {
    const f = stubReports();
    const downloads = captureDownloads();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await userEvent.clear(pen);
    await userEvent.type(pen, '7');
    expect(pen.closest('td')).toHaveClass('is-edited');
    expect(screen.getByRole('button', { name: 'Về Cần mua Bút bi xanh' })).toBeInTheDocument();
    await userEvent.click(exportBtn());
    await waitFor(() => expect(downloads.map((d) => d.name)).toEqual(['vpp-bao-cao-2026-10.xlsx']));
    expect(await downloads[0].blob.text()).toBe('xlsx-bytes');
    expect(exportsOf(f)).toEqual(['/api/admin/reports/snapshots/snap-1/export.xlsx?lang=vi']);
    expect(postsOf(f)).toEqual([{ url: '/api/admin/reports/2026-10/snapshots', body: { kind: 'xlsx', order_qty: { [PEN_KEY]: 7 } } }]);
  });

  it('"Về Cần mua" → ô về 10, hết nền vàng', async () => {
    stubReports();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await userEvent.clear(pen);
    await userEvent.type(pen, '3');
    await userEvent.click(screen.getByRole('button', { name: 'Về Cần mua Bút bi xanh' }));
    expect(pen).toHaveValue(10);
    expect(pen.closest('td')).not.toHaveClass('is-edited');
  });

  it.each(['-1', '1.5', '100000'])('gõ "%s" → lỗi gắn đúng ô, cả hai nút chốt vô hiệu', async (text) => {
    stubReports();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await userEvent.clear(pen);
    await userEvent.type(pen, text);
    expect(pen).toHaveAttribute('aria-invalid', 'true');
    expect(pen).toHaveAccessibleDescription('Nhập số nguyên 0–99999');
    expect(await orderCell('Băng keo 2 mặt')).not.toHaveAttribute('aria-invalid');
    expect(exportBtn()).toBeDisabled();
    expect(printBtn()).toBeDisabled();
  });

  it.each([
    ['0', 0],
    ['99999', 99999],
  ])('biên hợp lệ "%s" → không lỗi, gửi %d', async (text, n) => {
    const f = stubReports();
    captureDownloads();
    openPage();
    const pen = await orderCell('Bút bi xanh');
    await userEvent.clear(pen);
    await userEvent.type(pen, text);
    expect(pen).not.toHaveAttribute('aria-invalid');
    await userEvent.click(exportBtn());
    await waitFor(() => expect(postsOf(f)).toHaveLength(1));
    expect(postsOf(f)[0].body.order_qty).toEqual({ [PEN_KEY]: n });
  });

  it('server trả VALIDATION fields order_qty.<khóa món ngoài danh mục> → lỗi tại đúng ô đó, không tải tệp', async () => {
    stubReports({ post: () => jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: [`order_qty.${TAPE_KEY}`] }) });
    const downloads = captureDownloads();
    openPage();
    const tape = await orderCell('Băng keo 2 mặt');
    await userEvent.clear(tape);
    await userEvent.type(tape, '8');
    await userEvent.click(exportBtn());
    await waitFor(() => expect(tape).toHaveAttribute('aria-invalid', 'true'));
    expect(tape).toHaveAccessibleDescription('Nhập số nguyên 0–99999');
    expect(await orderCell('Bút bi xanh')).not.toHaveAttribute('aria-invalid');
    expect(screen.getByRole('alert')).toHaveTextContent('Có ô Đặt mua chưa hợp lệ, xem ô báo đỏ.');
    expect(downloads).toEqual([]);
  });

  it('dòng ngoài DM biến mất giữa lúc tải và chốt (VALIDATION order_qty.<khóa đó>) → "Báo cáo đã đổi, đã tải lại", ô biến mất, không báo "Nhập số nguyên"; chốt lại không gửi khóa cũ', async () => {
    const f = stubReports({
      reportLoads: [reportFixture(), reportFixture({ custom: [] })],
      post: (body) =>
        TAPE_KEY in body.order_qty ? jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: [`order_qty.${TAPE_KEY}`] }) : jsonResponse(201, { id: 'snap-9' }),
    });
    captureDownloads();
    openPage();
    const tape = await orderCell('Băng keo 2 mặt');
    await userEvent.clear(tape);
    await userEvent.type(tape, '8');
    await userEvent.click(exportBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Báo cáo đã đổi, đã tải lại — xem lại số Đặt mua rồi chốt lại.');
    await waitFor(() => expect(screen.queryByRole('spinbutton', { name: 'Đặt mua Băng keo 2 mặt' })).toBeNull());
    expect(screen.queryByText('Nhập số nguyên 0–99999')).toBeNull();
    await userEvent.click(exportBtn());
    await waitFor(() => expect(postsOf(f)).toHaveLength(2));
    expect(postsOf(f)[1].body.order_qty).toEqual({});
  });

  it('POST chốt xong nhưng tải export 500 → báo "Đã chốt nhưng chưa tải được tệp…", không lưu tệp, bản mới vẫn vào danh sách', async () => {
    const f = stubReports({ exportFile: () => errorResponse(500, 'INTERNAL') });
    const downloads = captureDownloads();
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(exportBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Đã chốt nhưng chưa tải được tệp — bấm Tải lại ở danh sách bản chốt.');
    expect(postsOf(f)).toHaveLength(1);
    expect(downloads).toEqual([]);
    expect(await within(screen.getByRole('region', { name: 'Bản chốt' })).findByRole('row', { name: /Nguyễn Văn An/ })).toBeInTheDocument();
  });

  it('pending_custom_count 0 → bấm Xuất không hỏi', async () => {
    const f = stubReports();
    captureDownloads();
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(exportBtn());
    await waitFor(() => expect(postsOf(f)).toHaveLength(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('pending_custom_count 3 → hộp "Còn 3 món chưa xem…"; "Quay lại" không gọi POST, "Vẫn chốt" gọi', async () => {
    const f = stubReports({ reports: { '2026-10': reportFixture({ pending_custom_count: 3 }) } });
    captureDownloads();
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(exportBtn());
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Còn 3 món chưa xem — chốt vẫn thiếu các món này')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));
    expect(postsOf(f)).toEqual([]);
    await userEvent.click(exportBtn());
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Vẫn chốt' }));
    await waitFor(() => expect(postsOf(f)).toHaveLength(1));
  });

  it('pending_custom_count 1 → vẫn hỏi', async () => {
    stubReports({ reports: { '2026-10': reportFixture({ pending_custom_count: 1 }) } });
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(printBtn());
    expect(within(await screen.findByRole('dialog')).getByText('Còn 1 món chưa xem — chốt vẫn thiếu các món này')).toBeInTheDocument();
  });

  it('bấm Xuất Excel hai lần liền khi POST chưa xong → chỉ một bản chốt', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const f = stubReports({ post: async () => (await gate, jsonResponse(201, { id: 'snap-9' })) });
    const downloads = captureDownloads();
    openPage();
    await orderCell('Bút bi xanh');
    const user = userEvent.setup();
    await user.dblClick(exportBtn());
    release();
    await waitFor(() => expect(downloads).toHaveLength(1));
    expect(postsOf(f)).toHaveLength(1);
  });

  it('In trình ký → POST kind print rồi mở trang in của bản chốt', async () => {
    const f = stubReports();
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(printBtn());
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/reports/snapshots/snap-1/print'));
    expect(postsOf(f)[0].body).toEqual({ kind: 'print', order_qty: {} });
  });

  it('INVALID_PERIOD → báo ở đầu trang', async () => {
    stubReports({ post: () => jsonResponse(400, { code: 'INVALID_PERIOD', message: 'x' }) });
    openPage();
    await orderCell('Bút bi xanh');
    await userEvent.click(exportBtn());
    expect(await screen.findByRole('alert')).toHaveTextContent('Tháng này chưa tới, chưa lập báo cáo được.');
  });
});
