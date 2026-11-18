import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { stubShellApi } from '@/test/admin-shell-stub';
import type { DeliveryPerson } from './delivery-people.api';
import { PEOPLE, person, pLine } from './people-fixtures';

function open(people: DeliveryPerson[]) {
  stubShellApi({
    '/api/admin/periods/2026-10/summary': () => jsonResponse(200, { lines_pending_delivery: 0, deadline: '2026-10-10T17:00:00.000Z' }),
    '/api/admin/periods/2026-10/delivery-people': () => jsonResponse(200, { ym: '2026-10', people }),
  });
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/delivery');
}
const card = (name: string) => screen.getByText(name, { selector: '.pt-person b' }).closest('tr') as HTMLElement;

afterEach(() => vi.unstubAllGlobals());

describe('DeliveryPeoplePage — bỏ dòng "người có cả hai" (AD-27)', () => {
  it('B vừa chưa nhận vừa còn nợ → không có câu "1 người có cả hai"', async () => {
    open(PEOPLE);
    await screen.findByText('Lê Thị Bình', { selector: '.pt-person b' });
    expect(screen.queryByText(/người có cả hai/)).toBeNull();
  });
});

describe('DeliveryPeoplePage — Tiến độ giao và Còn nợ (G4, đếm đơn vị)', () => {
  it('giao 4/9 → "4/9"; chưa giao → "0/3"; chỉ còn nợ T9 → "0/2" và "1 món · T9"; xong (hủy 1) → "2/2"', async () => {
    open([
      person({ user_sub: 'p1', full_name: 'Người Một', lines: [pLine({ line_id: 'a', qty: 9, delivered_qty: 4, remaining_qty: 5 })] }),
      person({ user_sub: 'p2', full_name: 'Người Hai', lines: [pLine({ line_id: 'b', qty: 3, delivered_qty: 0, remaining_qty: 3 })] }),
      person({ user_sub: 'p3', full_name: 'Người Ba', status: 'debt', lines: [pLine({ line_id: 'c', qty: 2, delivered_qty: 0, remaining_qty: 2, is_debt: true, period_ym: '2026-09' })] }),
      person({ user_sub: 'p4', full_name: 'Người Bốn', status: 'done', lines: [pLine({ line_id: 'd', qty: 3, delivered_qty: 2, cancelled_qty: 1, remaining_qty: 0 })] }),
    ]);
    await screen.findByText('Người Một', { selector: '.pt-person b' });
    expect(within(card('Người Một')).getByText('4/9')).toBeInTheDocument();
    expect(within(card('Người Hai')).getByText('0/3')).toBeInTheDocument();
    expect(within(card('Người Ba')).getByText('0/2')).toBeInTheDocument();
    expect(within(card('Người Ba')).getByText('1 món · T9')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /^Đã nhận đủ/ }));
    expect(within(card('Người Bốn')).getByText('2/2')).toBeInTheDocument();
  });
});
