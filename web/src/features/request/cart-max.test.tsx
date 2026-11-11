import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { NOTE, PAUSED, PEN, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';
import { startEditingOrder } from '@/test/request-cart';

afterEach(() => {
  vi.unstubAllGlobals();
  void i18n.changeLanguage('vi');
});

const LOWERED = { ...PEN, max_qty: 4 };
const cart = () => screen.getByRole('complementary', { name: 'Phiếu tháng 11' });
const pen = (qty: number) => lineView({ id: 'l-pen', item_id: PEN.id, item: facts(LOWERED), qty, max_qty: 4 });
const note = lineView({ id: 'l-note', item_id: NOTE.id, item: facts(NOTE), qty: 1, max_qty: NOTE.max_qty });
const saved = (qty: number) => view({ lines: [pen(qty), note] });

describe('Giỏ — tối đa/tháng bị hạ sau khi lưu', () => {
  it('tối đa 5 → 4 khi đã lưu 5: "Adm D&E đã đổi tối đa còn 4/tháng. Số lượng 5 vẫn được giữ, không thể tăng thêm.", + vô hiệu; lưu lại giữ 5 → gửi qty 5, 200', async () => {
    mockViewport(1280);
    const api = stubRequestApi({ request: saved(5), items: [LOWERED, NOTE], put: () => jsonResponse(200, { request: saved(5) }) });
    renderApp(makeMe('member'), '/');
    const line = (await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Bút bi xanh')).closest('li')!;
    expect(within(line).getByText('Adm D&E đã đổi tối đa còn 4/tháng. Số lượng 5 vẫn được giữ, không thể tăng thêm.')).toBeInTheDocument();
    await startEditingOrder();
    expect(within(line).getByRole('button', { name: 'Thêm Bút bi xanh' })).toBeDisabled();

    await userEvent.click(within(line).getByRole('button', { name: 'Bớt Bút bi xanh' }));
    // Đang để 4 (= tối đa mới) thì câu "giữ được 5" không còn đúng với số đang thấy → ẩn; tăng lại 5 thì hiện lại
    expect(within(line).queryByText(/Tối đa đã đổi/)).toBeNull();
    await userEvent.click(within(line).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    expect(within(line).getByText('Adm D&E đã đổi tối đa còn 4/tháng. Số lượng 5 vẫn được giữ, không thể tăng thêm.')).toBeInTheDocument();
    expect(within(line).getByRole('spinbutton', { name: 'Bút bi xanh' })).toHaveValue(5);
    expect(within(line).getByRole('button', { name: 'Thêm Bút bi xanh' })).toBeDisabled();

    await userEvent.click(within(cart()).getByRole('button', { name: 'Thêm Giấy note vàng' }));
    await userEvent.click(within(cart()).getByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
    await waitFor(() =>
      expect(api.putBody().lines).toEqual([
        { id: 'l-pen', qty: 5 },
        { id: 'l-note', qty: 2 },
      ]),
    );
    expect(within(line).getByText('Adm D&E đã đổi tối đa còn 4/tháng. Số lượng 5 vẫn được giữ, không thể tăng thêm.')).toBeInTheDocument();
  });

  it('dòng đã lưu đúng bằng tối đa mới (4 = 4) → không hiện câu tối đa mới', async () => {
    mockViewport(1280);
    stubRequestApi({ request: saved(4), items: [LOWERED, NOTE] });
    renderApp(makeMe('member'), '/');
    const line = (await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Bút bi xanh')).closest('li')!;
    expect(within(line).queryByText(/Tối đa đã đổi/)).toBeNull();
  });

  it('tiếng Anh: "Admin changed the limit to 4/month. Quantity 5 is kept but cannot be increased."', async () => {
    mockViewport(1280);
    await i18n.changeLanguage('en');
    stubRequestApi({ request: saved(5), items: [LOWERED, NOTE] });
    renderApp(makeMe('member'), '/');
    expect(await screen.findByText('D&E Admin changed the limit to 4/month. Quantity 5 is kept but cannot be increased.')).toBeInTheDocument();
  });
});

describe('Giỏ — món/nhóm đã ngừng sau khi lưu (GAP-21, L.17)', () => {
  const STOPPED = 'Sản phẩm này đã tạm ngưng và không thể đặt hàng.';
  const lineOf = async (name: string) => (await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText(name)).closest('li')!;

  it('nhóm ngừng (Bút dạ quang) và món ngừng riêng (Giấy note) → báo đỏ "Món đã tạm ngưng…" + nút bỏ; món dùng được → không nhãn', async () => {
    mockViewport(1280);
    const paused = lineView({ id: 'l-p', item_id: PAUSED.id, item: facts(PAUSED), qty: 2 });
    const off = lineView({ id: 'l-n', item_id: NOTE.id, item: { ...facts(NOTE), active: false }, qty: 1 });
    const pen = lineView({ id: 'l-pen', item_id: PEN.id, item: facts(PEN), qty: 1 });
    stubRequestApi({ request: view({ lines: [paused, off, pen] }), items: [PEN, PAUSED, { ...NOTE, active: false, usable: false }] });
    renderApp(makeMe('member'), '/');
    await lineOf('Bút dạ quang');
    await startEditingOrder();
    for (const name of ['Bút dạ quang', 'Giấy note vàng']) {
      const line = await lineOf(name);
      expect(within(line).getByText(STOPPED)).toBeInTheDocument();
      expect(within(line).getByRole('button', { name: `Bỏ ${name}` })).toBeEnabled();
    }
    expect(within(await lineOf('Bút bi xanh')).queryByText(STOPPED)).toBeNull();
  });
});
