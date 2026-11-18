import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { act, jsonResponse, renderWithI18n, screen, userEvent, waitFor, within, pickOption } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { MeContext } from '@/lib/me';
import { usePanelParam } from '@/lib/use-panel-param';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import type { AdminItem } from './catalog.api';
import { CATEGORIES, PEN } from './catalog-fixtures';
import { png, stubDrawerApi } from './item-drawer-fixtures';
import { ItemDrawer } from './item-drawer';

vi.mock('@/lib/image-compress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image-compress')>();
  return { ...actual, compressImage: vi.fn(async (file: File) => ({ blob: file, mime: 'image/png', width: 10, height: 10 })) };
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

function Host({ item }: { item: AdminItem | null }) {
  const { search } = useLocation();
  const panel = usePanelParam('item');
  return (
    <>
      <output data-testid="search">{search}</output>
      <button type="button" onClick={() => panel.open(item?.id ?? 'new')}>
        Mở panel
      </button>
      {panel.id && <ItemDrawer item={item} categories={CATEGORIES} defaultCategoryId="c-pen" onClose={panel.close} />}
    </>
  );
}

async function openPanel(item: AdminItem | null) {
  mockViewport(1280);
  window.history.replaceState(null, '', '/admin/catalog');
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <BrowserRouter>
        <ToastProvider>
          <ConfirmProvider>
            <Host item={item} />
          </ConfirmProvider>
        </ToastProvider>
      </BrowserRouter>
    </MeContext.Provider>,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Mở panel' }));
  return screen.findByRole('dialog', { name: item ? `Sửa món ${item.name}` : 'Thêm sản phẩm' });
}

const discardDialog = () => screen.queryByRole('dialog', { name: 'Bỏ thay đổi?' });
const settle = () => act(() => new Promise((r) => setTimeout(r, 30)));

describe('Panel món trong BrowserRouter — tự đóng không vướng chặn Back', () => {
  it('đã sửa → × → "Bỏ thay đổi": hỏi đúng một lần, panel đóng, URL sạch', async () => {
    stubDrawerApi();
    const panel = await openPanel(PEN);
    await userEvent.type(within(panel).getByLabelText(/^Tên sản phẩm/), ' X');
    await userEvent.click(within(panel).getByRole('button', { name: 'Đóng' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Bỏ thay đổi?' })).getByRole('button', { name: 'Bỏ thay đổi' }));
    await settle();
    expect(discardDialog()).toBeNull();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: `Sửa món ${PEN.name}` })).toBeNull());
    expect(window.location.search).toBe('');
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('thêm món đã điền → "Thêm món" thành công: không hỏi, panel đóng, URL sạch', async () => {
    stubDrawerApi((url, init) => (url === '/api/admin/items' && init.method === 'POST' ? jsonResponse(201, { ...PEN, id: 'i-new' }) : undefined));
    const panel = await openPanel(null);
    await userEvent.type(within(panel).getByLabelText(/^Tên sản phẩm/), 'Bút chì');
    await pickOption(within(panel).getByLabelText(/^Đơn vị tính/), 'cây');
    await userEvent.upload(within(panel).getByLabelText('Chụp hoặc chọn ảnh'), png());
    await within(panel).findByRole('img', { name: 'Ảnh món' });
    await userEvent.click(within(panel).getByRole('button', { name: 'Thêm món' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Thêm sản phẩm' })).toBeNull());
    await settle();
    expect(discardDialog()).toBeNull();
    expect(window.location.search).toBe('');
    expect(screen.getByTestId('search').textContent).toBe('');
  });

  it('đã sửa → "Xóa": không hỏi "Bỏ thay đổi?", panel đóng, URL sạch', async () => {
    stubDrawerApi((_url, init) => (init.method === 'DELETE' ? jsonResponse(200, { undo_id: 'u-1' }) : undefined));
    const panel = await openPanel(PEN);
    await userEvent.type(within(panel).getByLabelText(/^Tên sản phẩm/), ' X');
    await userEvent.click(within(panel).getByRole('button', { name: 'Xóa' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: `Sửa món ${PEN.name}` })).toBeNull());
    await settle();
    expect(discardDialog()).toBeNull();
    expect(window.location.search).toBe('');
  });

  it('đã sửa: Back → "Ở lại" giữ nháp → Back lần nữa hỏi lại → "Bỏ thay đổi" về danh sách', async () => {
    stubDrawerApi();
    const panel = await openPanel(PEN);
    await userEvent.type(within(panel).getByLabelText(/^Tên sản phẩm/), ' X');
    await act(async () => window.history.back());
    await userEvent.click(await screen.findByRole('button', { name: 'Ở lại' }));
    expect(window.location.search).toBe(`?item=${PEN.id}`);
    expect(within(panel).getByLabelText(/^Tên sản phẩm/)).toHaveValue(`${PEN.name} X`);
    await act(async () => window.history.back());
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe(''));
    expect(window.location.pathname).toBe('/admin/catalog');
    expect(window.location.search).toBe('');
    expect(screen.queryByRole('dialog', { name: `Sửa món ${PEN.name}` })).toBeNull();
  });
});
