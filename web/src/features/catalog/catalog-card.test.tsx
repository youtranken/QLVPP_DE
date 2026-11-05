import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { compressImage } from '@/lib/image-compress';
import { ToastProvider } from '@/ui/toast-provider';
import { CATEGORIES, PAPER, PEN, PENCIL } from './catalog-fixtures';
import { CatalogCard } from './catalog-card';
import { indexCategories, toRows } from './catalog-rows';
import { png } from './item-drawer-fixtures';

vi.mock('@/lib/image-compress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image-compress')>();
  return { ...actual, compressImage: vi.fn(actual.compressImage) };
});

const rowOf = (item: typeof PAPER) => toRows([item], indexCategories(CATEGORIES))[0];
const UNITS = [{ code: 'cay', name: 'cây', name_en: 'pcs', sort_order: 1, active: true }];
const UPLOAD = 'Tải ảnh lên cho Giấy A4';

function stub(reply: (url: string, init: RequestInit) => Response | undefined = () => undefined) {
  const f = vi.fn(async (url: string, init: RequestInit = {}) => reply(url, init) ?? (url === '/api/units' ? jsonResponse(200, UNITS) : url === '/api/files' ? jsonResponse(201, { id: 'f-new' }) : jsonResponse(200, {})));
  vi.stubGlobal('fetch', f);
  return f;
}
const patches = (f: ReturnType<typeof stub>) => f.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH');

function renderCard(item = PAPER, onEdit = vi.fn()) {
  renderWithI18n(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MeContext.Provider value={makeMe('admin')}>
        <MemoryRouter>
          <ToastProvider>
            <CatalogCard row={rowOf(item)} groupName="Giấy & sổ" onEdit={onEdit} />
          </ToastProvider>
        </MemoryRouter>
      </MeContext.Provider>
    </QueryClientProvider>,
  );
  return onEdit;
}

beforeEach(() => {
  vi.mocked(compressImage).mockImplementation(async (file) => ({ blob: file, mime: 'image/png', width: 10, height: 10 }));
});
afterEach(() => vi.unstubAllGlobals());

describe('Thẻ món dạng lưới', () => {
  it('hiện nhóm, nhãn tồn, tên, mã · ĐVT · tối đa', async () => {
    stub();
    renderCard(PEN);
    expect(screen.getByText('Giấy & sổ')).toBeInTheDocument();
    expect(screen.getByText('Còn 10')).toBeInTheDocument();
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
    expect(await screen.findByText('VPP-010 · cây · tối đa 10/tháng')).toBeInTheDocument();
    expect(screen.queryByText('Tải ảnh lên')).toBeNull();
  });

  it('hết hàng → nhãn "Hết"', () => {
    stub();
    renderCard(PENCIL);
    expect(screen.getByText('Hết')).toBeInTheDocument();
  });

  it('"Sửa" gọi onEdit với id món', async () => {
    stub();
    const onEdit = renderCard(PEN);
    await userEvent.click(screen.getByRole('button', { name: 'Sửa Bút bi xanh' }));
    expect(onEdit).toHaveBeenCalledWith('i-pen');
  });
});

describe('Tải ảnh lên ở thẻ', () => {
  it('chọn ảnh → nén → POST /api/files → PATCH image_file_id; không mở ngăn kéo', async () => {
    const f = stub();
    const onEdit = renderCard();
    await userEvent.upload(screen.getByLabelText(UPLOAD), png());
    await waitFor(() => expect(patches(f)).toHaveLength(1));
    expect(compressImage).toHaveBeenCalledTimes(1);
    const urls = f.mock.calls.map((c) => c[0]);
    expect(urls.indexOf('/api/files')).toBeLessThan(urls.indexOf('/api/admin/items/i-paper'));
    expect(JSON.parse(String((patches(f)[0][1] as RequestInit).body))).toEqual({ image_file_id: 'f-new' });
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('trong lúc tải: nút vô hiệu, "Đang tải ảnh…"; xong thì mở lại', async () => {
    let release = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const f = vi.fn(async (url: string) => {
      if (url === '/api/units') return jsonResponse(200, UNITS);
      if (url === '/api/files') await gate;
      return url === '/api/files' ? jsonResponse(201, { id: 'f-new' }) : jsonResponse(200, {});
    });
    vi.stubGlobal('fetch', f);
    renderCard();
    await userEvent.upload(screen.getByLabelText(UPLOAD), png());
    expect(await screen.findByText('Đang tải ảnh…')).toBeInTheDocument();
    expect(screen.getByLabelText(UPLOAD)).toBeDisabled();
    release();
    await waitFor(() => expect(screen.getByLabelText(UPLOAD)).toBeEnabled());
  });

  it.each([
    ['FILE_TOO_LARGE', 413, 'Ảnh quá 5 MB'],
    ['FILE_TYPE_INVALID', 400, 'Chọn ảnh JPG, PNG hoặc WebP'],
  ])('upload lỗi %s → "%s" tại thẻ, không PATCH', async (code, status, text) => {
    const f = stub((url) => (url === '/api/files' ? jsonResponse(status, { code, message: 'x' }) : undefined));
    renderCard();
    await userEvent.upload(screen.getByLabelText(UPLOAD), png());
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(patches(f)).toHaveLength(0);
    expect(screen.getByLabelText(UPLOAD)).toBeEnabled();
  });

  it('PATCH lỗi ITEM_NOT_FOUND → câu lỗi tại thẻ', async () => {
    stub((_url, init) => (init.method === 'PATCH' ? jsonResponse(404, { code: 'ITEM_NOT_FOUND', message: 'x' }) : undefined));
    renderCard();
    await userEvent.upload(screen.getByLabelText(UPLOAD), png());
    expect(await screen.findByRole('alert')).toHaveTextContent('Món này không còn — tải lại trang.');
  });

  it('HEIC → "Chọn ảnh JPG, PNG hoặc WebP", không gọi mạng', async () => {
    const actual = await vi.importActual<typeof import('@/lib/image-compress')>('@/lib/image-compress');
    vi.mocked(compressImage).mockImplementation(actual.compressImage);
    const f = stub();
    renderCard();
    await userEvent.upload(screen.getByLabelText(UPLOAD), new File([new Uint8Array([0])], 'IMG.HEIC', { type: 'image/heic' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chọn ảnh JPG, PNG hoặc WebP');
    expect(f.mock.calls.map((c) => c[0])).not.toContain('/api/files');
  });
});
