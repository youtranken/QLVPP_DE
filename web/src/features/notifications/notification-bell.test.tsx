import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import i18n from '@/lib/i18n';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { NotificationBell } from './notification-bell';
import type { NotificationView } from './notifications.api';

const note = (id: string, over: Partial<NotificationView> = {}): NotificationView => ({
  id,
  topic: 'request_delivered',
  params: { ym: '2026-11' },
  link: '/history/2026-11',
  created_at: '2026-11-12T03:00:00.000Z',
  read_at: null,
  ...over,
});

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

interface Server {
  items: NotificationView[];
  unread: number;
  posts: unknown[];
  csrf?: (string | undefined)[];
  postStatus?: number;
}

function stubServer(s: Server) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      s.posts.push(init.body ? JSON.parse(String(init.body)) : undefined);
      (s.csrf ??= []).push((init.headers as Record<string, string>)['X-CSRF-Token']);
      return Promise.resolve(jsonResponse(s.postStatus ?? 200, s.postStatus ? { code: 'CSRF_TOKEN_INVALID' } : { updated: 1 }));
    }
    const q = new URL(url, 'http://x').searchParams;
    const items = q.get('unread') === 'true' ? s.items.filter((i) => !i.read_at) : s.items;
    return Promise.resolve(jsonResponse(200, { items: items.slice(0, Number(q.get('limit') ?? 20)), next_cursor: null, unread_count: s.unread }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderBell() {
  return renderWithI18n(
    <MeContext.Provider value={makeMe('member')}>
      <MemoryRouter initialEntries={['/start']}>
        <NotificationBell />
        <Where />
      </MemoryRouter>
    </MeContext.Provider>,
  );
}

const bellButton = () => screen.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ });

beforeEach(() => {
  void i18n.changeLanguage('vi');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('NotificationBell huy hiệu', () => {
  it.each([
    [0, null],
    [1, '1'],
    [9, '9'],
    [10, '9+'],
    [250, '9+'],
  ])('%i chưa đọc → huy hiệu %s', async (unread, badge) => {
    stubServer({ items: [], unread, posts: [] });
    renderBell();
    expect(await screen.findByRole('button', { name: `Thông báo, ${unread} chưa đọc` })).toBeVisible();
    const text = bellButton().textContent ?? '';
    expect(text === '' ? null : text).toBe(badge);
  });

  it('lấy số chưa đọc bằng GET me/notifications?unread=true&limit=1', async () => {
    const fetchMock = stubServer({ items: [], unread: 2, posts: [] });
    renderBell();
    await screen.findByRole('button', { name: 'Thông báo, 2 chưa đọc' });
    expect(fetchMock.mock.calls[0][0]).toBe('/api/me/notifications?unread=true&limit=1');
  });

  it('thăm dò lại sau 60 s và khi cửa sổ lấy lại tiêu điểm', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const server: Server = { items: [], unread: 1, posts: [] };
    const fetchMock = stubServer(server);
    renderBell();
    await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' });
    const calls = () => fetchMock.mock.calls.length;
    const before = calls();
    await act(() => vi.advanceTimersByTimeAsync(59_000));
    expect(calls()).toBe(before);
    server.unread = 3;
    await act(() => vi.advanceTimersByTimeAsync(1_500));
    await screen.findByRole('button', { name: 'Thông báo, 3 chưa đọc' });
    server.unread = 4;
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange', { bubbles: true }));
    });
    await screen.findByRole('button', { name: 'Thông báo, 4 chưa đọc' });
  });
});

describe('NotificationBell bảng', () => {
  it('trống → "Chưa có thông báo", không có nút đánh dấu tất cả', async () => {
    stubServer({ items: [], unread: 0, posts: [] });
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 0 chưa đọc' }));
    expect(await screen.findByText('Chưa có thông báo')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Đánh dấu đã đọc tất cả' })).toBeNull();
  });

  it('bấm mục: POST read {ids:[id]} rồi điều hướng tới link của mục', async () => {
    const server: Server = { items: [note('a1'), note('a2', { params: { ym: '2026-10' }, read_at: '2026-11-12T04:00:00.000Z', link: '/history/2026-10' })], unread: 1, posts: [] };
    stubServer(server);
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    await userEvent.click(await screen.findByRole('button', { name: /Phiếu tháng 11 của bạn đã được giao đủ/ }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/history/2026-11'));
    expect(server.posts).toEqual([{ ids: ['a1'] }]);
    expect(server.csrf).toEqual(['csrf-1']);
    expect(screen.queryByRole('dialog', { name: 'Thông báo' })).toBeNull();
  });

  it('mục đã đọc: chỉ điều hướng, không POST', async () => {
    const server: Server = { items: [note('a2', { params: { ym: '2026-10' }, read_at: '2026-11-12T04:00:00.000Z', link: '/history/2026-10' })], unread: 0, posts: [] };
    stubServer(server);
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 0 chưa đọc' }));
    await userEvent.click(await screen.findByRole('button', { name: /giao đủ/ }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/history/2026-10'));
    expect(server.posts).toEqual([]);
  });

  it.each(['//evil.example/x', 'https://evil.example', '/\\evil.example'])('link %s: đánh dấu đã đọc nhưng không điều hướng', async (link) => {
    const server: Server = { items: [note('b1', { link })], unread: 1, posts: [] };
    stubServer(server);
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    await userEvent.click(await screen.findByRole('button', { name: /giao đủ/ }));
    await waitFor(() => expect(server.posts).toEqual([{ ids: ['b1'] }]));
    expect(screen.getByTestId('where')).toHaveTextContent('/start');
  });

  it('"Đánh dấu đã đọc tất cả" gửi POST body {} (không ids)', async () => {
    const server: Server = { items: [note('c1'), note('c2')], unread: 2, posts: [] };
    stubServer(server);
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 2 chưa đọc' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Đánh dấu đã đọc tất cả' }));
    await waitFor(() => expect(server.posts).toEqual([{}]));
    expect(server.csrf).toEqual(['csrf-1']);
  });

  it('POST read bị 403: báo lỗi trong bảng (không im lặng), bảng giữ mở, KHÔNG điều hướng (bấm lại để thử)', async () => {
    const server: Server = { items: [note('h1')], unread: 1, posts: [], postStatus: 403 };
    stubServer(server);
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    await userEvent.click(await screen.findByRole('button', { name: /giao đủ/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa đánh dấu đã đọc được — thử lại.');
    expect(screen.getByRole('dialog', { name: 'Thông báo' })).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/start');
  });

  it('"Đánh dấu đã đọc tất cả" bị 403: báo lỗi', async () => {
    stubServer({ items: [note('i1')], unread: 1, posts: [], postStatus: 403 });
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Đánh dấu đã đọc tất cả' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa đánh dấu đã đọc được');
  });

  it('Esc đóng bảng và trả focus về nút chuông', async () => {
    stubServer({ items: [note('d1')], unread: 1, posts: [] });
    renderBell();
    const button = await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' });
    await userEvent.click(button);
    expect(await screen.findByRole('dialog', { name: 'Thông báo' })).toBeVisible();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Thông báo' })).toBeNull();
    expect(button).toHaveFocus();
  });

  it('bấm ra ngoài đóng bảng', async () => {
    stubServer({ items: [note('e1')], unread: 1, posts: [] });
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    await screen.findByRole('dialog', { name: 'Thông báo' });
    await userEvent.click(screen.getByTestId('where'));
    expect(screen.queryByRole('dialog', { name: 'Thông báo' })).toBeNull();
  });

  it('mục chưa đọc đánh dấu bằng chữ cho trình đọc màn hình; mới trước theo thứ tự API', async () => {
    stubServer({ items: [note('f1', { params: { ym: '2026-11' } }), note('f2', { topic: 'low_stock', params: { name: 'Bút', name_en: 'Pen', stock_qty: 2 }, read_at: '2026-11-12T05:00:00.000Z', link: '/admin/stock?filter=low' })], unread: 1, posts: [] });
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }));
    const list = await screen.findByRole('list');
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Chưa đọc');
    expect(rows[1]).not.toHaveTextContent('Chưa đọc');
    expect(rows[1]).toHaveTextContent('Bút sắp hết kho, còn 2.');
  });

  it('tiếng Anh: nhãn nút và câu thông báo dịch theo en', async () => {
    await i18n.changeLanguage('en');
    stubServer({ items: [note('g1')], unread: 1, posts: [] });
    renderBell();
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    expect(await screen.findByText('Your November request has been fully delivered.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeVisible();
  });
});
