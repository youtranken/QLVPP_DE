import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { PERIOD } from '@/test/request-api-stub';
import { reviewResult, reviewRow } from './review-fixtures';

const ROWS = [
  reviewRow(),
  reviewRow({
    line_id: 'l-2',
    custom_name: 'Bìa còng 7 cm',
    custom_unit: 'cai',
    custom_note: null,
    qty: 3,
    full_name: 'Võ Thị Lan',
    department: null,
    previously_accepted: true,
    period_ym: '2026-10',
  }),
];

function stub(review: () => Response = () => jsonResponse(200, reviewResult('accepted'))) {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
    if (url.startsWith('/api/admin/review')) {
      return Promise.resolve(jsonResponse(200, { items: url.includes('status=pending') ? ROWS : [] }));
    }
    if (url === '/api/admin/lines/l-1/review') return Promise.resolve(review());
    return Promise.resolve(jsonResponse(200, []));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const listUrls = (f: ReturnType<typeof stub>) =>
  f.mock.calls.map((c) => String(c[0])).filter((u) => u.startsWith('/api/admin/review'));

const card = (name: string) => screen.getByRole('article', { name });

afterEach(() => vi.unstubAllGlobals());

describe('ReviewPage — /admin/review', () => {
  it('mặc định "Chờ xem", mọi kỳ; thẻ dòng có ảnh lớn, tên, SL + ĐVT, ghi chú, người, phòng ban, kỳ', async () => {
    mockViewport(1280);
    const fetchMock = stub();
    renderApp(makeMe('admin'), '/admin/review');
    expect(screen.getByRole('heading', { level: 1, name: 'Món ngoài danh mục' })).toBeInTheDocument();
    await screen.findByRole('article', { name: 'Băng keo 2 mặt' });
    expect(listUrls(fetchMock)).toEqual(['/api/admin/review?status=pending']);
    expect(screen.getByRole('radio', { name: 'Chờ xem' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByLabelText('Kỳ')).toHaveValue('');
    const a = card('Băng keo 2 mặt');
    expect(within(a).getByRole('img', { name: 'Ảnh Băng keo 2 mặt' })).toHaveAttribute('src', '/api/files/f-line');
    expect(a).toHaveTextContent('2 cái');
    expect(a).toHaveTextContent('“Loại 2 cm, dán bản vẽ”');
    expect(a).toHaveTextContent('Phạm Văn Đức · Tổ Giám sát');
    expect(a).toHaveTextContent('Phiếu tháng 11/2026');
    expect(within(a).queryByText(/Đã chấp nhận kỳ trước/)).toBeNull();
    expect(card('Bìa còng 7 cm')).toHaveTextContent('Võ Thị Lan · Chưa có phòng ban');
  });

  it('previously_accepted → nhãn "Đã chấp nhận kỳ trước → nên Thêm vào danh mục"', async () => {
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
    await userEvent.click(screen.getByRole('radio', { name: 'Từ chối' }));
    expect(await screen.findByText('Không có món nào ở mục này')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Kỳ'), '2026-10');
    await waitFor(() => expect(listUrls(fetchMock)).toContain('/api/admin/review?status=rejected&ym=2026-10'));
    expect(screen.getByRole('option', { name: 'Tháng 11/2026' })).toBeInTheDocument();
  });

  it('URL ?status lạ → về Chờ xem', async () => {
    mockViewport(1280);
    const fetchMock = stub();
    renderApp(makeMe('admin'), '/admin/review?status=xyz&ym=2026-13');
    await screen.findByRole('article', { name: 'Băng keo 2 mặt' });
    expect(listUrls(fetchMock)).toEqual(['/api/admin/review?status=pending']);
  });

  it('xử lý xong thẻ vẫn ở lại với nhãn trạng thái (không biến mất ngay)', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/review');
    const a = await screen.findByRole('article', { name: 'Băng keo 2 mặt' });
    await userEvent.click(within(a).getByRole('button', { name: 'Chấp nhận' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Chấp nhận' }));
    expect(await within(a).findByText('Đã chấp nhận')).toBeInTheDocument();
    expect(card('Băng keo 2 mặt')).toBeInTheDocument();
  });

  it('409 LINE_ALREADY_REVIEWED → "Dòng này vừa được xử lý" + tải lại danh sách', async () => {
    mockViewport(1280);
    const fetchMock = stub(() => jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' }));
    renderApp(makeMe('admin'), '/admin/review');
    const a = await screen.findByRole('article', { name: 'Băng keo 2 mặt' });
    await userEvent.click(within(a).getByRole('button', { name: 'Chấp nhận' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Chấp nhận' }));
    expect(await screen.findByText('Dòng này vừa được xử lý — danh sách đã được làm mới.')).toBeInTheDocument();
    await waitFor(() => expect(listUrls(fetchMock)).toHaveLength(2));
  });
});
