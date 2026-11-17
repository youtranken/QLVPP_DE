import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import type { DeliveryPerson } from './delivery-people.api';
import type { Shortage } from './deliver-plan';
import { PeopleTable } from './people-table';
import { person, pLine } from './people-fixtures';

afterEach(() => vi.unstubAllGlobals());

const P = person({
  user_sub: 'u-p',
  full_name: 'Phan Thị Hoa',
  department: 'Kết cấu',
  lines: [
    pLine({ line_id: 'c1', qty: 30, delivered_qty: 15, remaining_qty: 15, item_id: 'i-pen', name: 'Bút bi xanh' }),
    pLine({ line_id: 'd1', is_debt: true, period_ym: '2026-11', qty: 3, delivered_qty: 2, remaining_qty: 1, item_id: 'i-a4', name: 'Giấy A4' }),
    pLine({ line_id: 'd2', is_debt: true, period_ym: '2026-11', qty: 2, delivered_qty: 1, remaining_qty: 1, item_id: 'i-note', name: 'Giấy note' }),
  ],
});

function show(rows: DeliveryPerson[], shortages: Map<string, Shortage> = new Map()) {
  const props = { onToggle: vi.fn(), onToggleAll: vi.fn(), onView: vi.fn(), onDeliver: vi.fn(), onHistory: vi.fn() };
  renderWithI18n(<PeopleTable rows={rows} shortages={shortages} selected={new Set()} selectable={() => true} canDeliver={() => true} {...props} />);
  return props;
}
const rowOf = (name: string) => screen.getByText(name).closest('tr')!;

describe('PeopleTable G4 — cùng kiểu bảng Kỳ tháng', () => {
  it('cột Người · Tiến độ giao · Tủ · Còn nợ; không còn Phòng, Tháng, Số món, Đơn vị, Trạng thái', () => {
    show([P]);
    const heads = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(heads).toEqual(expect.arrayContaining(['Người', 'Tiến độ giao', 'Tủ', 'Còn nợ']));
    for (const gone of ['Phòng', 'Tháng', 'Số món', 'Đơn vị', 'Trạng thái']) expect(heads).not.toContain(gone);
    expect(within(rowOf('Phan Thị Hoa')).getByText('Kết cấu')).toBeInTheDocument();
  });

  it('Tiến độ giao "18/35" + thanh 51% (giao 15 + 2 + 1 trên 30 + 3 + 2)', () => {
    show([P]);
    const bar = within(rowOf('Phan Thị Hoa')).getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '18');
    expect(bar).toHaveAttribute('aria-valuemax', '35');
    expect((bar.firstElementChild as HTMLElement).style.width).toMatch(/^51\.4/);
    expect(within(rowOf('Phan Thị Hoa')).getByText('18/35')).toBeInTheDocument();
  });

  it('Còn nợ "2 món · T11"; không nợ → "—"', () => {
    show([P, person({ user_sub: 'u-q', full_name: 'Không Nợ' })]);
    expect(within(rowOf('Phan Thị Hoa')).getByText('2 món · T11')).toBeInTheDocument();
    expect(within(rowOf('Không Nợ')).getAllByRole('cell').some((c) => /^—/.test(c.textContent ?? ''))).toBe(true);
  });

  it('Tủ: món đang chờ của người này bị thiếu → "Thiếu: Bút bi xanh"; không thiếu → "Đủ"', () => {
    show([P, person({ user_sub: 'u-q', full_name: 'Không Nợ', lines: [pLine({ item_id: 'i-clip', name: 'Kẹp' })] })], new Map([['i-pen', { s: 10, k: 2, q: 20, short: 10 }]]));
    expect(within(rowOf('Phan Thị Hoa')).getByText('Thiếu: Bút bi xanh')).toBeInTheDocument();
    expect(within(rowOf('Không Nợ')).getByText('Đủ')).toBeInTheDocument();
  });

  it('⋯ có "Xem chi tiết" và "Lịch sử đặt hàng"; nút Giao… vẫn ở hàng', async () => {
    const props = show([P]);
    expect(within(rowOf('Phan Thị Hoa')).getByRole('button', { name: /^Giao…, Phan Thị Hoa/ })).toBeInTheDocument();
    await userEvent.click(within(rowOf('Phan Thị Hoa')).getByRole('button', { name: 'Thao tác cho Phan Thị Hoa' }));
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Xem chi tiết', 'Lịch sử đặt hàng']);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Lịch sử đặt hàng' }));
    expect(props.onHistory).toHaveBeenCalledWith('u-p');
  });
});
