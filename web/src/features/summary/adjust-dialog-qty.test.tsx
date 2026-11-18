import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent, within } from '@/test/test-utils';
import { lineView } from '@/test/fixtures-request';
import { adminRequest } from './adjust-fixtures';
import { renderAdjust, stubAdjust } from './adjust-dialog-fixtures';

afterEach(() => vi.unstubAllGlobals());

const facts = (name: string, unit: string) => ({ name, name_en: null, unit, pack_note: null, image_file_id: null, active: true });

// Băng keo 3 (chưa giao), bút 10 đã giao 4, giấy than chờ duyệt (không chọn được)
const REQ = adminRequest({
  period_ym: '2026-12',
  lines: [
    lineView({ id: 'l-tape', item_id: 'i-tape', item: facts('Băng keo', 'cuon'), qty: 3 }),
    lineView({ id: 'l-pen', item_id: 'i-pen', item: facts('Bút bi xanh', 'cay'), qty: 10, delivered_qty: 4 }),
    lineView({ id: 'l-wait', custom_name: 'Giấy than', custom_unit: 'cai', qty: 1, review_status: 'pending' }),
  ],
});

const all = (d: HTMLElement) => within(d).getByRole('checkbox', { name: 'Chọn tất cả' });
const tick = (d: HTMLElement, name: string) => userEvent.click(within(d).getByRole('checkbox', { name: `Chọn ${name}` }));
const qty = (d: HTMLElement, name: string) => within(d).getByRole('spinbutton', { name: `Giảm còn: ${name}` });

describe('AdjustDialog — Chọn tất cả, nút − / +, câu lỗi số lượng (A6)', () => {
  it('"Chọn tất cả" đủ 3 trạng thái: không → một phần (indeterminate) → tất cả dòng chọn được; bỏ thì bỏ hết', async () => {
    stubAdjust({ views: [REQ] });
    const { dialog } = await renderAdjust();
    const box = all(dialog) as HTMLInputElement;
    expect(box).not.toBeChecked();
    expect(box.indeterminate).toBe(false);
    await tick(dialog, 'Băng keo');
    expect(box.indeterminate).toBe(true);
    await userEvent.click(box);
    expect(box).toBeChecked();
    expect(box.indeterminate).toBe(false);
    expect(within(dialog).getByRole('checkbox', { name: 'Chọn Bút bi xanh' })).toBeChecked();
    await userEvent.click(box);
    expect(within(dialog).getByRole('checkbox', { name: 'Chọn Băng keo' })).not.toBeChecked();
    expect(within(dialog).getByRole('checkbox', { name: 'Chọn Bút bi xanh' })).not.toBeChecked();
  });

  it('nút −/+ có nhãn theo món; Băng keo 3: − vô hiệu ở 1, + vô hiệu ở 2 (max = đã đặt − 1)', async () => {
    stubAdjust({ views: [REQ] });
    const { dialog } = await renderAdjust();
    await tick(dialog, 'Băng keo');
    const minus = within(dialog).getByRole('button', { name: 'Bớt Băng keo' });
    const plus = within(dialog).getByRole('button', { name: 'Thêm Băng keo' });
    expect(qty(dialog, 'Băng keo')).toHaveValue(2);
    expect(plus).toBeDisabled();
    await userEvent.click(minus);
    expect(qty(dialog, 'Băng keo')).toHaveValue(1);
    expect(minus).toBeDisabled();
    expect(plus).toBeEnabled();
  });

  it('đã đặt 3: gõ 2 (max) được; gõ 3 (max + 1) → "Giảm còn tối đa 2 (đã đặt 3)"; gõ 1 được, 0 → "Nhập ít nhất 1"; gõ 1.5 → "Nhập số nguyên"', async () => {
    stubAdjust({ views: [REQ] });
    const { dialog } = await renderAdjust();
    await tick(dialog, 'Băng keo');
    const box = qty(dialog, 'Băng keo');
    await userEvent.clear(box);
    await userEvent.type(box, '3');
    expect(box).toHaveAccessibleDescription('Giảm còn tối đa 2 (đã đặt 3)');
    await userEvent.clear(box);
    await userEvent.type(box, '0');
    expect(box).toHaveAccessibleDescription('Nhập ít nhất 1');
    await userEvent.clear(box);
    await userEvent.type(box, '1.5');
    expect(box).toHaveAccessibleDescription('Nhập số nguyên');
    await userEvent.clear(box);
    await userEvent.type(box, '1');
    expect(box).not.toHaveAttribute('aria-invalid');
    await userEvent.clear(box);
    await userEvent.type(box, '2');
    expect(box).not.toHaveAttribute('aria-invalid');
  });

  it('dòng đã giao 4/10: gõ 3 → "Nhập ít nhất 4"', async () => {
    stubAdjust({ views: [REQ] });
    const { dialog } = await renderAdjust();
    await tick(dialog, 'Bút bi xanh');
    const box = qty(dialog, 'Bút bi xanh');
    await userEvent.clear(box);
    await userEvent.type(box, '3');
    expect(box).toHaveAccessibleDescription('Nhập ít nhất 4');
  });
});
