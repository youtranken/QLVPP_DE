import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { PAPER, PEN, PENCIL } from './catalog-fixtures';
import { inRow, openCatalog, patchCalls, validationError } from './catalog-fixtures-api';

const ITEMS = [PAPER, PEN, PENCIL];
const bulkBar = () => within(screen.getByRole('toolbar', { name: 'Hành động trên các dòng đã chọn' }));
const pick = (name: string) => userEvent.click(inRow(name).getByRole('checkbox', { name: 'Chọn dòng' }));

async function pickPens() {
  await pick('Bút bi xanh');
  await pick('Bút chì 2B');
}

async function openMaxDialog() {
  await pickPens();
  await userEvent.click(bulkBar().getByRole('button', { name: 'Đổi tối đa/tháng' }));
  return screen.findByRole('dialog', { name: 'Đổi tối đa/tháng của 2 món' });
}

async function submitMax(value: string) {
  const dialog = await openMaxDialog();
  const field = within(dialog).getByLabelText(/^Tối đa mỗi tháng/);
  await userEvent.clear(field);
  await userEvent.type(field, value);
  await userEvent.click(within(dialog).getByRole('button', { name: 'Đổi tối đa/tháng' }));
  return { dialog, field };
}

afterEach(() => vi.unstubAllGlobals());

describe('Danh mục — hàng loạt', () => {
  it('chọn 2 món → thanh "2 món đã chọn" thay thanh công cụ; "Bỏ chọn" ẩn thanh', async () => {
    await openCatalog({ items: ITEMS });
    await pickPens();
    expect(bulkBar().getByText('2 món đã chọn')).toBeInTheDocument();
    expect(screen.queryByRole('searchbox')).toBeNull();
    await userEvent.click(bulkBar().getByRole('button', { name: 'Bỏ chọn' }));
    expect(screen.queryByRole('toolbar', { name: 'Hành động trên các dòng đã chọn' })).toBeNull();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('"Chọn cả nhóm Bút & viết" chọn 2 món của nhóm', async () => {
    await openCatalog({ items: ITEMS });
    await userEvent.click(screen.getByRole('checkbox', { name: /^Chọn cả nhóm Bút & viết/ }));
    expect(bulkBar().getByText('2 món đã chọn')).toBeInTheDocument();
  });

  it.each(['1', '999'])('đổi tối đa %s cho 2 món → 2 PATCH tuần tự, bảng cập nhật, toast, bỏ chọn', async (v) => {
    let inFlight = 0;
    let overlapped = false;
    const f = await openCatalog({
      items: ITEMS,
      patch: async () => {
        inFlight += 1;
        if (inFlight > 1) overlapped = true;
        await new Promise((r) => setTimeout(r, 5));
        inFlight -= 1;
        return jsonResponse(200, {});
      },
    });
    const { dialog } = await submitMax(v);
    expect(await screen.findByText('Đã đổi tối đa/tháng của 2 món')).toBeInTheDocument();
    expect(dialog).not.toBeInTheDocument();
    expect(overlapped).toBe(false);
    expect(patchCalls(f)).toEqual([
      { id: 'i-pen', body: { max_qty: Number(v) } },
      { id: 'i-pencil', body: { max_qty: Number(v) } },
    ]);
    expect(await inRow('Bút chì 2B').findByRole('button', { name: `Sửa tối đa/tháng của Bút chì 2B, đang là ${v}` })).toBeInTheDocument();
    expect(screen.queryByRole('toolbar', { name: 'Hành động trên các dòng đã chọn' })).toBeNull();
  });

  it.each(['0', '1000'])('ô tối đa %s → "Tối đa từ 1 đến 999." tại ô, không PATCH', async (v) => {
    const f = await openCatalog({ items: ITEMS });
    const { field } = await submitMax(v);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Tối đa từ 1 đến 999.');
    expect(patchCalls(f)).toEqual([]);
  });

  it('1 món lỗi → món đó còn chọn, câu lỗi ở hàng, toast warn "Đã đổi 1/2 món — xem dòng lỗi."', async () => {
    const f = await openCatalog({
      items: ITEMS,
      patch: (id) => (id === 'i-pencil' ? jsonResponse(404, { code: 'ITEM_NOT_FOUND', message: 'x' }) : jsonResponse(200, {})),
    });
    await submitMax('5');
    expect(await screen.findByText('Đã đổi 1/2 món — xem dòng lỗi.')).toBeInTheDocument();
    expect(patchCalls(f)).toHaveLength(2);
    expect(inRow('Bút chì 2B').getByText('Món này không còn — tải lại trang.')).toBeInTheDocument();
    expect(inRow('Bút chì 2B').getByRole('checkbox', { name: 'Chọn dòng' })).toBeChecked();
    expect(inRow('Bút bi xanh').getByRole('checkbox', { name: 'Chọn dòng' })).not.toBeChecked();
    expect(bulkBar().getByText('1 món đã chọn')).toBeInTheDocument();
  });

  it('1 món lỗi VALIDATION max_qty → câu "Tối đa từ 1 đến 999." ở hàng đó, món đó còn chọn', async () => {
    await openCatalog({ items: ITEMS, patch: (id) => (id === 'i-pencil' ? validationError('max_qty') : jsonResponse(200, {})) });
    await submitMax('5');
    expect(await screen.findByText('Đã đổi 1/2 món — xem dòng lỗi.')).toBeInTheDocument();
    expect(inRow('Bút chì 2B').getByText('Tối đa từ 1 đến 999.')).toBeInTheDocument();
    expect(inRow('Bút chì 2B').getByRole('checkbox', { name: 'Chọn dòng' })).toBeChecked();
  });

  it('đổi lọc làm 1 món đã chọn bị ẩn → bỏ chọn món đó, "Ngừng" chỉ PATCH món còn thấy', async () => {
    const f = await openCatalog({ items: ITEMS.map((i) => (i.id === 'i-pencil' ? { ...i, image_file_id: null, missing_image: true } : i)) });
    await pickPens();
    expect(bulkBar().getByText('2 món đã chọn')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Chưa có ảnh/ }));
    expect(bulkBar().getByText('1 món đã chọn')).toBeInTheDocument();
    await userEvent.click(bulkBar().getByRole('button', { name: 'Ngừng' }));
    expect(await screen.findByText('Đã ngừng 1 món')).toBeInTheDocument();
    expect(patchCalls(f)).toEqual([{ id: 'i-pencil', body: { active: false } }]);
  });

  it('"Chuyển nhóm" sang Giấy & sổ → PATCH {category_id} từng món, toast', async () => {
    const f = await openCatalog({ items: ITEMS });
    await pickPens();
    await userEvent.click(bulkBar().getByRole('button', { name: 'Chuyển nhóm' }));
    const dialog = await screen.findByRole('dialog', { name: 'Chuyển 2 món sang nhóm khác' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Chuyển nhóm' }));
    expect(within(dialog).getByText('Chọn nhóm đích.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('radio', { name: 'Nhóm cũ' })).toBeNull();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Giấy & sổ' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Chuyển nhóm' }));
    expect(await screen.findByText('Đã chuyển 2 món sang Giấy & sổ')).toBeInTheDocument();
    expect(patchCalls(f).map((c) => c.body)).toEqual([{ category_id: 'c-paper' }, { category_id: 'c-paper' }]);
  });

  it('"Ngừng" khi không món nào chờ ADM giao → không hỏi, PATCH {active:false} từng món, toast', async () => {
    const f = await openCatalog({ items: ITEMS });
    await pickPens();
    await userEvent.click(bulkBar().getByRole('button', { name: 'Ngừng' }));
    expect(await screen.findByText('Đã ngừng 2 món')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Ngừng 2 món?' })).toBeNull();
    expect(patchCalls(f).map((c) => c.body)).toEqual([{ active: false }, { active: false }]);
    expect(screen.queryByText('Bút bi xanh')).toBeNull();
  });

  it('"Ngừng" có Bút bi xanh chờ ADM giao 3 → hỏi "Ngừng 2 món?" kèm khối cam ghi tên món; Quay lại → không PATCH', async () => {
    const f = await openCatalog({ items: ITEMS, pending: { 'i-pen': { remaining: 3, unit: 'cay', snapshot_at: '2026-11-03T02:15:00.000Z' } } });
    await pickPens();
    await userEvent.click(bulkBar().getByRole('button', { name: 'Ngừng' }));
    const dialog = await screen.findByRole('dialog', { name: 'Ngừng 2 món?' });
    expect(within(dialog).getByRole('note')).toHaveTextContent(/Bút bi xanh: Món này đang chờ ADM giao 3/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));
    expect(patchCalls(f)).toEqual([]);
    await userEvent.click(bulkBar().getByRole('button', { name: 'Ngừng' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Ngừng 2 món?' })).getByRole('button', { name: 'Ngừng' }));
    expect(await screen.findByText('Đã ngừng 2 món')).toBeInTheDocument();
  });
});
