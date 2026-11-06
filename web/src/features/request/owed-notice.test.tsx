import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { jsonResponse, renderWithI18n, screen, waitFor } from '@/test/test-utils';
import { lineView } from '@/test/fixtures-request';
import { NOTE, PEN, facts, view } from '@/test/request-api-stub';
import { OwedNotice } from './owed-notice';

afterEach(() => {
  vi.unstubAllGlobals();
  void i18n.changeLanguage('vi');
});

const PREV = { ym: '2026-10', delivering: true };

function stub(lines: ReturnType<typeof lineView>[]) {
  const fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      url === '/api/me/request?ym=2026-10'
        ? jsonResponse(200, view({ period_ym: '2026-10', is_open: false, lines }))
        : jsonResponse(500, {}),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const show = (previous: { ym: string; delivering: boolean } | null) =>
  renderWithI18n(
    <MemoryRouter>
      <OwedNotice previous={previous} />
    </MemoryRouter>,
  );

describe('OwedNotice', () => {
  it('1 dòng còn nợ 1 ram → "Bạn còn chờ nhận Giấy A4 (1 ram) từ tháng 10. Không cần đăng ký lại." + link Xem → /history/2026-10', async () => {
    const a4 = { ...facts(PEN), name: 'Giấy A4', name_en: 'A4 paper', unit: 'ram' };
    stub([lineView({ id: 'l-1', item_id: 'i-a4', item: a4, qty: 3, delivered_qty: 1, cancelled_qty: 1 })]);
    show(PREV);
    const note = await screen.findByText(/Bạn còn chờ nhận/);
    expect(note).toHaveTextContent('Bạn còn chờ nhận Giấy A4 (1 ram) từ tháng 10. Không cần đăng ký lại.');
    expect(screen.getByRole('link', { name: 'Xem' })).toHaveAttribute('href', '/history/2026-10');
  });

  it('tiếng Anh: tên món name_en và ĐVT tiếng Anh', async () => {
    await i18n.changeLanguage('en');
    const a4 = { ...facts(PEN), name: 'Giấy A4', name_en: 'A4 paper', unit: 'ram' };
    stub([lineView({ id: 'l-1', item_id: 'i-a4', item: a4, qty: 1 })]);
    show(PREV);
    expect(await screen.findByText(/A4 paper \(1 ream\)/)).toBeInTheDocument();
  });

  it('0 dòng còn nợ (đã giao/hủy đủ, hoặc dòng bị từ chối) → không hiện gì', async () => {
    const fetchMock = stub([
      lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2, delivered_qty: 1, cancelled_qty: 1 }),
      lineView({ id: 'l-2', custom_name: 'Bìa', custom_unit: 'cai', qty: 4, review_status: 'rejected' }),
    ]);
    show(PREV);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText(/Bạn còn chờ nhận/)).toBeNull());
    expect(screen.queryByRole('link', { name: 'Xem' })).toBeNull();
  });

  it('2 món còn nợ → "2 món từ tháng 10"', async () => {
    stub([
      lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 }),
      lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 3, delivered_qty: 1 }),
    ]);
    show(PREV);
    const note = await screen.findByText(/Bạn còn chờ nhận/);
    expect(note).toHaveTextContent('Bạn còn chờ nhận 2 món từ tháng 10. Không cần đăng ký lại.');
  });

  it('kỳ trước không delivering (hoặc không có) → không gọi API', () => {
    const fetchMock = stub([lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })]);
    show({ ym: '2026-10', delivering: false });
    show(null);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/Bạn còn chờ nhận/)).toBeNull();
  });
});
