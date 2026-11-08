import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import type { DeliveryPerson } from './delivery-people.api';
import { A, C, D, PEOPLE, person, pLine } from './people-fixtures';

function open(people: DeliveryPerson[]) {
  stubShellApi({
    '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 0, deadline: '2026-10-10T17:00:00.000Z' }),
    '/api/admin/periods/2026-10/delivery-people': () => jsonResponse(200, { ym: '2026-10', people }),
  });
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/delivery?tab=all');
}
const card = (name: string) => screen.getByText(name, { selector: '.pt-person b' }).closest('tr') as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe('DeliveryPeoplePage — Chưa nhận / Còn nợ chồng nhau', () => {
  it('B có cả hai → ghi chú "1 người có cả hai" dưới tab', async () => {
    open(PEOPLE);
    expect(await screen.findByText('1 người có cả hai')).toBeInTheDocument();
  });

  it('không ai có cả hai → không có ghi chú', async () => {
    open([A, C, D]);
    await screen.findByText('Nguyễn Văn An', { selector: '.pt-person b' });
    expect(screen.queryByText(/người có cả hai/)).toBeNull();
  });
});

describe('PeopleTable — số trên dòng', () => {
  it('dòng ghi "3 món" và 18 đơn vị (món chưa nhận + nợ còn giao được; nợ + kỳ này cùng bút là 1 món); người đã nhận đủ không có dòng số', async () => {
    const many = person({
      user_sub: 'u-m',
      full_name: 'Mai Nhiều Món',
      lines: [
        pLine({ line_id: 'm1', is_debt: true, period_ym: '2026-09', remaining_qty: 2 }),
        pLine({ line_id: 'm2', remaining_qty: 5 }),
        pLine({ line_id: 'm3', item_id: 'i-a4', remaining_qty: 3 }),
        pLine({ line_id: 'm4', item_id: 'i-clip', remaining_qty: 8 }),
        pLine({ line_id: 'm5', item_id: null, review_status: 'pending', remaining_qty: 2 }),
      ],
    });
    open([many, D]);
    await screen.findByText('Mai Nhiều Món', { selector: '.pt-person b' });
    const cells = within(card('Mai Nhiều Món')).getAllByRole('cell').map((c) => c.textContent);
    expect(cells).toEqual(expect.arrayContaining(['3 món', '18']));
    expect(within(card('Đỗ Mai Linh')).getAllByRole('cell').map((c) => c.textContent)).toEqual(expect.arrayContaining(['0 món', '0']));
  });
});
