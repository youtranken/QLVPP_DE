import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { PEN, PENCIL } from './catalog-fixtures';
import { callsTo, renderDrawer, stubDrawerApi } from './item-drawer-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('Ngăn kéo món — đầu, chuyển món, thông tin kho', () => {
  it('đầu panel: "Sửa món {tên}" + bộ đếm vị trí; thêm món: "Thêm món"', () => {
    stubDrawerApi();
    renderDrawer({ item: PENCIL, nav: { index: 2, total: 48, onStep: vi.fn() } });
    expect(screen.getByRole('dialog', { name: 'Sửa món Bút chì 2B' })).toBeInTheDocument();
    expect(screen.getByText('3/48')).toBeInTheDocument();
  });

  it('thêm món → tiêu đề "Thêm món", không có ↑/↓', () => {
    stubDrawerApi();
    renderDrawer({ categoryId: 'c-pen' });
    expect(screen.getByRole('dialog', { name: 'Thêm món' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Món sau' })).toBeNull();
  });

  it('↓/↑ (focus ngoài ô nhập) và nút "Món sau"/"Món trước" gọi bước +1/−1', async () => {
    stubDrawerApi();
    const onStep = vi.fn();
    renderDrawer({ item: PEN, nav: { index: 1, total: 3, onStep } });
    const next = screen.getByRole('button', { name: 'Món sau' });
    next.focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{ArrowUp}');
    await userEvent.click(next);
    await userEvent.click(screen.getByRole('button', { name: 'Món trước' }));
    expect(onStep.mock.calls).toEqual([[1], [-1], [1], [-1]]);
  });

  it('món duy nhất → ↑ và ↓ vô hiệu', () => {
    stubDrawerApi();
    renderDrawer({ item: PEN, nav: { index: 0, total: 1, onStep: vi.fn() } });
    expect(screen.getByRole('button', { name: 'Món trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Món sau' })).toBeDisabled();
  });

  it('đã sửa tên rồi ↓: hỏi "Bỏ thay đổi?"; "Ở lại" giữ nháp, "Bỏ thay đổi" mới chuyển', async () => {
    stubDrawerApi();
    const onStep = vi.fn();
    renderDrawer({ item: PEN, nav: { index: 0, total: 3, onStep } });
    await userEvent.type(screen.getByLabelText('Quy cách'), ' mới');
    await userEvent.click(screen.getByRole('button', { name: 'Món sau' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ở lại' }));
    expect(onStep).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Quy cách')).toHaveValue('hộp 20 cây mới');
    await userEvent.click(screen.getByRole('button', { name: 'Món sau' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it('sửa món: tồn chỉ đọc "Tồn hiện có 10 cây" + "Xem ở Tủ / Kho" tới Kho tìm theo tên, "Đăng ký kỳ tháng 10: 7 người"', async () => {
    stubDrawerApi();
    renderDrawer({ item: PEN });
    expect(screen.getByText('Tồn hiện có 10 cây')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem ở Tủ / Kho' })).toHaveAttribute('href', `/admin/stock?q=${encodeURIComponent(PEN.name)}`);
    expect(await screen.findByText('Đăng ký kỳ tháng 10: 7 người')).toBeInTheDocument();
  });

  it('món chưa ai đăng ký kỳ này → "Đăng ký kỳ tháng 10: 0 người"', async () => {
    stubDrawerApi();
    renderDrawer({ item: PENCIL });
    expect(await screen.findByText('Đăng ký kỳ tháng 10: 0 người')).toBeInTheDocument();
  });

  it('thêm món: không khối tồn/đăng ký, không "Xóa món"', () => {
    const f = stubDrawerApi();
    renderDrawer();
    expect(screen.queryByText(/Tồn hiện có/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa món' })).toBeNull();
    expect(callsTo(f, '/api/periods/current')).toHaveLength(0);
  });
});

describe('Ngăn kéo món — xóa món', () => {
  it('"Xóa món" hỏi xác nhận rồi DELETE → đóng, toast "Đã xóa {tên}"', async () => {
    const f = stubDrawerApi((_url, init) => (init.method === 'DELETE' ? jsonResponse(204, null) : undefined));
    const { onClose } = renderDrawer({ item: PEN });
    await userEvent.click(screen.getByRole('button', { name: 'Xóa món' }));
    const confirm = await screen.findByRole('dialog', { name: 'Xóa Bút bi xanh?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Xóa món' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'DELETE')).toHaveLength(1);
    expect(await screen.findByText('Đã xóa Bút bi xanh')).toBeInTheDocument();
  });

  it('ITEM_IN_USE → "Món này đã được dùng — chỉ ngừng được, không xóa." trong ngăn kéo, không đóng', async () => {
    stubDrawerApi((_url, init) => (init.method === 'DELETE' ? jsonResponse(409, { code: 'ITEM_IN_USE', message: 'x' }) : undefined));
    const { onClose } = renderDrawer({ item: PEN });
    await userEvent.click(screen.getByRole('button', { name: 'Xóa món' }));
    const confirm = await screen.findByRole('dialog', { name: 'Xóa Bút bi xanh?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Xóa món' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Món này đã được dùng — chỉ ngừng được, không xóa.');
    expect(onClose).not.toHaveBeenCalled();
  });
});
