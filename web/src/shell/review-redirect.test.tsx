import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen } from '@/test/test-utils';
import { ReviewRedirect } from './review-redirect';

afterEach(() => vi.unstubAllGlobals());

function Where() {
  const loc = useLocation();
  return <p>{`${loc.pathname}${loc.search}`}</p>;
}

function show(url: string) {
  vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(200, { items: [{ period_ym: '2026-08-01' }, { period_ym: '2026-10-01' }], next_cursor: null })));
  renderWithI18n(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin/review" element={<ReviewRedirect />} />
        <Route path="/admin/month" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ReviewRedirect — link cũ /admin/review', () => {
  it('có ?ym (chuông kỳ khóa, link Giao hàng/Báo cáo) → đúng kỳ đó, chip Có món chờ duyệt', async () => {
    show('/admin/review?status=pending&ym=2026-10');
    expect(await screen.findByText('/admin/month?ym=2026-10&chip=pending')).toBeInTheDocument();
  });

  it('không ?ym → kỳ cũ nhất còn món chờ (2026-08)', async () => {
    show('/admin/review');
    expect(await screen.findByText('/admin/month?ym=2026-08&chip=pending')).toBeInTheDocument();
  });

  it('?ym sai dạng (2026-13) → bỏ qua, về kỳ cũ nhất còn món chờ', async () => {
    show('/admin/review?ym=2026-13');
    expect(await screen.findByText('/admin/month?ym=2026-08&chip=pending')).toBeInTheDocument();
  });
});
