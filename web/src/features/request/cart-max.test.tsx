import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { NOTE, PEN, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';

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
  it('tối đa 5 → 4 khi đã lưu 5: "Tối đa mới 4 — giữ được 5, không tăng được", + vô hiệu; lưu lại giữ 5 → gửi qty 5, 200', async () => {
    mockViewport(1280);
    const api = stubRequestApi({ request: saved(5), items: [LOWERED, NOTE], put: () => jsonResponse(200, { request: saved(5) }) });
    renderApp(makeMe('member'), '/');
    const line = (await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Bút bi xanh')).closest('li')!;
    expect(within(line).getByText('Tối đa mới 4 — giữ được 5, không tăng được')).toBeInTheDocument();
    expect(within(line).getByRole('button', { name: 'Thêm Bút bi xanh' })).toBeDisabled();

    await userEvent.click(within(line).getByRole('button', { name: 'Bớt Bút bi xanh' }));
    // Đang để 4 (= tối đa mới) thì câu "giữ được 5" không còn đúng với số đang thấy → ẩn; tăng lại 5 thì hiện lại
    expect(within(line).queryByText(/Tối đa mới/)).toBeNull();
    await userEvent.click(within(line).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    expect(within(line).getByText('Tối đa mới 4 — giữ được 5, không tăng được')).toBeInTheDocument();
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
    expect(within(line).getByText('Tối đa mới 4 — giữ được 5, không tăng được')).toBeInTheDocument();
  });

  it('dòng đã lưu đúng bằng tối đa mới (4 = 4) → không hiện câu tối đa mới', async () => {
    mockViewport(1280);
    stubRequestApi({ request: saved(4), items: [LOWERED, NOTE] });
    renderApp(makeMe('member'), '/');
    const line = (await within(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).findByText('Bút bi xanh')).closest('li')!;
    expect(within(line).queryByText(/Tối đa mới/)).toBeNull();
  });

  it('tiếng Anh: "New max 4 — you can keep 5, not increase"', async () => {
    mockViewport(1280);
    await i18n.changeLanguage('en');
    stubRequestApi({ request: saved(5), items: [LOWERED, NOTE] });
    renderApp(makeMe('member'), '/');
    expect(await screen.findByText('New max 4 — you can keep 5, not increase')).toBeInTheDocument();
  });
});
