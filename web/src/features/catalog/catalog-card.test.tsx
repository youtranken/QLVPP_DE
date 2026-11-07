import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { compressImage } from '@/lib/image-compress';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import { adminItem, CATEGORIES, PAPER, PEN, PENCIL } from './catalog-fixtures';
import { memberItem } from '@/test/fixtures-request';
import { ItemCard } from '@/features/request/item-card';
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

function renderCard(item = PAPER, onEdit = vi.fn(), groupActive = true) {
  renderWithI18n(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MeContext.Provider value={makeMe('admin')}>
        <MemoryRouter>
          <ToastProvider>
            <ConfirmProvider>
              <CatalogCard row={rowOf(item)} groupName="Giấy & sổ" groupActive={groupActive} onEdit={onEdit} />
            </ConfirmProvider>
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
  it('hiện nhóm, "Tủ: 10" xám để tham khảo, tên, mã · ĐVT · tối đa', async () => {
    stub();
    renderCard(PEN);
    expect(screen.getByText('Giấy & sổ')).toBeInTheDocument();
    expect(screen.getByText('Tủ: 10')).toHaveClass('ct-card__stock');
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
    expect(await screen.findByText('VPP-010 · Tối đa 10 cây/tháng')).toBeInTheDocument();
    expect(screen.queryByText('Tải ảnh lên')).toBeNull();
  });

  it('cùng ảnh với thẻ Đăng ký của nhân viên: cùng src /api/files/<file_id>, object-fit: contain', () => {
    stub();
    renderCard(PEN);
    renderWithI18n(<ItemCard item={memberItem({ id: PEN.id, name: PEN.name, image_file_id: PEN.image_file_id })} line={undefined} tone="g1" groupLabel={null} onQty={vi.fn()} />);
    const imgs = [...document.querySelectorAll('img')];
    expect(imgs).toHaveLength(2);
    expect(imgs.map((i) => i.getAttribute('src'))).toEqual(['/api/files/f-2', '/api/files/f-2']);
    expect(imgs.map((i) => i.style.objectFit)).toEqual(['contain', 'contain']);
  });

  it('tủ 0 → "Tủ: 0" xám, không nhãn "Hết", không .tag--danger/.tag--warn', () => {
    stub();
    renderCard(PENCIL);
    expect(screen.getByText('Tủ: 0')).toBeInTheDocument();
    expect(screen.queryByText('Hết')).toBeNull();
    expect(document.querySelector('.tag--danger, .tag--warn, .ct-card__stock--out, .ct-card__stock--low')).toBeNull();
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

  it('lỗi có nút đóng; đóng xong câu lỗi biến mất; tải lại thành công cũng xóa lỗi', async () => {
    let fail = true;
    stub((url) => (url === '/api/files' && fail ? jsonResponse(413, { code: 'FILE_TOO_LARGE', message: 'x' }) : undefined));
    renderCard();
    await userEvent.upload(screen.getByLabelText(UPLOAD), png());
    await screen.findByRole('alert');
    await userEvent.click(screen.getByRole('button', { name: 'Đóng thông báo lỗi' }));
    expect(screen.queryByRole('alert')).toBeNull();
    await userEvent.upload(screen.getByLabelText(UPLOAD), png());
    await screen.findByRole('alert');
    fail = false;
    await userEvent.upload(screen.getByLabelText(UPLOAD), png());
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
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

// Ngừng/Dùng lại ngay trên thẻ lưới: cùng hành vi công tắc món trong panel nhóm/panel món
describe('Ngừng / Dùng lại ở thẻ', () => {
  const bodies = (f: ReturnType<typeof stub>) => patches(f).map((c) => JSON.parse(String((c[1] as RequestInit).body)) as unknown);

  it('món đang dùng: nút "Tạm ngưng" trung tính (btn--quiet-danger, không btn--danger) cạnh "Sửa"; bấm → PATCH {active:false} → toast "Đã tạm ngưng Bút bi xanh" có "Hoàn tác"; Hoàn tác → PATCH {active:true}', async () => {
    const f = stub();
    const onEdit = renderCard(PEN);
    const stop = screen.getByRole('button', { name: 'Tạm ngưng Bút bi xanh' });
    expect(stop).toHaveTextContent('Tạm ngưng');
    expect(stop).toHaveClass('btn--quiet-danger');
    expect(stop).not.toHaveClass('btn--danger');
    expect(screen.getByRole('button', { name: 'Sửa Bút bi xanh' }).nextElementSibling).toBe(stop);
    await userEvent.click(stop);
    await waitFor(() => expect(bodies(f)).toEqual([{ active: false }]));
    expect(await screen.findByText('Đã tạm ngưng Bút bi xanh')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
    await waitFor(() => expect(bodies(f)).toEqual([{ active: false }, { active: true }]));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('món tạm ngưng riêng: con dấu "Tạm ngưng", không nhãn "Ngừng riêng", tên không gạch, nút "Dùng lại" → PATCH {active:true}', async () => {
    const f = stub();
    renderCard(adminItem({ ...PEN, active: false, usable: false, inactive_reason: 'item' }));
    expect(screen.getByRole('img', { name: 'Tạm ngưng' })).toBeInTheDocument();
    expect(screen.queryByText('Ngừng riêng')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Bút bi xanh' }).className).not.toMatch(/paused|struck/);
    const back = screen.getByRole('button', { name: 'Dùng lại Bút bi xanh' });
    expect(back).toHaveTextContent('Dùng lại');
    expect(back).not.toHaveClass('btn--quiet-danger');
    await userEvent.click(back);
    await waitFor(() => expect(bodies(f)).toEqual([{ active: true }]));
  });

  it('món trong nhóm tạm ngưng: con dấu, không nhãn "Ngừng theo nhóm", "Dùng lại" vô hiệu kèm gợi ý hiện rõ "Bật lại nhóm để đổi từng món"', () => {
    stub();
    renderCard(adminItem({ ...PEN, category_id: 'c-old', usable: false, inactive_reason: 'group' }), vi.fn(), false);
    expect(screen.getByRole('img', { name: 'Tạm ngưng' })).toBeInTheDocument();
    expect(screen.queryByText('Ngừng theo nhóm')).toBeNull();
    const btn = screen.getByRole('button', { name: 'Dùng lại Bút bi xanh' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription('Bật lại nhóm để đổi từng món');
    expect(screen.getByText('Bật lại nhóm để đổi từng món')).not.toHaveClass('sr-only');
  });

  it('món đang dùng không có con dấu', () => {
    stub();
    renderCard(PEN);
    expect(screen.queryByRole('img', { name: 'Tạm ngưng' })).toBeNull();
  });

  it('W24: còn hàng ADM đang về → hỏi "Ngừng Bút bi xanh?" kèm khối cam; Quay lại → không PATCH', async () => {
    const f = stub((url) => (url.endsWith('/pending-arrival') ? jsonResponse(200, { remaining: 3, unit: 'cay', snapshot_at: '2026-11-03T02:15:00.000Z' }) : undefined));
    renderCard(PEN);
    await userEvent.click(screen.getByRole('button', { name: 'Tạm ngưng Bút bi xanh' }));
    const ask = await screen.findByRole('dialog', { name: 'Tạm ngưng Bút bi xanh?' });
    expect(within(ask).getByRole('note')).toHaveTextContent(/đang chờ ADM giao 3 cây/);
    await userEvent.click(within(ask).getByRole('button', { name: 'Quay lại' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tạm ngưng Bút bi xanh?' })).toBeNull());
    expect(patches(f)).toHaveLength(0);
  });

  it('lỗi tải hàng đang về → vẫn hỏi (hộp thường, không khối cam); Ngừng → PATCH', async () => {
    const f = stub((url) => (url.endsWith('/pending-arrival') ? jsonResponse(500, { code: 'X' }) : undefined));
    renderCard(PEN);
    await userEvent.click(screen.getByRole('button', { name: 'Tạm ngưng Bút bi xanh' }));
    const ask = await screen.findByRole('dialog', { name: 'Tạm ngưng Bút bi xanh?' });
    expect(within(ask).queryByRole('note')).toBeNull();
    expect(patches(f)).toHaveLength(0);
    await userEvent.click(within(ask).getByRole('button', { name: 'Tạm ngưng' }));
    await waitFor(() => expect(bodies(f)).toEqual([{ active: false }]));
  });
});
