import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { plan, planRow } from './arrivals-fixtures';
import { PLAN, open, pickBox, pickedBtn, stub } from './arrivals-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

const FULL = planRow({ item_id: 'i-c', name: 'Bút chì', category_id: 'c-but', received: 10, remaining: 0 });

describe('Nhận hàng theo bản Sau (AD-23…26)', () => {
  it('AD-23 đầu nhóm chỉ có ô tick, không nút "Nhận đủ hàng"; tick nhóm → nút trên thanh "Nhận đủ hàng (1 nhóm)"', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    const group = screen.getByRole('rowgroup', { name: 'Bút' });
    const head = group.querySelector('tr')!;
    expect(within(head).getByRole('checkbox', { name: 'Chọn nhóm Bút' })).toBeInTheDocument();
    expect(within(head).queryAllByRole('button')).toHaveLength(0);
    await userEvent.click(pickBox('Bút'));
    expect(pickedBtn()).toHaveAccessibleName('Nhận đủ hàng (1 nhóm)');
  });

  it('AD-24 dòng đã nhận đủ: nhãn Tình trạng "Đủ" (không trùng chữ "Nhận đủ hàng" của nút)', async () => {
    stub({ plan: plan([...PLAN.rows, FULL]) });
    await open();
    const row = within(await screen.findByRole('row', { name: /Bút chì/ }));
    expect(row.getByText('Đủ', { selector: '.tag' })).toHaveClass('tag--ok');
    expect(row.queryByText('Nhận đủ hàng')).toBeNull();
  });

  it('AD-25 không còn cột "Còn thiếu": Món · Tủ · Đề nghị mua · Nhận đợt này · Tình trạng · Sau nhập kho', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Món', 'Tủ', 'Đề nghị mua', 'Nhận đợt này', 'Tình trạng', 'Sau nhập kho']);
  });

  it('AD-26 không lọc → không "Đang hiện"; bật "Chỉ món chưa về đủ" bớt dòng (1/2) → "Đang hiện 1/2 món"', async () => {
    stub({ plan: plan([PLAN.rows[0]!, { ...FULL, category_id: 'c-kep' }]) });
    await open();
    await screen.findByDisplayValue('6');
    expect(screen.queryByText(/^Đang hiện/)).toBeNull();
    await userEvent.click(screen.getByRole('switch', { name: /^Chỉ món chưa về đủ/ }));
    expect(await screen.findByText('Đang hiện 1/2 món')).toBeInTheDocument();
  });

  it('AD-26 đang lọc mà không bớt dòng (mọi món đều chưa về đủ, 2/2) → không "Đang hiện"', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(screen.getByRole('switch', { name: /^Chỉ món chưa về đủ/ }));
    await screen.findByDisplayValue('6');
    expect(screen.queryByText(/^Đang hiện/)).toBeNull();
  });
});
