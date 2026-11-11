import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, within } from '@/test/test-utils';
import { plan, planRow } from './arrivals-fixtures';
import { box, groupBtn, open, pickBox, pickedBtn, stub, type } from './arrivals-test-fixtures';

afterEach(() => vi.unstubAllGlobals());

// Nhãn nút nhận theo nhóm: "Nhận đủ hàng" khi nhận đủ được, "Nhận hàng" khi gõ thiếu hoặc có món NCC hết hàng
describe('Nhận hàng — nhãn "Nhận đủ hàng" / "Nhận hàng"', () => {
  const KEP = [
    planRow({ item_id: 'k1', name: 'Kẹp 1', category_id: 'c-kep', ordered: 3, remaining: 3 }),
    planRow({ item_id: 'k2', name: 'Kẹp 2', category_id: 'c-kep', ordered: 4, remaining: 4 }),
  ];
  const BUT = planRow({ item_id: 'b1', name: 'Bút 1', category_id: 'c-but', ordered: 6, remaining: 6, stock_qty: 1 });

  it('mọi ô điền sẵn đủ → "Nhận đủ hàng" (aria-label kèm tên nhóm); gõ thiếu một ô → "Nhận hàng"; gõ lại đủ → về "Nhận đủ hàng"', async () => {
    stub({ plan: plan([BUT, ...KEP]) });
    await open();
    await screen.findByDisplayValue('6');
    expect(groupBtn('Kẹp & dán')).toHaveTextContent('Nhận đủ hàng');
    expect(groupBtn('Kẹp & dán')).toHaveAccessibleName('Nhận đủ hàng: Kẹp & dán');
    await type(box('Kẹp 2'), '1');
    expect(groupBtn('Kẹp & dán')).toHaveTextContent(/^Nhận hàng$/);
    expect(groupBtn('Kẹp & dán')).toHaveAccessibleName('Nhận hàng: Kẹp & dán');
    expect(groupBtn('Bút')).toHaveAccessibleName('Nhận đủ hàng: Bút');
    await type(box('Kẹp 2'), '4');
    expect(groupBtn('Kẹp & dán')).toHaveAccessibleName('Nhận đủ hàng: Kẹp & dán');
  });

  it('nhóm có món NCC hết hàng → "Nhận hàng"', async () => {
    stub({ plan: plan([BUT, ...KEP, planRow({ item_id: 'k3', name: 'Kẹp 3', category_id: 'c-kep', adm_out: true })]) });
    await open();
    await screen.findByDisplayValue('6');
    expect(groupBtn('Kẹp & dán')).toHaveAccessibleName('Nhận hàng: Kẹp & dán');
  });

  it('nút trên thanh theo các nhóm đã tick: "Nhận đủ hàng (1 nhóm)" → gõ thiếu trong nhóm đã tick → "Nhận hàng (1 nhóm)"', async () => {
    stub({ plan: plan([BUT, ...KEP]) });
    await open();
    await screen.findByDisplayValue('6');
    await userEvent.click(pickBox('Kẹp & dán'));
    expect(pickedBtn()).toHaveAccessibleName('Nhận đủ hàng (1 nhóm)');
    await type(box('Bút 1'), '2');
    expect(pickedBtn()).toHaveAccessibleName('Nhận đủ hàng (1 nhóm)');
    await type(box('Kẹp 1'), '2');
    expect(pickedBtn()).toHaveAccessibleName('Nhận hàng (1 nhóm)');
  });

  it('nhập dư (đề nghị 8, gõ 10) → "Dư 2", không "Thiếu 8"; nhóm vẫn "Nhận đủ hàng"', async () => {
    stub({ plan: plan([planRow({ item_id: 'k1', name: 'Kẹp 1', category_id: 'c-kep', ordered: 8, remaining: 8 })]) });
    await open();
    await screen.findByDisplayValue('8');
    await type(box('Kẹp 1'), '10');
    const row = within(screen.getByRole('row', { name: /Kẹp 1/ }));
    expect(row.getByText('Dư 2')).toHaveClass('tag');
    expect(row.queryByText(/Thiếu/)).toBeNull();
    expect(groupBtn('Kẹp & dán')).toHaveAccessibleName('Nhận đủ hàng: Kẹp & dán');
  });

  it('không còn ô "+ Thêm món vào đợt nhận này"; dòng đếm "Đang hiện x/y món" ở cuối hàng tìm', async () => {
    stub();
    await open();
    await screen.findByDisplayValue('6');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByText(/Thêm món vào đợt nhận này/)).toBeNull();
    const search = screen.getByRole('searchbox', { name: 'Tìm món (không cần dấu)' });
    expect(screen.getByText(/^Đang hiện \d+\/\d+ món$/).closest('.ar-bar__row')).toBe(search.closest('.ar-bar__row'));
  });
});
