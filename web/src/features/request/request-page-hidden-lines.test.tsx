import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { NOTE, PEN, facts, stubRequestApi, view } from '@/test/request-api-stub';
import { mockViewport } from '@/test/viewport';

const grid = () => screen.getByRole('region', { name: 'Danh mục món' });

afterEach(() => vi.unstubAllGlobals());

async function saveWith(path: string, edit: () => Promise<void>) {
  mockViewport(1280);
  const api = stubRequestApi({
    request: view({ lines: [lineView({ id: 'l-pen', item_id: PEN.id, item: facts(PEN), qty: 2 })] }),
    put: () => jsonResponse(500, {}),
  });
  renderApp(makeMe('member'), path);
  await within(await screen.findByRole('region', { name: 'Danh mục món' })).findByText('Giấy note vàng');
  await edit();
  await userEvent.click(await screen.findByRole('button', { name: '1 thay đổi chưa lưu · Lưu' }));
  await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Lưu phiếu' }));
  await screen.findByRole('alert');
  return api.putBody();
}

describe('RequestPage — dòng bị bộ lọc ẩn thẻ vẫn nằm trong payload lưu', () => {
  it('tìm "giay note" ẩn thẻ Bút bi nhưng dòng Bút bi (đã lưu) vẫn được gửi cùng món mới', async () => {
    const body = await saveWith('/', async () => {
      await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món' }), 'giay note');
      await waitFor(() => expect(within(grid()).queryByRole('button', { name: 'Thêm vào phiếu: Bút bi xanh' })).toBeNull());
      await userEvent.click(within(grid()).getByRole('button', { name: `Thêm vào phiếu: ${NOTE.name}` }));
    });
    expect(body.lines).toEqual(expect.arrayContaining([{ id: 'l-pen', qty: 2 }, { item_id: NOTE.id, qty: 1 }]));
    expect(body.lines).toHaveLength(2);
  });

  it('lọc theo nhóm Giấy & sổ ẩn thẻ Bút bi nhưng dòng Bút bi vẫn được gửi', async () => {
    const body = await saveWith('/?g=c-2', async () => {
      expect(within(grid()).queryByRole('button', { name: 'Thêm vào phiếu: Bút bi xanh' })).toBeNull();
      await userEvent.click(within(grid()).getByRole('button', { name: `Thêm vào phiếu: ${NOTE.name}` }));
    });
    expect(body.lines).toEqual(expect.arrayContaining([{ id: 'l-pen', qty: 2 }, { item_id: NOTE.id, qty: 1 }]));
    expect(body.lines).toHaveLength(2);
  });
});
