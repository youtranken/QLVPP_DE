import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { PERIOD } from '@/test/request-api-stub';
import { reviewRow } from './review-fixtures';

const ROWS = [
  reviewRow(),
  reviewRow({
    line_id: 'l-2',
    custom_name: 'Bìa còng 7 cm',
    custom_unit: 'cai',
    custom_note: null,
    image_file_id: null,
    qty: 3,
    full_name: 'Võ Thị Lan',
    department: null,
    previously_accepted: true,
    period_ym: '2026-10',
  }),
];
const ACCEPTED = [reviewRow({ line_id: 'l-9', custom_name: 'Kéo', review_status: 'accepted' })];

function stub(period: () => Promise<Response> = () => Promise.resolve(jsonResponse(200, PERIOD))) {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/periods/current') return period();
    if (url.startsWith('/api/admin/review')) {
      const items = url.includes('status=pending') ? ROWS : url.includes('status=accepted') ? ACCEPTED : [];
      return Promise.resolve(jsonResponse(200, { items }));
    }
    return Promise.resolve(jsonResponse(200, []));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const listUrls = (f: ReturnType<typeof stub>) =>
  f.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/api/admin/review'));

afterEach(() => vi.unstubAllGlobals());

describe('ReviewPage — /admin/review', () => {
  it('đúng một h1 "Món ngoài danh mục", mô tả; không còn dòng chú thích xám giải thích nút', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/review');
    await screen.findByRole('article', { name: 'Băng keo 2 mặt' });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Món ngoài danh mục');
    expect(screen.getByText('Món nhân viên tự thêm vào phiếu — xem từng món trước khi mua.')).toBeInTheDocument();
    expect(screen.queryByText(/mua riêng lần này · /)).toBeNull();
  });

  it('4 tab trạng thái có đếm từ 4 truy vấn song song cùng kỳ; mặc định Chờ xem', async () => {
    mockViewport(1280);
    const fetchMock = stub();
    renderApp(makeMe('admin'), '/admin/review');
    expect(await screen.findByRole('radio', { name: /^Chờ xem,\s*2$/ })).toHaveAttribute('aria-checked', 'true');
    expect(await screen.findByRole('radio', { name: /^Đã chấp nhận,\s*1$/ })).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /^Đã thêm vào danh mục,\s*0$/ })).toBeInTheDocument();
    expect(await screen.findByRole('radio', { name: /^Từ chối,\s*0$/ })).toBeInTheDocument();
    expect([...new Set(listUrls(fetchMock))].sort()).toEqual([
      '/api/admin/review?status=accepted',
      '/api/admin/review?status=converted',
      '/api/admin/review?status=pending',
      '/api/admin/review?status=rejected',
    ]);
    expect(screen.getByRole('radio', { name: 'Mọi kỳ' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByRole('group', { name: 'Chọn tháng' })).toBeNull();
  });

  it('thẻ có ảnh: alt "Ảnh {tên} do nhân viên gửi", "{qty} {ĐVT} · Phiếu tháng M/Y", ghi chú, người · phòng ban · thêm lúc', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/review');
    const a = await screen.findByRole('article', { name: 'Băng keo 2 mặt' });
    expect(within(a).getByRole('img', { name: 'Ảnh Băng keo 2 mặt do nhân viên gửi' })).toHaveAttribute('src', '/api/files/f-line');
    expect(a).toHaveTextContent('2 cái · Phiếu tháng 11/2026');
    expect(a).toHaveTextContent('“Loại 2 cm, dán bản vẽ”');
    expect(a).toHaveTextContent(/Phạm Văn Đức · Tổ Giám sát · thêm lúc /);
    expect(within(a).queryByText(/Đã chấp nhận kỳ trước/)).toBeNull();
  });

  it('thẻ không ảnh: không có img, hiện ô giữ chỗ với nhãn "Không có ảnh"; thiếu phòng ban → "Chưa có phòng ban"', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/review');
    const b = await screen.findByRole('article', { name: 'Bìa còng 7 cm' });
    expect(within(b).queryByRole('img')).toBeNull();
    expect(within(b).getByText('Không có ảnh')).toBeInTheDocument();
    expect(b).toHaveTextContent('Võ Thị Lan · Chưa có phòng ban');
  });

  it('previously_accepted → gợi ý "Đã chấp nhận kỳ trước → nên Thêm vào danh mục"', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/review');
    const b = await screen.findByRole('article', { name: 'Bìa còng 7 cm' });
    expect(within(b).getByText('Đã chấp nhận kỳ trước → nên Thêm vào danh mục')).toBeInTheDocument();
  });

  it('lọc trạng thái và kỳ → gửi ?status=&ym= và giữ trên URL', async () => {
    mockViewport(1280);
    const fetchMock = stub();
    renderApp(makeMe('admin'), '/admin/review');
    await screen.findByRole('article', { name: 'Băng keo 2 mặt' });
    await userEvent.click(screen.getByRole('radio', { name: /^Từ chối/ }));
    expect(await screen.findByText('Chưa từ chối món nào')).toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('?status=rejected');
    await userEvent.click(screen.getByRole('radio', { name: 'Theo tháng' }));
    await waitFor(() => expect(listUrls(fetchMock)).toContain('/api/admin/review?status=rejected&ym=2026-10'));
    expect(within(screen.getByRole('group', { name: 'Chọn tháng' })).getByText('Tháng 10/2026')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await waitFor(() => expect(listUrls(fetchMock)).toContain('/api/admin/review?status=rejected&ym=2026-09'));
    expect(screen.getByTestId('location-search')).toHaveTextContent('ym=2026-09');
    await userEvent.click(screen.getByRole('radio', { name: 'Mọi kỳ' }));
    expect(screen.getByTestId('location-search')).not.toHaveTextContent('ym=');
    expect(screen.queryByRole('group', { name: 'Chọn tháng' })).toBeNull();
  });

  it('tab rỗng có câu riêng theo trạng thái; chuyển về Chờ xem lại thấy thẻ', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/review?status=converted');
    expect(await screen.findByText('Chưa thêm món nào vào danh mục')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /^Chờ xem/ }));
    await screen.findByRole('article', { name: 'Băng keo 2 mặt' });
  });

  it('URL ?status lạ → về Chờ xem; ?ym sai mẫu bị bỏ', async () => {
    mockViewport(1280);
    const fetchMock = stub();
    renderApp(makeMe('admin'), '/admin/review?status=xyz&ym=2026-13');
    await screen.findByRole('article', { name: 'Băng keo 2 mặt' });
    expect(listUrls(fetchMock).every((u) => !u.includes('ym='))).toBe(true);
    expect(listUrls(fetchMock)).toContain('/api/admin/review?status=pending');
  });

  it.each([
    ['2026-10', 'Tháng 10/2026', false, true],
    ['2026-01', 'Tháng 1/2026', false, false],
    ['2025-10', 'Tháng 10/2025', true, false],
  ])('?ym=%s → "Theo tháng" bật, hiện "%s"; ‹ tắt=%s (giới hạn 12 tháng gần nhất), › tắt=%s (trần = kỳ khóa gần nhất)', async (ym, label, prevOff, nextOff) => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), `/admin/review?ym=${ym}`);
    const group = await screen.findByRole('group', { name: 'Chọn tháng' });
    expect(screen.getByRole('radio', { name: 'Theo tháng' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByText(label)).toBeInTheDocument();
    await waitFor(() => {
      expect(within(group).getByRole('button', { name: 'Tháng trước' }).hasAttribute('disabled')).toBe(prevOff);
      expect(within(group).getByRole('button', { name: 'Tháng sau' }).hasAttribute('disabled')).toBe(nextOff);
    });
  });

  it.each([
    ['đang tải', () => new Promise<Response>(() => {})],
    ['lỗi', () => Promise.resolve(jsonResponse(500, { code: 'INTERNAL' }))],
  ])('?ym=2026-10 khi kỳ hiện tại %s → vẫn giữ "Theo tháng" và ô chọn tháng, trần tạm là tháng đang xem', async (_state, period) => {
    mockViewport(1280);
    stub(period);
    renderApp(makeMe('admin'), '/admin/review?ym=2026-10');
    const group = await screen.findByRole('group', { name: 'Chọn tháng' });
    expect(screen.getByRole('radio', { name: 'Theo tháng' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).getByText('Tháng 10/2026')).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    expect(within(group).getByRole('button', { name: 'Tháng trước' })).toBeEnabled();
  });

  it.each(['2026-11', '2026-12'])('?ym=%s (kỳ mở hoặc tương lai) → URL thành 2026-10 (replace), gọi API với 2026-10, hiện dải "đang mở"', async (ym) => {
    mockViewport(1280);
    const fetchMock = stub();
    renderApp(makeMe('admin'), `/admin/review?ym=${ym}`);
    expect(await screen.findByText('Kỳ tháng 11 đang mở, xem được từ 00:00 ngày 11/11.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-10'));
    await waitFor(() => expect(listUrls(fetchMock)).toContain('/api/admin/review?status=pending&ym=2026-10'));
  });
});
