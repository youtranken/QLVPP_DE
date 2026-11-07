import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { OLD, PAPER, PEN, PENCIL, adminItem } from './catalog-fixtures';
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
  it('chọn 2 món → thanh sáng "2 món đã chọn" cùng hàng với tab, ô tìm vẫn hiện; "Bỏ chọn" (ghost) ẩn thanh', async () => {
    await openCatalog({ items: ITEMS });
    await pickPens();
    expect(bulkBar().getByText('2 món đã chọn')).toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    const bar = screen.getByRole('toolbar', { name: 'Hành động trên các dòng đã chọn' });
    expect(bar).toHaveClass('bulk-bar--light');
    expect(bar.parentElement).toBe(screen.getByRole('group', { name: 'Trạng thái' }).parentElement);
    expect(bulkBar().getByRole('button', { name: 'Bỏ chọn' })).toHaveClass('btn--ghost');
    await userEvent.click(bulkBar().getByRole('button', { name: 'Bỏ chọn' }));
    expect(screen.queryByRole('toolbar', { name: 'Hành động trên các dòng đã chọn' })).toBeNull();
  });

  it('tab Đang dùng chọn 1 → "Đổi tối đa/tháng", "Chuyển nhóm", "Tạm ngưng" (quiet-danger); tab Tạm ngưng chọn 2 → chỉ "Dùng lại" (primary), "Chuyển nhóm", "Bỏ chọn"', async () => {
    await openCatalog({ items: [...ITEMS, OLD, adminItem({ id: 'i-old2', name: 'Bút cũ 2', category_id: 'c-pen', active: false })] }, '/admin/catalog?tab=active');
    await pick('Bút bi xanh');
    expect(bulkBar().getByRole('button', { name: 'Tạm ngưng' })).toHaveClass('btn--quiet-danger');
    expect(bulkBar().getByRole('button', { name: 'Đổi tối đa/tháng' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Tạm ngưng \d/ }));
    await pick('Bút xóa cũ');
    await pick('Bút cũ 2');
    expect(bulkBar().getByRole('button', { name: 'Dùng lại' })).toHaveClass('btn--primary');
    expect(bulkBar().getByRole('button', { name: 'Chuyển nhóm' })).toBeInTheDocument();
    expect(bulkBar().queryByRole('button', { name: 'Đổi tối đa/tháng' })).toBeNull();
    expect(bulkBar().queryByRole('button', { name: 'Tạm ngưng' })).toBeNull();
  });

  it('"Dùng lại" chọn món ngừng riêng A + món trong nhóm ngừng B → chỉ PATCH A {active:true}; dòng B báo "Bật lại nhóm để đổi từng món"; toast "Đã dùng lại 1 sản phẩm"', async () => {
    const b = adminItem({ id: 'i-b', name: 'Kẹp B', category_id: 'c-old', usable: false, inactive_reason: 'group' });
    const f = await openCatalog({ items: [PEN, OLD, b] }, '/admin/catalog?tab=inactive');
    await userEvent.click(within(screen.getByText('Tạm ngưng cả nhóm').closest('tr') as HTMLElement).getByRole('button', { expanded: false }));
    await pick('Bút xóa cũ');
    await pick('Kẹp B');
    await userEvent.click(bulkBar().getByRole('button', { name: 'Dùng lại' }));
    expect(await screen.findByText('Đã dùng lại 1 sản phẩm')).toBeInTheDocument();
    expect(patchCalls(f)).toEqual([{ id: 'i-old', body: { active: true } }]);
    expect(inRow('Kẹp B').getByRole('alert')).toHaveTextContent('Bật lại nhóm để đổi từng món');
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
    await userEvent.click(bulkBar().getByRole('button', { name: 'Tạm ngưng' }));
    expect(await screen.findByText('Đã tạm ngưng 1 sản phẩm')).toBeInTheDocument();
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
    await userEvent.click(bulkBar().getByRole('button', { name: 'Tạm ngưng' }));
    expect(await screen.findByText('Đã tạm ngưng 2 sản phẩm')).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Tạm ngưng 2 sản phẩm?' })).toBeNull();
    expect(patchCalls(f).map((c) => c.body)).toEqual([{ active: false }, { active: false }]);
    expect(inRow('Bút bi xanh').getByRole('button', { name: 'Dùng lại Bút bi xanh' })).toBeInTheDocument();
  });

  it('"Ngừng" có Bút bi xanh chờ ADM giao 3 → hỏi "Ngừng 2 món?" kèm khối cam ghi tên món; Quay lại → không PATCH', async () => {
    const f = await openCatalog({ items: ITEMS, pending: { 'i-pen': { remaining: 3, unit: 'cay', snapshot_at: '2026-11-03T02:15:00.000Z' } } });
    await pickPens();
    await userEvent.click(bulkBar().getByRole('button', { name: 'Tạm ngưng' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tạm ngưng 2 sản phẩm?' });
    expect(within(dialog).getByRole('note')).toHaveTextContent(/Bút bi xanh: Món này đang chờ ADM giao 3/);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));
    expect(patchCalls(f)).toEqual([]);
    await userEvent.click(bulkBar().getByRole('button', { name: 'Tạm ngưng' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Tạm ngưng 2 sản phẩm?' })).getByRole('button', { name: 'Tạm ngưng' }));
    expect(await screen.findByText('Đã tạm ngưng 2 sản phẩm')).toBeInTheDocument();
  });

  it('"Ngừng" mà tải pending-arrival lỗi → vẫn hỏi "Ngừng 2 món?" (hộp thường, không khối cam), không PATCH tới khi bấm Ngừng', async () => {
    const f = await openCatalog({ items: ITEMS, pending: { 'i-pen': 'error' } });
    await pickPens();
    await userEvent.click(bulkBar().getByRole('button', { name: 'Tạm ngưng' }));
    const dialog = await screen.findByRole('dialog', { name: 'Tạm ngưng 2 sản phẩm?' });
    expect(within(dialog).queryByRole('note')).toBeNull();
    expect(patchCalls(f)).toEqual([]);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạm ngưng' }));
    expect(await screen.findByText('Đã tạm ngưng 2 sản phẩm')).toBeInTheDocument();
  });
  it('tab Tất cả, nhóm ngừng thu sẵn: "Chọn tất cả" + "Tạm ngưng" chỉ PATCH món đang thấy và đang dùng, không chạm món trong nhóm thu hay món đã ngừng riêng', async () => {
    const hidden = adminItem({ id: 'i-b', name: 'Kẹp B', category_id: 'c-old', usable: false, inactive_reason: 'group' });
    const f = await openCatalog({ items: [PEN, hidden, OLD] });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả' }));
    expect(bulkBar().getByText('2 món đã chọn')).toBeInTheDocument();
    await userEvent.click(bulkBar().getByRole('button', { name: 'Tạm ngưng' }));
    expect(await screen.findByText('Đã tạm ngưng 1 sản phẩm')).toBeInTheDocument();
    expect(patchCalls(f)).toEqual([{ id: 'i-pen', body: { active: false } }]);
  });

  it('"Tạm ngưng" chọn món dùng được + món ngừng theo nhóm đang mở → chỉ PATCH món dùng được', async () => {
    const b = adminItem({ id: 'i-b', name: 'Kẹp B', category_id: 'c-old', usable: false, inactive_reason: 'group' });
    const f = await openCatalog({ items: [PEN, b, OLD] });
    await userEvent.click(within(screen.getByText('Tạm ngưng cả nhóm').closest('tr') as HTMLElement).getByRole('button', { expanded: false }));
    await pick('Bút bi xanh');
    await pick('Kẹp B');
    await userEvent.click(bulkBar().getByRole('button', { name: 'Tạm ngưng' }));
    expect(await screen.findByText('Đã tạm ngưng 1 sản phẩm')).toBeInTheDocument();
    expect(patchCalls(f)).toEqual([{ id: 'i-pen', body: { active: false } }]);
  });

  it('"Dùng lại" chỉ chọn món ngừng theo nhóm → không PATCH, dòng báo "Bật lại nhóm để đổi từng món"', async () => {
    const b = adminItem({ id: 'i-b', name: 'Kẹp B', category_id: 'c-old', usable: false, inactive_reason: 'group' });
    const f = await openCatalog({ items: [PEN, OLD, b] }, '/admin/catalog?tab=inactive');
    await userEvent.click(within(screen.getByText('Tạm ngưng cả nhóm').closest('tr') as HTMLElement).getByRole('button', { expanded: false }));
    await pick('Kẹp B');
    await userEvent.click(bulkBar().getByRole('button', { name: 'Dùng lại' }));
    expect(patchCalls(f)).toEqual([]);
    expect(inRow('Kẹp B').getByRole('alert')).toHaveTextContent('Bật lại nhóm để đổi từng món');
  });
});
