import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { NOTE, PEN, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';
import { startEditingOrder } from '@/test/request-cart';

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
const saved = () => view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequestPage — điện thoại ≤ 900: thanh phiếu nổi + sheet phiếu', () => {
  it('390 px: nút "Xem phiếu (1 món)" mở dialog "Phiếu tháng 11" có dòng + nút Lưu; Esc đóng và trả focus về nút mở', async () => {
    mockViewport(390);
    stubRequestApi({ request: saved() });
    renderApp(makeMe('member'), '/');
    const opener = await screen.findByRole('button', { name: 'Xem phiếu (1 món)' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('complementary', { name: 'Phiếu tháng 11' })).toBeNull();
    await userEvent.click(opener);
    const sheet = await screen.findByRole('dialog', { name: 'Phiếu tháng 11' });
    expect(within(sheet).getByText('Bút bi xanh')).toBeInTheDocument();
    expect(within(sheet).queryByRole('spinbutton')).toBeNull();
    await startEditingOrder();
    expect(within(sheet).getByRole('spinbutton', { name: 'Bút bi xanh' })).toHaveValue(2);
    expect(within(sheet).getByRole('button', { name: 'Lưu phiếu' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(opener).toHaveFocus();
  });

  it('390 px: nút "Lưu phiếu" của thanh nổi mở thẳng hộp "Lưu phiếu tháng 11?" (không qua sheet)', async () => {
    mockViewport(390);
    stubRequestApi({ request: saved() });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
    expect(await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 11?' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Phiếu tháng 11' })).toBeNull();
  });

  it('hộp "Lưu phiếu tháng 11?" có dòng tổng "x loại món · y đơn vị"', async () => {
    mockViewport(390);
    stubRequestApi({ request: saved() });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
    const confirm = await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 11?' });
    expect(within(confirm).getByText('1 loại món · 3 đơn vị')).toBeInTheDocument();
  });

  it('390 px: lưu từ trong sheet → hộp xác nhận → PUT → sheet đóng, toast "Đã lưu phiếu tháng 11"', async () => {
    mockViewport(390);
    const api = stubRequestApi({ request: saved(), put: () => jsonResponse(200, { request: view({ lines: saved().lines }) }) });
    renderApp(makeMe('member'), '/');
    await userEvent.click(await screen.findByRole('button', { name: 'Xem phiếu (1 món)' }));
    const sheet = await screen.findByRole('dialog', { name: 'Phiếu tháng 11' });
    await startEditingOrder();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(within(sheet).getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    const confirm = await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 11?' });
    await userEvent.click(within(confirm).getByRole('button', { name: 'Lưu phiếu' }));
    await waitFor(() => expect(api.putBody()).toBeTruthy());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Đã lưu phiếu tháng 11')).toBeInTheDocument();
  });

  it('390 px: "Thêm món khác" trong sheet mở hộp nhập; thêm xong dòng nằm trong sheet', async () => {
    mockViewport(390);
    stubRequestApi({ request: saved() });
    renderApp(makeMe('member'), '/');
    await userEvent.click(await screen.findByRole('button', { name: 'Xem phiếu (1 món)' }));
    const sheet = await screen.findByRole('dialog', { name: 'Phiếu tháng 11' });
    await startEditingOrder();
    await userEvent.click(within(sheet).getByRole('button', { name: '+ Thêm món khác' }));
    const dialog = await screen.findByRole('dialog', { name: 'Thêm món khác' });
    await userEvent.type(within(dialog).getByLabelText('Tên món'), 'Bìa còng 7cm');
    await userEvent.selectOptions(within(dialog).getByLabelText('Đơn vị tính'), 'cai');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm vào phiếu' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Thêm món khác' })).toBeNull());
    expect(within(screen.getByRole('dialog', { name: 'Phiếu tháng 11' })).getByRole('button', { name: 'Sửa Bìa còng 7cm' })).toBeInTheDocument();
  });

  it('390 px: lưu từ thanh nổi khi server báo lỗi dòng → sheet tự mở, alert nằm trong sheet, focus ô số lượng dòng lỗi', async () => {
    mockViewport(390);
    const two = view({
      lines: [
        lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 }),
        lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 1 }),
      ],
    });
    stubRequestApi({ request: two, put: () => jsonResponse(400, { code: 'ITEM_INACTIVE', message: 'x', line_id: 'l-2' }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 11?' })).getByRole('button', { name: 'Lưu phiếu' }));
    const sheet = await screen.findByRole('dialog', { name: 'Phiếu tháng 11' });
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Giấy note vàng');
    const stepper = within(sheet).getByRole('spinbutton', { name: 'Giấy note vàng' });
    await waitFor(() => expect(stepper).toHaveFocus());
  });

  it('390 px: lỗi lặp lại trên cùng một dòng sau khi đã đóng sheet → sheet mở lại và focus dòng đó', async () => {
    mockViewport(390);
    const two = view({
      lines: [
        lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 }),
        lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 1 }),
      ],
    });
    stubRequestApi({ request: two, put: () => jsonResponse(400, { code: 'ITEM_INACTIVE', message: 'x', line_id: 'l-2' }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    const saveViaBar = async () => {
      await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
      await userEvent.click(within(await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 11?' })).getByRole('button', { name: 'Lưu phiếu' }));
    };
    await saveViaBar();
    let sheet = await screen.findByRole('dialog', { name: 'Phiếu tháng 11' });
    await waitFor(() => expect(within(sheet).getByRole('spinbutton', { name: 'Giấy note vàng' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await saveViaBar();
    sheet = await screen.findByRole('dialog', { name: 'Phiếu tháng 11' });
    await waitFor(() => expect(within(sheet).getByRole('spinbutton', { name: 'Giấy note vàng' })).toHaveFocus());
  });

  it('390 px: lưu thành công từ sheet → focus về nút "Xem phiếu" (không rơi về body)', async () => {
    mockViewport(390);
    stubRequestApi({ request: saved(), put: () => jsonResponse(200, { request: saved() }) });
    renderApp(makeMe('member'), '/');
    const opener = await screen.findByRole('button', { name: 'Xem phiếu (1 món)' });
    await userEvent.click(opener);
    const sheet = await screen.findByRole('dialog', { name: 'Phiếu tháng 11' });
    await startEditingOrder();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await userEvent.click(within(sheet).getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 11?' })).getByRole('button', { name: 'Lưu phiếu' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Xem phiếu (1 món)' })).toHaveFocus());
  });

  it('thanh nổi: chữ hiện "Lưu phiếu" và số thay đổi chưa lưu hiện bằng chữ (không chỉ cho trình đọc màn hình)', async () => {
    mockViewport(390);
    stubRequestApi({ request: saved() });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    const save = screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' });
    expect(save.textContent).toContain('Lưu phiếu');
    const count = within(save).getByText('1 thay đổi chưa lưu');
    expect(count.closest('.sr-only')).toBeNull();
  });

  it.each([
    [900, true],
    [901, false],
  ])('biên 900/901: bề ngang %i px → thanh phiếu nổi %s', async (width, floating) => {
    mockViewport(width);
    stubRequestApi({ request: saved() });
    renderApp(makeMe('member'), '/');
    await screen.findByRole('region', { name: 'Danh mục món' });
    expect(screen.queryByRole('button', { name: 'Xem phiếu (1 món)' }) !== null).toBe(floating);
    expect(screen.queryByRole('complementary', { name: 'Phiếu tháng 11' }) !== null).toBe(!floating);
  });
});
