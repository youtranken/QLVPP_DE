import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { registrationRoute } from './registration-fixtures';
import { OPEN, calledUrls, stubSummaryApi } from './summary-fixtures';

const open = (path = '/admin/summary?ym=2026-11') => {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
};

afterEach(() => vi.unstubAllGlobals());

describe('OpenPeriodView — Tổng hợp kỳ đang mở, chỉ xem', () => {
  it('?ym=2026-11 giữ kỳ mở: nút "Tháng 11/2026 · Đang mở" aria-pressed, dải "chỉ xem" kèm giờ khóa; không "Sang Gửi ADM", không "Chưa đăng ký"', async () => {
    const f = stubSummaryApi(registrationRoute());
    open();
    const month = await screen.findByRole('group', { name: 'Chọn tháng' });
    expect(within(month).getByRole('button', { name: 'Tháng 11/2026 · Đang mở' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/Kỳ tháng 11 đang nhận đăng ký, chỉ xem\. Khóa lúc 00:00 ngày 11\/11\./)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Sang Gửi ADM/ })).toBeNull();
    expect(screen.queryByText('Chưa đăng ký')).toBeNull();
    expect(calledUrls(f).some((u) => u.includes('/2026-11/requests') || u.includes('/2026-11/unregistered'))).toBe(false);
  });

  it('bảng cột Người · Nhóm · Số món · Lưu lúc · Xem; team null thành "—"; "3 món · 22 đơn vị"; giờ "07/11 11:06"', async () => {
    stubSummaryApi(registrationRoute());
    open();
    const table = await screen.findByRole('table');
    const heads = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads.slice(0, 4)).toEqual(['Người', 'Nhóm', 'Số món', 'Lưu lúc']);
    const [a, b] = within(table).getAllByRole('row').slice(1);
    expect(a).toHaveTextContent('Nhân viên A');
    expect(a).toHaveTextContent('Team Test');
    expect(a).toHaveTextContent('3 món · 22 đơn vị');
    expect(a).toHaveTextContent('07/11 11:06');
    expect(within(b).getAllByRole('cell')[1]).toHaveTextContent('—');
    expect(screen.getByText('Đã đăng ký (3)')).toBeInTheDocument();
  });

  it('không có nút điều chỉnh, gỡ hay giao: mỗi dòng chỉ có "Xem"', async () => {
    stubSummaryApi(registrationRoute());
    open();
    await screen.findByRole('table');
    expect(screen.queryByRole('button', { name: /Điều chỉnh|Gỡ|Giao/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Xem phiếu của / })).toHaveLength(3);
  });

  it('ô "Đã đăng ký 32/40" từ summary; ô "Món ngoài danh mục" = tổng custom_count (1)', async () => {
    stubSummaryApi(registrationRoute());
    open();
    await screen.findByRole('table');
    const registered = screen.getByText('Đã đăng ký', { selector: '.stat-card__k' }).closest<HTMLElement>('.stat-card')!;
    expect(registered).toHaveTextContent(`${OPEN.registered}/${OPEN.headcount}`);
    const custom = screen.getByText('Món ngoài danh mục', { selector: '.stat-card__k' }).closest<HTMLElement>('.stat-card')!;
    expect(within(custom).getByText('1', { selector: '.stat-card__v' })).toBeInTheDocument();
  });

  it('0 người → "Chưa ai đăng ký kỳ này.", không bảng, ô custom = 0', async () => {
    stubSummaryApi(registrationRoute([]));
    open();
    expect(await screen.findByText('Chưa ai đăng ký kỳ này.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    const custom = screen.getByText('Món ngoài danh mục', { selector: '.stat-card__k' }).closest<HTMLElement>('.stat-card')!;
    expect(within(custom).getByText('0', { selector: '.stat-card__v' })).toBeInTheDocument();
  });

  it('?ym=2026-11&filter=pending_delivery&request=r-1 → vẫn là kỳ mở chỉ xem, không gọi requests hay admin/requests', async () => {
    const f = stubSummaryApi(registrationRoute());
    open('/admin/summary?ym=2026-11&filter=pending_delivery&request=r-1');
    await screen.findByRole('table');
    expect(calledUrls(f).some((u) => u.includes('/2026-11/requests') || u.startsWith('/api/admin/requests/'))).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('bấm "Xem phiếu của Nhân viên A" → popup "Phiếu của Nhân viên A"', async () => {
    stubSummaryApi(registrationRoute());
    open();
    await userEvent.click(await screen.findByRole('button', { name: 'Xem phiếu của Nhân viên A' }));
    expect(await screen.findByRole('dialog', { name: 'Phiếu của Nhân viên A' })).toBeInTheDocument();
  });

  it('bấm "Tháng trước" sang kỳ khóa 2026-10, bấm "Đang mở" quay lại kỳ mở', async () => {
    stubSummaryApi(registrationRoute());
    open();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    expect(await screen.findByText('Đã khóa')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Tháng 11/2026 · Đang mở' }));
    expect(await screen.findByText('Đã đăng ký (3)')).toBeInTheDocument();
  });
});
