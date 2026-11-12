import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { jsonResponse } from '@/test/test-utils';
import { LOCKED, calledUrls, stubMonthApi } from './month-fixtures';

const search = () => screen.getByTestId('location-search').textContent ?? '';
const open = (path = '/admin/month?ym=2026-10') => {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
};
const table = async () => within(await screen.findByRole('table'));

afterEach(() => vi.unstubAllGlobals());

describe('MonthPage: kỳ khóa', () => {
  it('h1 "Kỳ tháng 10" và dải 4 bước gọn: Đăng ký 4/5 · Gửi NCC 11:50 08/11 · Nhận hàng 19/21 món · Giao 1/4 phiếu', async () => {
    stubMonthApi();
    open();
    expect(await screen.findByRole('heading', { level: 1, name: 'Kỳ tháng 10' })).toBeInTheDocument();
    const steps = await screen.findByRole('list', { name: 'Các bước của tháng' });
    const text = within(steps).getAllByRole('listitem').map((li) => li.textContent);
    expect(text).toEqual(['Đăng ký4/5', 'Gửi NCC11:50 08/11', 'Nhận hàng19/21 món', 'Giao1/4 phiếu']);
  });

  it('bảng: Người · Nhóm · Số món · Tổng · Giao · Ghi chú · Lưu lúc, nhóm theo phòng "Phòng Test · 4 người", "Chưa có phòng · 1 người" cuối', async () => {
    stubMonthApi();
    open();
    const t = await table();
    const headers = t.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.slice(0, 7)).toEqual(['Người', 'Nhóm', 'Số món', 'Tổng', 'Giao', 'Ghi chú', 'Lưu lúc']);
    const groups = t.getAllByRole('row').map((r) => r.textContent ?? '').filter((x) => /\d người/.test(x) && !x.includes('Điều chỉnh'));
    expect(groups[0]).toContain('Phòng Test');
    expect(groups[0]).toContain('4 người');
    expect(groups.at(-1)).toContain('Chưa có phòng');
  });

  it('Ghi chú: "Vượt tối đa", "Adm D&E đã điều chỉnh", "Không có gì để giao", "Món ngoài danh mục"', async () => {
    stubMonthApi();
    open();
    const t = await table();
    expect(t.getAllByText('Vượt tối đa').length).toBe(2);
    expect(t.getByText('Adm D&E đã điều chỉnh')).toBeInTheDocument();
    expect(t.getByText('Không có gì để giao')).toBeInTheDocument();
    expect(t.getByText('Món ngoài danh mục')).toBeInTheDocument();
  });

  it('Ghi chú trống → "—" (ô có nhãn ở dạng thẻ không để trống)', async () => {
    stubMonthApi();
    open();
    const t = await table();
    const row = t.getByText('Nhân viên E').closest('tr')!;
    expect(row.querySelector('.mk-notes')).toBeNull();
    expect(within(row).getAllByRole('cell').some((c) => c.textContent === '—Chưa có')).toBe(true);
  });

  it('chip Tất cả 5 · Có ghi chú 4 · Chưa giao xong 3 lọc tại chỗ và ghi ?chip=', async () => {
    const f = stubMonthApi();
    open();
    const t = await table();
    await userEvent.click(screen.getByRole('button', { name: /Có ghi chú/ }));
    expect(search()).toContain('chip=noted');
    await waitFor(() => expect(t.queryByText('Nhân viên E')).toBeNull());
    expect(t.getByText('Nhân viên A')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Chưa giao xong/ }));
    expect(search()).toContain('chip=undelivered');
    await waitFor(() => expect(t.queryByText('Nhân viên E')).toBeNull());
    expect(t.queryByText('Nguyễn Văn An')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Tất cả/ }));
    expect(search()).not.toContain('chip=');
    expect(await t.findByText('Nhân viên E')).toBeInTheDocument();
    // chip lọc ở client: không gọi lại API theo chip
    expect(calledUrls(f).filter((u) => u.includes('/requests?') && u.includes('chip')).length).toBe(0);
  });

  it('số trên chip đếm đúng: Tất cả 5, Có ghi chú 4, Chưa giao xong 3', async () => {
    stubMonthApi();
    open();
    await table();
    expect(screen.getByRole('button', { name: /^Tất cả/ })).toHaveTextContent('5');
    expect(screen.getByRole('button', { name: /^Có ghi chú/ })).toHaveTextContent('4');
    expect(screen.getByRole('button', { name: /^Chưa giao xong/ })).toHaveTextContent('3');
  });

  it('"Xem" mở popup phiếu (RegistrationDialog) với ‹ › theo thứ tự bảng', async () => {
    stubMonthApi();
    open();
    const t = await table();
    await userEvent.click(t.getByRole('button', { name: 'Xem phiếu của Nhân viên A' }));
    const dialog = await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên A' });
    expect(within(dialog).queryByText(/Nhân viên còn sửa được tới/)).toBeNull();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Người sau' }));
    expect(await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên B' })).toBeInTheDocument();
  });

  it('"Điều chỉnh" mở AdjustDrawer ?request=<id>; mở từ ?left=1 chọn sẵn Người đã nghỉ', async () => {
    stubMonthApi();
    open();
    const t = await table();
    await userEvent.click(t.getByRole('button', { name: 'Điều chỉnh phiếu của Nhân viên A' }));
    await waitFor(() => expect(search()).toContain('request=r-a'));
    expect(await screen.findByRole('dialog', { name: 'Điều chỉnh phiếu Nhân viên A' })).toBeInTheDocument();
  });

  it('không có "Chép tin nhắc", không danh sách/tab chưa đăng ký, không chữ "phiếu · … món · … đơn vị"', async () => {
    stubMonthApi();
    open();
    await table();
    expect(screen.queryByRole('button', { name: /Chép/ })).toBeNull();
    expect(screen.queryByText(/chưa đăng ký/i)).toBeNull();
    expect(screen.queryByText(/đơn vị ·|· \d+ món/)).toBeNull();
  });

  it('tìm "phòng test" gọi API với q và chỉ còn người của phòng đó', async () => {
    const f = stubMonthApi();
    open();
    const t = await table();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người hoặc phòng' }), 'phòng test');
    await waitFor(() => expect(calledUrls(f).some((u) => u.includes('q=ph%C3%B2ng+test'))).toBe(true));
    await waitFor(() => expect(t.queryByRole('button', { name: 'Xem phiếu của Nguyễn Văn An' })).toBeNull());
  });
});

describe('MonthPage: kỳ cũ (không phải kỳ khóa gần nhất)', () => {
  it('?ym=2026-09: dải vẫn đủ 4 bước từ dữ liệu thật, không bước nào "—", Gửi NCC dẫn tới báo cáo đúng tháng', async () => {
    const f = stubMonthApi();
    open('/admin/month?ym=2026-09');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kỳ tháng 9' })).toBeInTheDocument();
    const steps = await screen.findByRole('list', { name: 'Các bước của tháng' });
    await waitFor(() => expect(within(steps).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Đăng ký4/5', 'Gửi NCC11:50 08/11', 'Nhận hàng19/21 món', 'Giao1/4 phiếu']));
    expect(within(steps).queryByText('—')).toBeNull();
    expect(within(steps).getByRole('link', { name: /Gửi NCC/ })).toHaveAttribute('href', '/admin/reports?ym=2026-09');
    const urls = calledUrls(f);
    expect(urls).toContain('/api/admin/periods/2026-09/send-state');
    expect(urls).toContain('/api/admin/periods/2026-09/arrivals-plan');
  });
});

describe('MonthPage: kỳ mặc định khi URL không có ym', () => {
  const lockedSummary = (over: Partial<typeof LOCKED>) => (url: string) =>
    url === '/api/admin/periods/2026-10/summary' ? jsonResponse(200, { ...LOCKED, ...over }) : undefined;

  it('kỳ khóa còn dòng chưa giao → mở kỳ khóa ?ym=2026-10', async () => {
    stubMonthApi();
    open('/admin/month');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kỳ tháng 10' })).toBeInTheDocument();
    await waitFor(() => expect(search()).toBe('?ym=2026-10'));
  });

  it('kỳ khóa không có phiếu (registered=0) → mở kỳ đang đăng ký ?ym=2026-11', async () => {
    stubMonthApi(lockedSummary({ registered: 0, lines_pending_delivery: 0 }));
    open('/admin/month');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kỳ tháng 11' })).toBeInTheDocument();
    await waitFor(() => expect(search()).toBe('?ym=2026-11'));
  });

  it('kỳ khóa đã giao xong (lines_pending_delivery=0) → mở kỳ đang đăng ký', async () => {
    stubMonthApi(lockedSummary({ lines_pending_delivery: 0 }));
    open('/admin/month');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kỳ tháng 11' })).toBeInTheDocument();
    await waitFor(() => expect(search()).toBe('?ym=2026-11'));
  });

  it('có ?ym= → giữ nguyên, không hỏi tổng kết kỳ khóa để chọn mặc định', async () => {
    const f = stubMonthApi(lockedSummary({ lines_pending_delivery: 0 }));
    open('/admin/month?ym=2026-11');
    expect(await screen.findByRole('heading', { level: 1, name: 'Kỳ tháng 11' })).toBeInTheDocument();
    await table();
    expect(search()).toBe('?ym=2026-11');
    expect(calledUrls(f)).not.toContain('/api/admin/periods/2026-10/summary');
  });
});

describe('MonthPage: chuyển kỳ', () => {
  it('chọn "Kỳ đang đăng ký (tháng 11)" → bảng chỉ xem (Người · Nhóm · Số món · Tổng · Lưu lúc), dải chỉ bước Đăng ký sáng, URL ?ym=2026-11', async () => {
    stubMonthApi();
    open();
    await table();
    await userEvent.click(screen.getByRole('radio', { name: 'Kỳ đang đăng ký (tháng 11)' }));
    await waitFor(() => expect(search()).toContain('ym=2026-11'));
    expect(await screen.findByRole('heading', { level: 1, name: 'Kỳ tháng 11' })).toBeInTheDocument();
    const t = await table();
    await t.findByText('Nhân viên B');
    expect(t.getAllByRole('columnheader').map((h) => h.textContent).slice(0, 5)).toEqual(['Người', 'Nhóm', 'Số món', 'Tổng', 'Lưu lúc']);
    const steps = screen.getByRole('list', { name: 'Các bước của tháng' });
    expect(within(steps).getByText('3/5')).toBeInTheDocument();
    expect(within(steps).getAllByText('—')).toHaveLength(3);
  });

  it('‹ Tháng trước → ?ym=2026-09 và hiện nút "Tháng 9/2026" được chọn', async () => {
    stubMonthApi();
    open();
    await table();
    // Nhãn đọc kèm tháng sẽ tới (chữ thấy được đứng đầu nhãn)
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước: tháng 9/2026' }));
    await waitFor(() => expect(search()).toContain('ym=2026-09'));
    expect(await screen.findByRole('radio', { name: 'Tháng 9/2026' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('button', { name: 'Tháng trước: tháng 8/2026' })).toBeInTheDocument();
  });
});

describe('MonthPage: người đã nghỉ và 390 px', () => {
  it('người đã nghỉ còn phần chưa nhận → đúng một dòng W25 với nút Xử lý sang ?left=1', async () => {
    const left = { ...(await import('./month-fixtures')).PEOPLE[0]!, user_status: 'locked', full_name: 'Võ Thị Lan' };
    stubMonthApi((url) => (url.includes('filter=left') ? new Response(JSON.stringify({ items: [left], next_cursor: null }), { status: 200, headers: { 'content-type': 'application/json' } }) : undefined));
    open();
    await table();
    const alert = await screen.findByText(/Võ Thị Lan/, { selector: '.mk-left span' });
    expect(alert).toBeInTheDocument();
    expect(document.querySelectorAll('.mk-left')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Xử lý' })).toHaveAttribute('href', '/admin/month?ym=2026-10&left=1');
  });

  it('390: bảng xếp chồng, chip và ô tìm vẫn dùng được', async () => {
    stubMonthApi();
    mockViewport(390);
    renderApp(makeMe('admin'), '/admin/month?ym=2026-10');
    await table();
    expect(screen.getByRole('searchbox', { name: 'Tìm người hoặc phòng' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tất cả/ })).toBeInTheDocument();
    expect(document.querySelector('.table-wrap, .table')).not.toBeNull();
  });
});
