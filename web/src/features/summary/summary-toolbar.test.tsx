import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { OPEN, stubSummaryApi } from './summary-fixtures';

const open = (width: number, path = '/admin/summary') => {
  mockViewport(width);
  renderApp(makeMe('admin'), path);
};
const precedes = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
const setClipboard = (value: unknown) => Object.defineProperty(navigator, 'clipboard', { value, configurable: true });

afterEach(() => {
  vi.unstubAllGlobals();
  setClipboard(undefined);
});

describe('SummaryPage — thanh công cụ theo luật bố cục', () => {
  it('1280: bộ chọn kỳ đứng trước ô tìm và chuyển chế độ xem; nút "Chép DS chưa đăng ký (8)" hiện thẳng, không có menu ⋯', async () => {
    stubSummaryApi();
    open(1280);
    const month = await screen.findByRole('group', { name: 'Chọn tháng' });
    const searchBox = screen.getByRole('searchbox', { name: 'Tìm người, email…' });
    const view = screen.getByRole('radiogroup', { name: 'Cách xem' });
    expect(precedes(month, searchBox)).toBe(true);
    expect(precedes(searchBox, view)).toBe(true);
    expect(await screen.findByRole('button', { name: 'Chép DS chưa đăng ký (8)' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Thao tác khác' })).toBeNull();
    expect(searchBox).toHaveAttribute('placeholder', 'Tìm người, email…');
  });

  it('390: "Chép DS chưa đăng ký (8)" nằm trong menu ⋯, bấm thì sao chép và báo "Đã sao chép 2 người"; "Tạo phiếu hộ" vẫn là nút', async () => {
    stubSummaryApi();
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    open(390);
    const more = await screen.findByRole('button', { name: 'Thao tác khác' });
    expect(screen.queryByRole('button', { name: /Chép DS chưa đăng ký/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Tạo phiếu hộ' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Tìm người, email…' })).toHaveAttribute('placeholder', 'Tìm người…');
    await userEvent.click(more);
    await userEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Chép DS chưa đăng ký (8)' }));
    expect(await screen.findByText('Đã sao chép 2 người')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledTimes(1);
  });

  it('390, không còn ai chưa đăng ký (0) → mục menu tắt, title "Mọi người đã đăng ký"', async () => {
    stubSummaryApi((url) => (url === '/api/admin/periods/2026-11/summary' ? jsonResponse(200, { ...OPEN, unregistered: 0 }) : undefined));
    open(390);
    await userEvent.click(await screen.findByRole('button', { name: 'Thao tác khác' }));
    const off = screen.getByRole('menuitem', { name: 'Chép DS chưa đăng ký (0)' });
    expect(off).toHaveAttribute('aria-disabled', 'true');
    expect(off).toHaveAttribute('title', 'Mọi người đã đăng ký');
  });

  it('390, còn 1 người chưa đăng ký → mục menu bật', async () => {
    stubSummaryApi((url) => (url === '/api/admin/periods/2026-11/summary' ? jsonResponse(200, { ...OPEN, unregistered: 1 }) : undefined));
    open(390);
    await userEvent.click(await screen.findByRole('button', { name: 'Thao tác khác' }));
    expect(screen.getByRole('menuitem', { name: 'Chép DS chưa đăng ký (1)' })).not.toHaveAttribute('aria-disabled');
  });

  it('kỳ chưa có phiếu → không hiện đầu bảng, chỉ còn câu "Chưa có phiếu nào trong kỳ này."', async () => {
    stubSummaryApi((url) => (url.includes('by=person') ? jsonResponse(200, { items: [], next_cursor: null }) : undefined));
    open(1280);
    expect(await screen.findByText('Chưa có phiếu nào trong kỳ này.')).toBeInTheDocument();
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
  });
});
