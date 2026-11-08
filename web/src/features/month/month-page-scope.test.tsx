import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { person } from '@/features/summary/summary-fixtures';
import { LOCKED, PEOPLE, calledUrls, stubMonthApi } from './month-fixtures';

const open = (path = '/admin/month?ym=2026-10') => {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
};
const table = async () => within(await screen.findByRole('table'));

afterEach(() => vi.unstubAllGlobals());

describe('MonthPage: ?left=1 chỉ người đã nghỉ', () => {
  it('danh sách chỉ còn người đã nghỉ còn phần chưa nhận; người còn làm không hiện', async () => {
    const lan = person({ request_id: 'r-lan', user_sub: 'u-lan', full_name: 'Võ Thị Lan', user_status: 'locked', department: 'Phòng Test', total_qty: 5 });
    stubMonthApi(undefined, [...PEOPLE, lan]);
    open('/admin/month?ym=2026-10&left=1');
    const t = await table();
    expect(await t.findByRole('button', { name: 'Xem phiếu của Võ Thị Lan' })).toBeInTheDocument();
    expect(t.queryByRole('button', { name: 'Xem phiếu của Nhân viên A' })).toBeNull();
    expect(t.queryByRole('button', { name: 'Xem phiếu của Nhân viên B' })).toBeNull();
  });
});

describe('MonthPage: nạp đủ mọi trang người', () => {
  it('trang đầu còn next_cursor → tự nạp trang sau; số đếm chip và bước Giao tính cả hai trang', async () => {
    const first = PEOPLE.slice(0, 2);
    const second = PEOPLE.slice(2);
    const f = stubMonthApi((url) => {
      if (!/\/requests\?/.test(url) || url.includes('q=')) return undefined;
      const paged = url.includes('cursor=c2');
      return jsonResponse(200, { items: paged ? second : first, next_cursor: paged ? null : 'c2' });
    });
    open();
    const t = await table();
    await t.findByText('Nguyễn Văn An');
    expect(calledUrls(f).some((u) => u.includes('cursor=c2'))).toBe(true);
    expect(screen.getByRole('button', { name: /^Tất cả/ })).toHaveTextContent(String(PEOPLE.length));
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });
});

describe('MonthPage: ‹ Tháng trước dừng ở kỳ cũ nhất', () => {
  const withEarliest = (ym: string) => stubMonthApi((url) => (/\/summary$/.test(url) ? jsonResponse(200, { ...LOCKED, earliest_ym: ym }) : undefined));

  it('kỳ đang xem là kỳ cũ nhất có phiếu → nút bị tắt', async () => {
    withEarliest('2026-10');
    open();
    await table();
    await waitFor(() => expect(screen.getByRole('button', { name: /Tháng trước/ })).toBeDisabled());
  });

  it('còn kỳ cũ hơn → nút bấm được', async () => {
    withEarliest('2026-08');
    open();
    await table();
    await waitFor(() => expect(screen.getByRole('button', { name: /Tháng trước/ })).toBeEnabled());
  });
});
