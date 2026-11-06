import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { OLD, PAPER, PEN } from './catalog-fixtures';
import { inRow, locationSearch, openCatalog, patchCalls, validationError } from './catalog-fixtures-api';

const ITEMS = [PAPER, PEN, OLD];
const maxCell = () => screen.getByRole('button', { name: 'Sửa tối đa/tháng của Bút bi xanh, đang là 10' });

async function editMax(value: string, key = '{Enter}') {
  await userEvent.click(maxCell());
  const input = screen.getByRole('spinbutton', { name: 'Sửa tối đa/tháng của Bút bi xanh, đang là 10' });
  await userEvent.clear(input);
  await userEvent.type(input, `${value}${key}`);
  return input;
}

const rejectOutOfRange = (_id: string, body: { max_qty?: number }) =>
  body.max_qty !== undefined && (body.max_qty < 1 || body.max_qty > 999) ? validationError('max_qty') : jsonResponse(200, {});

afterEach(() => vi.unstubAllGlobals());

describe('Danh mục — sửa tối đa/tháng tại chỗ (biên 1/999 vs 0/1000)', () => {
  it.each([1, 999])('Enter với %i → PATCH {max_qty} + toast "Đã lưu tối đa {n} cho Bút bi xanh"', async (n) => {
    const f = await openCatalog({ items: ITEMS, patch: rejectOutOfRange });
    await editMax(String(n));
    expect(await screen.findByText(`Đã lưu tối đa ${n} cho Bút bi xanh`)).toBeInTheDocument();
    expect(patchCalls(f)).toEqual([{ id: 'i-pen', body: { max_qty: n } }]);
    expect(await screen.findByRole('button', { name: `Sửa tối đa/tháng của Bút bi xanh, đang là ${n}` })).toBeInTheDocument();
  });

  it.each([0, 1000])('Enter với %i → server VALIDATION max_qty → "Tối đa từ 1 đến 999." gắn vào ô trong hàng', async (n) => {
    const f = await openCatalog({ items: ITEMS, patch: rejectOutOfRange });
    const input = await editMax(String(n));
    const error = await inRow('Bút bi xanh').findByText('Tối đa từ 1 đến 999.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe(error.closest('[id]')!.id);
    expect(patchCalls(f)).toEqual([{ id: 'i-pen', body: { max_qty: n } }]);
    expect(screen.queryByText(/^Đã lưu tối đa/)).toBeNull();
  });

  it('Esc → trả giá trị cũ, không PATCH', async () => {
    const f = await openCatalog({ items: ITEMS });
    await editMax('5', '{Escape}');
    expect(maxCell()).toHaveTextContent('10');
    expect(patchCalls(f)).toEqual([]);
  });

  it('rời ô (blur) không lưu', async () => {
    const f = await openCatalog({ items: ITEMS });
    await editMax('5', '');
    await userEvent.click(screen.getByRole('heading', { level: 1 }));
    expect(patchCalls(f)).toEqual([]);
  });

  it('trang vẽ lại khi đang sửa (đổi chip nhóm vẫn thấy món) → ô vẫn mở, giữ số đang gõ', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(maxCell());
    const label = 'Sửa tối đa/tháng của Bút bi xanh, đang là 10';
    await userEvent.clear(screen.getByRole('spinbutton', { name: label }));
    await userEvent.type(screen.getByRole('spinbutton', { name: label }), '0');
    await userEvent.click(within(screen.getByRole('group', { name: 'Lọc theo nhóm' })).getByRole('button', { name: /^Bút & viết/ }));
    expect(screen.getByRole('spinbutton', { name: label })).toHaveValue(0);
  });

  it('bấm ô số không mở ngăn kéo sửa món', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(maxCell());
    expect(locationSearch()).toBe('');
  });
});

describe('Danh mục — công tắc Dùng', () => {
  it('"Ngừng Bút bi xanh" hỏi "Ngừng Bút bi xanh?" rồi PATCH {active:false}, toast; Hủy thì không gửi', async () => {
    const f = await openCatalog({ items: ITEMS });
    const sw = inRow('Bút bi xanh').getByRole('switch', { name: 'Ngừng Bút bi xanh' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    let dialog = await screen.findByRole('dialog', { name: 'Ngừng Bút bi xanh?' });
    expect(dialog).toHaveTextContent('Nhân viên không thấy món này từ bây giờ; phiếu đã lưu giữ nguyên.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hủy' }));
    expect(patchCalls(f)).toEqual([]);

    await userEvent.click(sw);
    dialog = await screen.findByRole('dialog', { name: 'Ngừng Bút bi xanh?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ngừng' }));
    expect(await screen.findByText('Đã ngừng Bút bi xanh')).toBeInTheDocument();
    expect(patchCalls(f)).toEqual([{ id: 'i-pen', body: { active: false } }]);
  });

  it('W24: Bút bi xanh đang chờ ADM giao 3 cây → hộp ngừng có khối cam, nút "Ngừng" vẫn bấm được; chờ 0 → không khối', async () => {
    const f = await openCatalog({ items: ITEMS, pending: { 'i-pen': { remaining: 3, unit: 'cay', snapshot_at: '2026-11-03T02:15:00.000Z' }, 'i-paper': { remaining: 0 } } });
    await userEvent.click(inRow('Bút bi xanh').getByRole('switch', { name: 'Ngừng Bút bi xanh' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Ngừng Bút bi xanh?' }));
    expect(dialog.getByRole('note')).toHaveTextContent(/^Món này đang chờ ADM giao 3 cây \(bản in \d\d:\d\d 03\/11\) — ngừng thì vẫn nhập được hàng đã đặt\.$/);
    await userEvent.click(dialog.getByRole('button', { name: 'Ngừng' }));
    await vi.waitFor(() => expect(patchCalls(f)).toEqual([{ id: 'i-pen', body: { active: false } }]));
    await userEvent.click(inRow('Giấy A4').getByRole('switch', { name: 'Ngừng Giấy A4' }));
    expect(within(await screen.findByRole('dialog', { name: 'Ngừng Giấy A4?' })).queryByRole('note')).toBeNull();
  });

  it('"Mở lại Bút xóa cũ" PATCH {active:true} không cần hỏi', async () => {
    const f = await openCatalog({ items: ITEMS }, '/admin/catalog?tab=inactive');
    await userEvent.click(inRow('Bút xóa cũ').getByRole('switch', { name: 'Mở lại Bút xóa cũ' }));
    expect(await screen.findByText('Đã mở lại Bút xóa cũ')).toBeInTheDocument();
    expect(patchCalls(f)).toEqual([{ id: 'i-old', body: { active: true } }]);
  });

  it('ngừng lỗi → câu lỗi ở hàng, không toast', async () => {
    await openCatalog({ items: ITEMS, patch: () => jsonResponse(404, { code: 'ITEM_NOT_FOUND', message: 'x' }) });
    await userEvent.click(inRow('Bút bi xanh').getByRole('switch', { name: 'Ngừng Bút bi xanh' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Ngừng' }));
    expect(await inRow('Bút bi xanh').findByText('Món này không còn — tải lại trang.')).toBeInTheDocument();
    expect(screen.queryByText('Đã ngừng Bút bi xanh')).toBeNull();
  });

  it('icon "Sửa Bút bi xanh" mở ngăn kéo sửa món', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(screen.getByRole('button', { name: 'Sửa Bút bi xanh' }));
    expect(await screen.findByRole('dialog', { name: 'Sửa món Bút bi xanh' })).toBeInTheDocument();
  });
});
