import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { PEN, PENCIL } from './catalog-fixtures';
import { callsTo, renderDrawer, stubDrawerApi } from './item-drawer-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('Ngăn kéo món — đầu, chuyển món, thông tin kho', () => {
  it('eyebrow "{nhóm} · thứ {k}" theo vị trí món trong nhóm', () => {
    stubDrawerApi();
    renderDrawer({ item: PENCIL });
    expect(screen.getByText('Bút & viết · thứ 2')).toBeInTheDocument();
  });

  it('thêm món vào nhóm → eyebrow "{nhóm} · món mới"', () => {
    stubDrawerApi();
    renderDrawer({ categoryId: 'c-pen' });
    expect(screen.getByText('Bút & viết · món mới')).toBeInTheDocument();
  });

  it('↓/↑ (focus ngoài ô nhập) và nút "Món sau"/"Món trước" gọi đúng callback', async () => {
    stubDrawerApi();
    const onPrev = vi.fn();
    const onNext = vi.fn();
    renderDrawer({ item: PEN, onPrev, onNext });
    const next = screen.getByRole('button', { name: 'Món sau' });
    next.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onNext).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('{ArrowUp}');
    expect(onPrev).toHaveBeenCalledTimes(1);
    await userEvent.click(next);
    expect(onNext).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: 'Món trước' }));
    expect(onPrev).toHaveBeenCalledTimes(2);
  });

  it('không có món trước/sau → nút vô hiệu', () => {
    stubDrawerApi();
    renderDrawer({ item: PEN });
    expect(screen.getByRole('button', { name: 'Món trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Món sau' })).toBeDisabled();
  });

  it('đã sửa: "Món sau" hỏi bỏ thay đổi; "Tiếp tục sửa" ở lại, "Bỏ thay đổi" mới chuyển', async () => {
    stubDrawerApi();
    const onNext = vi.fn();
    renderDrawer({ item: PEN, onNext });
    await userEvent.type(screen.getByLabelText('Quy cách'), ' mới');
    await userEvent.click(screen.getByRole('button', { name: 'Món sau' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Tiếp tục sửa' }));
    expect(onNext).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Món sau' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('sửa món: "Tồn hiện có 10 cây" + "Mở Kho" tới Kho tìm theo tên, "Đăng ký kỳ tháng 11: 7 người"', async () => {
    stubDrawerApi();
    renderDrawer({ item: PEN });
    expect(screen.getByText('Tồn hiện có 10 cây')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mở Kho' })).toHaveAttribute('href', `/admin/stock?q=${encodeURIComponent(PEN.name)}`);
    expect(await screen.findByText('Đăng ký kỳ tháng 11: 7 người')).toBeInTheDocument();
  });

  it('món chưa ai đăng ký kỳ này → "Đăng ký kỳ tháng 11: 0 người"', async () => {
    stubDrawerApi();
    renderDrawer({ item: PENCIL });
    expect(await screen.findByText('Đăng ký kỳ tháng 11: 0 người')).toBeInTheDocument();
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
