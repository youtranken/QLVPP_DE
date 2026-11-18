import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import { A, C, person, pLine } from '@/features/delivery/people/people-fixtures';
import { backlogLine, personGroup } from '@/features/delivery/backlog-fixtures';

const PEOPLE_URL = '/api/admin/periods/2026-10/delivery-people';
const REVIEW = {
  line_id: 'l1',
  request_id: 'r-hm',
  period_ym: '2026-10',
  user_sub: 'u-hm',
  full_name: 'Hoàng Minh',
  custom_name: 'Bìa còng 7cm',
  created_at: '2026-10-20T03:00:00.000Z',
};
const GONE = person({ user_sub: 'u-v', full_name: 'Phạm Quốc Việt', user_status: 'left', lines: [pLine({ line_id: 'lv', qty: 17, remaining_qty: 17 })] });

function stubToday(over: Parameters<typeof stubShellApi>[0] = {}) {
  return stubShellApi({
    '/api/admin/review?status=pending': () => jsonResponse(200, { items: [REVIEW] }),
    '/api/admin/periods/2026-11/summary': () => jsonResponse(200, { registered: 5, headcount: 16 }),
    [PEOPLE_URL]: () => jsonResponse(200, { ym: '2026-10', people: [A, C, GONE] }),
    '/api/admin/backlog?by=person': () => jsonResponse(200, { groups: [personGroup([backlogLine()])] }),
    ...over,
  });
}

const tiles = () => screen.getByRole('region', { name: 'Số việc' });

afterEach(() => vi.unstubAllGlobals());

describe('Việc hôm nay', () => {
  it('/admin mở Việc hôm nay; mục sidebar đầu tiên là "Việc hôm nay" và đang sáng', async () => {
    mockViewport(1280);
    stubToday();
    renderApp(makeMe('admin'), '/admin');
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/today');
    expect(await screen.findByRole('heading', { level: 1, name: /Nguyễn Văn An/ })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Menu quản lý' });
    const first = within(nav).getAllByRole('link')[0];
    expect(first).toHaveAccessibleName('Việc hôm nay');
    expect(first).toHaveAttribute('aria-current', 'page');
  });

  it('một query lỗi thì chỉ ô của nó báo lỗi và có "Thử lại"; ô khác vẫn có số', async () => {
    mockViewport(1280);
    let fail = true;
    const f = stubToday({ [PEOPLE_URL]: () => (fail ? jsonResponse(500, { code: 'INTERNAL' }) : jsonResponse(200, { ym: '2026-10', people: [A, C] })) });
    renderApp(makeMe('admin'), '/admin/today');
    const ready = await within(tiles()).findByRole('group', { name: 'Giao được ngay' });
    expect(within(ready).getByText('Không tải được')).toBeInTheDocument();
    expect(within(tiles()).getByRole('group', { name: 'Người đã nghỉ còn phần' })).toBeInTheDocument();
    expect(within(tiles()).getByRole('link', { name: /Còn nợ tháng trước\s*1/ })).toBeInTheDocument();
    expect(within(tiles()).getByRole('link', { name: /Món ngoài danh mục chờ duyệt\s*1/ })).toBeInTheDocument();
    expect(within(tiles()).getAllByRole('button', { name: 'Thử lại' })).toHaveLength(2);
    fail = false;
    await userEvent.click(within(ready).getByRole('button', { name: 'Thử lại' }));
    expect(await within(tiles()).findByRole('link', { name: /Giao được ngay\s*2/ })).toBeInTheDocument();
    expect(f.mock.calls.filter((c) => c[0] === PEOPLE_URL).length).toBeGreaterThanOrEqual(2);
  });

  it('chưa có kỳ khóa và mọi danh sách rỗng: không trắng trang, ô số 0 ghi "Không có việc", không báo lỗi', async () => {
    mockViewport(1280);
    stubToday({
      '/api/admin/review?status=pending': () => jsonResponse(200, { items: [] }),
      [PEOPLE_URL]: () => jsonResponse(409, { code: 'PERIOD_NOT_LOCKED', deadline: '2026-11-10T17:00:00.000Z' }),
      '/api/admin/backlog?by=person': () => jsonResponse(200, { groups: [] }),
    });
    renderApp(makeMe('admin'), '/admin/today');
    const ready = await within(tiles()).findByRole('link', { name: /Giao được ngay\s*0/ });
    expect(ready).toHaveTextContent('Không có việc');
    expect(within(tiles()).getByRole('link', { name: /Món ngoài danh mục chờ duyệt\s*0/ })).toHaveTextContent('Không có việc');
    expect(within(tiles()).queryByRole('button', { name: 'Thử lại' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Không có việc cần chú ý')).toBeInTheDocument();
  });

  it('"Cần chú ý" có nút làm luôn: "Duyệt" mở phiếu ở Kỳ tháng, "Mở phiếu" mở người đã nghỉ ở Giao hàng', async () => {
    mockViewport(1280);
    stubToday();
    renderApp(makeMe('admin'), '/admin/today');
    const list = await screen.findByRole('list', { name: 'Cần chú ý' });
    await within(list).findByText('Phạm Quốc Việt');
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Hoàng Minh');
    expect(within(rows[0]).getByRole('link', { name: 'Duyệt' })).toHaveAttribute('href', '/admin/month?ym=2026-10&chip=pending&request=r-hm');
    expect(within(rows[1]).getByRole('link', { name: 'Mở phiếu' })).toHaveAttribute('href', '/admin/delivery?tab=left&person=u-v');
  });

  it('bấm ô "Giao được ngay" tới Giao hàng với ?tab=ready', async () => {
    mockViewport(390);
    stubToday();
    renderApp(makeMe('admin'), '/admin/today');
    await userEvent.click(await within(tiles()).findByRole('link', { name: /Giao được ngay\s*2/ }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/delivery'));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?tab=ready');
  });
});
