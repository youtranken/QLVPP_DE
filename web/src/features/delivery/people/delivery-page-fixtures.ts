import { jsonResponse, screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import type { DeliveryPerson } from './delivery-people.api';
import { PEOPLE } from './people-fixtures';

export const PEOPLE_URL = '/api/admin/periods/2026-10/delivery-people';
const SUMMARY = { lines_pending_delivery: 4, deadline: '2026-10-10T17:00:00.000Z' };

export interface Stub {
  people?: DeliveryPerson[] | (() => DeliveryPerson[]);
  deliver?: (url: string) => Response;
  locked?: boolean;
}

export function stub(s: Stub = {}) {
  const people = s.people ?? PEOPLE;
  return stubShellApi({
    '/api/admin/periods/2026-10/summary': () => jsonResponse(200, SUMMARY),
    [PEOPLE_URL]: () =>
      s.locked === false
        ? jsonResponse(409, { code: 'PERIOD_NOT_LOCKED' })
        : jsonResponse(200, { ym: '2026-10', people: typeof people === 'function' ? people() : people }),
    '/api/admin/lines/la/deliver': () => s.deliver?.('la') ?? jsonResponse(200, { request_complete: true }),
    '/api/admin/lines/lb/deliver': () => s.deliver?.('lb') ?? jsonResponse(200, { request_complete: true }),
    '/api/admin/lines/lc/deliver': () => s.deliver?.('lc') ?? jsonResponse(200, { request_complete: true }),
  });
}

export const callsTo = (f: ReturnType<typeof stub>, url: string) => f.mock.calls.filter(([u]) => u === url);
export const search = () => screen.getByTestId('location-search').textContent ?? '';
export const card = (name: string) => screen.getByText(name, { selector: '.pt-person b' }).closest('tr') as HTMLElement;
export const names = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getByRole('checkbox').getAttribute('aria-label')?.replace('Chọn ', ''));

export function open(path = '/admin/delivery', width = 1280) {
  mockViewport(width);
  renderApp(makeMe('admin'), path);
}

