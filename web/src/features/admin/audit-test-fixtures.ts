import { vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';

export const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  actor: 'u-binh',
  actorName: 'Lê Thị Bình',
  action: 'config.updated',
  objectType: 'config',
  objectId: 'admin_contact',
  detail: { before: { admin_contact: '' }, after: { admin_contact: 'chị Bình' } },
  createdAt: '2026-10-28T03:05:00.000Z',
  ...over,
});

export const BINH = { sub: 'u-binh', fullName: 'Lê Thị Bình', email: 'binh@pmh.com.vn', department: 'Adm D&E', status: 'locked' };
export const audit400 = (fields: string[]) => jsonResponse(400, { statusCode: 400, code: 'VALIDATION', message: 'x', fields });

export function stubApi() {
  const fetchMock = vi.fn((url: string) => {
    const params = new URL(url, 'http://x').searchParams;
    if (url.startsWith('/api/admin/users')) return Promise.resolve(jsonResponse(200, { items: [BINH], next_cursor: null }));
    if (params.get('cursor') === 'c2') {
      return Promise.resolve(jsonResponse(200, { items: [row('a3', { action: 'auth.login', actor: 'local:sa', actorName: null, detail: { ip: '10.0.0.5' } })], next_cursor: null }));
    }
    return Promise.resolve(jsonResponse(200, { items: [row('a1'), row('a2', { action: 'item.created' })], next_cursor: 'c2' }));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const auditUrls = (m: ReturnType<typeof stubApi>) =>
  m.mock.calls.map(([u]) => new URL(String(u), 'http://x')).filter((u) => u.pathname === '/api/admin/audit');

// Ô khoảng ngày (lịch tự dựng): mở lịch, lùi/tiến tới tháng của ngày, bấm ngày đầu rồi ngày cuối
export async function pickRange(from: string, to: string) {
  await userEvent.click(screen.getByRole('button', { name: /^Khoảng ngày/ }));
  const dialog = screen.getByRole('dialog', { name: 'Khoảng ngày' });
  for (const day of [from, to]) {
    for (let i = 0; i < 48; i++) {
      const cell = dialog.querySelector<HTMLElement>(`[data-day="${day}"]:not([data-out])`);
      if (cell) {
        await userEvent.click(cell);
        break;
      }
      const any = dialog.querySelector<HTMLElement>('[data-day]:not([data-out])')!.dataset.day!;
      await userEvent.click(within(dialog).getByRole('button', { name: any > day ? 'Tháng trước' : 'Tháng sau' }));
    }
  }
}
export const rangeBox = () => screen.getByRole('button', { name: /^Khoảng ngày/ });

export async function openAudit(path = '/admin/audit') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
  await within(await screen.findByRole('table')).findAllByText('Sửa cấu hình');
}

export const lastAudit = (m: ReturnType<typeof stubApi>) => auditUrls(m).at(-1)!.searchParams;
export const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row');
export const entryRow = (text: string) => screen.getByText(text).closest('tr')!;
