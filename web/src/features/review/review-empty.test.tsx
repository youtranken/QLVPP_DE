import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import { PERIOD } from '@/test/request-api-stub';
import { reviewRow } from './review-fixtures';

const ACCEPTED = [reviewRow({ line_id: 'l-9', custom_name: 'Kéo', review_status: 'accepted' })];

function stub(over: { period?: () => Response; locked?: Response } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
      if (url === '/api/periods/current') return Promise.resolve(over.period?.() ?? jsonResponse(200, PERIOD));
      if (url === '/api/admin/periods/2026-10/summary') {
        return Promise.resolve(over.locked ?? jsonResponse(200, { ym: '2026-10', deadline: '2026-10-10T17:00:00.000Z', is_open: false, registered: 6, headcount: 8 }));
      }
      if (url === '/api/admin/periods/2026-11/summary') return Promise.resolve(jsonResponse(200, { ym: '2026-11', deadline: PERIOD.deadline, is_open: true, registered: 3, headcount: 8 }));
      if (url.startsWith('/api/admin/review')) return Promise.resolve(jsonResponse(200, { items: url.includes('status=accepted') ? ACCEPTED : [] }));
      return Promise.resolve(jsonResponse(200, []));
    }),
  );
}

afterEach(async () => {
  vi.unstubAllGlobals();
  await i18n.changeLanguage('vi');
});

const art = () => document.querySelector('.empty-state svg');

describe('Món ngoài danh mục — trạng thái trống', () => {
  it('Chờ xem rỗng: minh họa aria-hidden, không chữ/hoạt ảnh/token cũ; tiêu đề, dòng phụ "từ 00:00 ngày 11/11", nút Xem món đã chấp nhận', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/review');
    expect(await screen.findByRole('heading', { level: 2, name: 'Không còn món nào chờ xem' })).toBeInTheDocument();
    expect(await screen.findByText('Món ngoài danh mục của kỳ tháng 11 sẽ hiện ở đây từ 00:00 ngày 11/11.')).toBeInTheDocument();
    const svg = art()!;
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg.querySelector('text, animate, animateTransform')).toBeNull();
    expect(svg.outerHTML).not.toMatch(/--ill-|--g\d|--k-/);
    expect(svg.outerHTML).toContain('var(--c-acc-soft)');
  });

  it('nút "Xem món đã chấp nhận" chuyển sang tab Đã chấp nhận, tab vẫn mang tên cũ', async () => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/review');
    await userEvent.click(await screen.findByRole('button', { name: 'Xem món đã chấp nhận' }));
    expect(await screen.findByRole('radio', { name: /^Đã chấp nhận/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('location-search')).toHaveTextContent('status=accepted');
  });

  it('kỳ hiện tại lỗi → không dòng phụ nhưng vẫn có tiêu đề', async () => {
    mockViewport(1280);
    stub({ period: () => jsonResponse(500, { code: 'INTERNAL' }) });
    renderApp(makeMe('admin'), '/admin/review');
    expect(await screen.findByRole('heading', { level: 2, name: 'Không còn món nào chờ xem' })).toBeInTheDocument();
    expect(screen.queryByText(/sẽ hiện ở đây từ/)).toBeNull();
  });

  it('tiếng Anh: "from 00:00 on 11/11"', async () => {
    await i18n.changeLanguage('en');
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), '/admin/review');
    expect(await screen.findByText('Off-catalog items of the month 11 period will show up here from 00:00 on 11/11.')).toBeInTheDocument();
  });

  it.each([
    ['accepted', 'Chưa chấp nhận món nào'],
    ['converted', 'Chưa thêm món nào vào danh mục'],
    ['rejected', 'Chưa từ chối món nào'],
  ])('tab %s rỗng: khay rỗng review-none (aria-hidden, nền --c-surface-2), không dòng phụ kỳ mở, không nút', async (status, title) => {
    mockViewport(1280);
    stub();
    renderApp(makeMe('admin'), `/admin/review?status=${status}&ym=2026-10`);
    if (status === 'accepted') await userEvent.click(screen.getByRole('radio', { name: /^Từ chối/ }));
    expect(await screen.findByRole('heading', { level: 2, name: status === 'accepted' ? 'Chưa từ chối món nào' : title })).toBeInTheDocument();
    expect(art()).toHaveAttribute('aria-hidden', 'true');
    expect(art()!.outerHTML).toContain('var(--c-surface-2)');
    expect(art()!.outerHTML).not.toContain('--c-acc-soft');
    expect(screen.queryByText(/sẽ hiện ở đây từ/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xem món đã chấp nhận' })).toBeNull();
  });

  it('chưa có kỳ nào khóa (kỳ trước chưa có periods) → khung trống chung "Chưa có kỳ nào chốt sổ" thay khung này', async () => {
    mockViewport(1280);
    stub({ locked: jsonResponse(200, { ym: '2026-10', deadline: null, is_open: false, registered: 0, headcount: 0 }) });
    renderApp(makeMe('admin'), '/admin/review');
    expect(await screen.findByRole('heading', { level: 2, name: 'Chưa có kỳ nào chốt sổ' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Kỳ tháng 11 đang nhận đăng ký (3/8 người). Adm D&E làm việc từ 00:00 ngày 11/11.')).toBeInTheDocument());
    expect(within(document.querySelector<HTMLElement>('.empty-state')!).getByRole('link', { name: 'Xem đăng ký kỳ tháng 11' })).toHaveAttribute('href', '/admin/month?ym=2026-11');
    expect(screen.queryByText('Không còn món nào chờ xem')).toBeNull();
  });
});
