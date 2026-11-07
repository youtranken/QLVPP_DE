import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { OLD, PAPER, PEN, adminItem } from './catalog-fixtures';
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

async function confirmIn(title: string, ok: string) {
  await userEvent.click(within(await screen.findByRole('dialog', { name: title })).getByRole('button', { name: ok }));
}

describe('Sản phẩm bảng — nút Tạm ngưng / Dùng lại (Nhóm 1 · mục 7)', () => {
  const byGroup = adminItem({ id: 'i-clip', name: 'Kẹp nhóm ngừng', category_id: 'c-old', usable: false, inactive_reason: 'group' });
  const withOld = [...ITEMS, byGroup];

  it('nhóm tạm ngưng: mặc định thu gọn, tên gạch + "Tạm ngưng cả nhóm", không nút "Thêm món vào nhóm", có "Dùng lại nhóm"', async () => {
    const f = await openCatalog({ items: withOld });
    expect(screen.queryByText('Kẹp nhóm ngừng')).toBeNull();
    const head = screen.getByText('Tạm ngưng cả nhóm').closest('tr') as HTMLElement;
    expect(within(head).getByText('Nhóm cũ')).toHaveClass('ct-group__name--stopped');
    expect(within(head).queryByRole('button', { name: /^Thêm món vào nhóm/ })).toBeNull();
    await userEvent.click(within(head).getByRole('button', { name: /^Dùng lại nhóm/ }));
    await vi.waitFor(() => expect(patchCalls(f)).toEqual([{ id: 'c-old', body: { active: true } }]));
  });

  it('dòng món tạm ngưng: tên gạch + nhãn đỏ "Tạm ngưng", nút "Dùng lại"; nhóm đang dùng vẫn có nút "+"', async () => {
    await openCatalog({ items: ITEMS });
    const row = inRow('Bút xóa cũ');
    expect(row.getByText('Bút xóa cũ')).toHaveClass('ct-item__name--paused');
    expect(row.getByText('Tạm ngưng')).toHaveClass('ct-item__paused');
    expect(row.getByRole('button', { name: 'Dùng lại Bút xóa cũ' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Thêm món vào nhóm Bút & viết' })).toBeInTheDocument();
  });

  it('"Tạm ngưng Bút bi xanh" là nút trung tính btn--quiet-danger; bấm → hỏi "Tạm ngưng Bút bi xanh?" → xác nhận → PATCH {active:false} → toast thường, không "Hoàn tác"', async () => {
    const f = await openCatalog({ items: ITEMS });
    const stop = inRow('Bút bi xanh').getByRole('button', { name: 'Tạm ngưng Bút bi xanh' });
    expect(stop).toHaveClass('btn--quiet-danger');
    await userEvent.click(stop);
    await confirmIn('Tạm ngưng Bút bi xanh?', 'Tạm ngưng');
    expect(await screen.findByText('Đã tạm ngưng Bút bi xanh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hoàn tác' })).toBeNull();
    expect(patchCalls(f)).toEqual([{ id: 'i-pen', body: { active: false } }]);
  });

  it('dòng "Dùng lại Bút xóa cũ" → hỏi "Dùng lại Bút xóa cũ?" → xác nhận → PATCH {active:true} → toast "Đã dùng lại Bút xóa cũ"', async () => {
    const f = await openCatalog({ items: ITEMS });
    await userEvent.click(inRow('Bút xóa cũ').getByRole('button', { name: 'Dùng lại Bút xóa cũ' }));
    await confirmIn('Dùng lại Bút xóa cũ?', 'Dùng lại');
    expect(await screen.findByText('Đã dùng lại Bút xóa cũ')).toBeInTheDocument();
    expect(patchCalls(f)).toEqual([{ id: expect.any(String), body: { active: true } }]);
  });

  it('W24: Bút bi xanh đang chờ ADM giao 3 cây → hộp hỏi có khối cam; chờ 0 → tạm ngưng luôn', async () => {
    const f = await openCatalog({ items: ITEMS, pending: { 'i-pen': { remaining: 3, unit: 'cay', snapshot_at: '2026-11-03T02:15:00.000Z' } } });
    await userEvent.click(inRow('Bút bi xanh').getByRole('button', { name: 'Tạm ngưng Bút bi xanh' }));
    const dialog = within(await screen.findByRole('dialog', { name: 'Tạm ngưng Bút bi xanh?' }));
    expect(dialog.getByRole('note')).toHaveTextContent(/^Món này đang chờ ADM giao 3 cây/);
    await userEvent.click(dialog.getByRole('button', { name: 'Tạm ngưng' }));
    await vi.waitFor(() => expect(patchCalls(f)).toEqual([{ id: 'i-pen', body: { active: false } }]));
    await userEvent.click(inRow('Giấy A4').getByRole('button', { name: 'Tạm ngưng Giấy A4' }));
    const plain = within(await screen.findByRole('dialog', { name: 'Tạm ngưng Giấy A4?' }));
    expect(plain.queryByRole('note')).toBeNull();
    await userEvent.click(plain.getByRole('button', { name: 'Tạm ngưng' }));
    await vi.waitFor(() => expect(patchCalls(f)).toHaveLength(2));
  });

  it('món của nhóm tạm ngưng (mở nhóm): "Dùng lại" vô hiệu, gợi ý "Bật lại nhóm để đổi từng món"; bấm không gửi gì', async () => {
    const f = await openCatalog({ items: withOld });
    await userEvent.click(within(screen.getByText('Tạm ngưng cả nhóm').closest('tr') as HTMLElement).getByRole('button', { expanded: false }));
    const btn = inRow('Kẹp nhóm ngừng').getByRole('button', { name: 'Dùng lại Kẹp nhóm ngừng' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription('Bật lại nhóm để đổi từng món');
    await userEvent.click(btn);
    expect(patchCalls(f)).toEqual([]);
  });

  it('tạm ngưng lỗi → câu lỗi ở hàng, không toast', async () => {
    await openCatalog({ items: ITEMS, patch: () => jsonResponse(404, { code: 'ITEM_NOT_FOUND', message: 'x' }) });
    await userEvent.click(inRow('Bút bi xanh').getByRole('button', { name: 'Tạm ngưng Bút bi xanh' }));
    await confirmIn('Tạm ngưng Bút bi xanh?', 'Tạm ngưng');
    expect(await inRow('Bút bi xanh').findByText('Món này không còn — tải lại trang.')).toBeInTheDocument();
    expect(screen.queryByText('Đã tạm ngưng Bút bi xanh')).toBeNull();
  });

  it('icon "Sửa Bút bi xanh" mở ngăn kéo sửa món', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(screen.getByRole('button', { name: 'Sửa Bút bi xanh' }));
    expect(await screen.findByRole('dialog', { name: 'Sửa món Bút bi xanh' })).toBeInTheDocument();
  });
});
