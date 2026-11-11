import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { NOTE, PEN, PERIOD, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockResizableViewport, mockViewport } from '@/test/viewport';

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
const saved = () => view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })] });
const twoLines = () =>
  view({
    lines: [
      lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 }),
      lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 1 }),
    ],
  });
const barSave = () => screen.getByRole('button', { name: /Lưu phiếu$/ });

async function saveViaBar() {
  await userEvent.click(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' }));
  await userEvent.click(within(await screen.findByRole('dialog', { name: 'Lưu phiếu tháng 11?' })).getByRole('button', { name: 'Lưu phiếu' }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RequestPage — focus sau lưu / chép / lỗi dòng (≤ 900)', () => {
  it('390 px: chép lại tháng trước (toast) không đóng gì và không kéo focus sang "Xem phiếu"', async () => {
    mockViewport(390);
    stubRequestApi({
      period: { ...PERIOD, previous: { ym: '2026-10', delivering: false } },
      copy: () => jsonResponse(200, { from_ym: '2026-10', lines: [{ item_id: PEN.id, qty: 3 }], skipped: [], capped: [], previously_accepted: [] }),
    });
    renderApp(makeMe('member'), '/');
    const copy = await screen.findByRole('button', { name: 'Chép lại danh sách tháng 10' });
    await userEvent.click(copy);
    expect(await screen.findByText('Đã chép danh sách tháng 10 — kiểm tra rồi bấm Lưu phiếu')).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByRole('button', { name: 'Xem phiếu (1 món)' })).not.toHaveFocus();
    expect(copy).toHaveFocus();
  });

  it('390 px: lưu thành công từ nút "Lưu phiếu" của thanh nổi (sheet đóng) → focus trở lại nút Lưu đó', async () => {
    mockViewport(390);
    stubRequestApi({ request: saved(), put: () => jsonResponse(200, { request: saved() }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await saveViaBar();
    expect(await screen.findByText('Đã lưu phiếu tháng 11')).toBeInTheDocument();
    await waitFor(() => expect(barSave()).toHaveFocus());
    expect(barSave()).toHaveAttribute('aria-disabled', 'true');
  });

  it('390 px: sheet tự mở vì lỗi dòng → Esc đóng và focus về "Xem phiếu" (không rơi về body)', async () => {
    mockViewport(390);
    stubRequestApi({ request: twoLines(), put: () => jsonResponse(400, { code: 'ITEM_INACTIVE', message: 'x', line_id: 'l-2' }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await saveViaBar();
    const sheet = await screen.findByRole('dialog', { name: 'Phiếu tháng 11' });
    await waitFor(() => expect(within(sheet).getByRole('spinbutton', { name: 'Giấy note vàng' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Xem phiếu (2 món)' })).toHaveFocus());
  });

  it('lỗi dòng chỉ tự mở sheet một lần: đóng sheet, kéo lên 1280 rồi về 390 → sheet không tự mở lại', async () => {
    const resize = mockResizableViewport(390);
    stubRequestApi({ request: twoLines(), put: () => jsonResponse(400, { code: 'ITEM_INACTIVE', message: 'x', line_id: 'l-2' }) });
    renderApp(makeMe('member'), '/');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Thêm Bút bi xanh' }));
    await saveViaBar();
    await screen.findByRole('dialog', { name: 'Phiếu tháng 11' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    act(() => resize(1280));
    expect(await screen.findByRole('complementary', { name: 'Phiếu tháng 11' })).toBeInTheDocument();
    act(() => resize(390));
    await screen.findByRole('button', { name: 'Xem phiếu (2 món)' });
    expect(screen.queryByRole('dialog', { name: 'Phiếu tháng 11' })).toBeNull();
  });

  it('?picked=1: bấm − về 0 làm thẻ biến khỏi lưới → focus sang ô "Tìm món" (không rơi về body)', async () => {
    mockViewport(1280);
    stubRequestApi({ request: view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 1 })] }) });
    renderApp(makeMe('member'), '/?picked=1');
    await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Bút bi xanh');
    await userEvent.click(within(grid()).getByRole('button', { name: 'Bớt Bút bi xanh' }));
    await waitFor(() => expect(within(grid()).queryByText('Bút bi xanh')).toBeNull());
    await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Tìm món' })).toHaveFocus());
  });
});
