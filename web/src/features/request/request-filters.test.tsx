import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { CLIP, NOTE, PEN, PERIOD, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });
const names = () =>
  within(grid())
    .getAllByRole('button', { name: /^Thêm (?!món)/ })
    .map((b) => b.getAttribute('aria-label')!.replace('Thêm ', ''));

afterEach(() => {
  vi.unstubAllGlobals();
});

async function open(path = '/') {
  renderApp(makeMe('member'), path);
  await screen.findByRole('searchbox', { name: 'Tìm món' });
}

describe('RequestPage — thanh lọc', () => {
  it('1280 px: mặc định "Tất cả"; gõ "giay" (không dấu) chỉ còn Giấy note vàng và đưa q lên URL', async () => {
    mockViewport(1280);
    stubRequestApi();
    await open();
    expect(names()).toEqual(['Bút bi xanh', 'Giấy note vàng', 'Kẹp giấy']);
    expect(screen.getByText('3 món trong danh mục')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món' }), 'GIAY NOTE');
    await waitFor(() => expect(names()).toEqual(['Giấy note vàng']));
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toBe('?q=GIAY+NOTE'));
    expect(screen.getByText('1 món khớp bộ lọc')).toBeInTheDocument();
  });

  it('390 px (Review Focus 1): không có g trên URL → nhóm đầu, số thẻ ≤ số món của nhóm đó; chip "Tất cả" hiện đủ', async () => {
    mockViewport(390);
    stubRequestApi();
    await open();
    expect(names().length).toBeLessThanOrEqual(1);
    expect(names()).toEqual(['Bút bi xanh']);
    expect(screen.getByRole('button', { name: 'Bút & viết 1' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: /^Tất cả/ }));
    expect(names()).toHaveLength(3);
    expect(screen.getByTestId('location-search').textContent).toBe('?g=all');
  });

  it('390 px: có từ khóa mà không có g → tìm trên mọi nhóm', async () => {
    mockViewport(390);
    stubRequestApi();
    await open('/?q=kep');
    expect(names()).toEqual(['Kẹp giấy']);
  });

  it('Đã chọn + từ khóa là giao; "Xóa bộ lọc" xóa sạch khóa trên URL', async () => {
    mockViewport(1280);
    stubRequestApi({
      request: view({ lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 1 }), lineView({ id: 'l-2', item_id: NOTE.id, item: facts(NOTE), qty: 1 })] }),
    });
    await open('/?picked=1&q=giay');
    expect(names()).toEqual(['Giấy note vàng']);
    await userEvent.click(screen.getByRole('button', { name: 'Đã chọn 2' }));
    expect(names()).toEqual(['Giấy note vàng', 'Kẹp giấy']);
    await userEvent.click(screen.getByRole('button', { name: 'Đã chọn 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Bút & viết 1' }));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món' }), 'zzz');
    await userEvent.click(await screen.findByRole('button', { name: 'Xóa bộ lọc' }));
    await waitFor(() => expect(screen.getByTestId('location-search').textContent).toBe(''));
    expect(names()).toHaveLength(3);
    expect(screen.getByRole('searchbox', { name: 'Tìm món' })).toHaveValue('');
  });

  it('sắp xếp "Hay dùng trước" đưa món có trong phiếu kỳ trước lên đầu (nguồn là GET phiếu kỳ trước)', async () => {
    mockViewport(1280);
    const api = stubRequestApi({
      period: { ...PERIOD, previous: { ym: '2026-10', delivering: false } },
      others: { '2026-10': view({ period_ym: '2026-10', lines: [lineView({ id: 'p-1', item_id: CLIP.id, item: facts(CLIP), qty: 1 })] }) },
    });
    await open('/?sort=fav');
    await waitFor(() => expect(names()[0]).toBe('Kẹp giấy'));
    expect(api.fetchMock.mock.calls.some(([u]) => u === '/api/me/request?ym=2026-10')).toBe(true);
  });

  it('không có kỳ trước: "Hay dùng trước" giữ thứ tự nhóm', async () => {
    mockViewport(1280);
    stubRequestApi();
    await open('/?sort=fav');
    expect(names()).toEqual(['Bút bi xanh', 'Giấy note vàng', 'Kẹp giấy']);
  });

  it('sort=xyz trên URL → "Theo nhóm"; không có món khớp → thông báo rỗng', async () => {
    mockViewport(1280);
    stubRequestApi();
    await open('/?sort=xyz');
    expect(screen.getByRole('combobox', { name: 'Sắp xếp' })).toHaveValue('group');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món' }), 'khong co');
    expect(await screen.findByText('Không có món phù hợp')).toBeInTheDocument();
  });
});
