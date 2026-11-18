import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ApiError } from '@/lib/api-client';
import { loadCropSource } from '@/lib/crop-source';
import { ImageField } from './image-field';

const FIVE_MB = 5 * 1024 * 1024;
let cropSize = 10;
let compressedSize: number | null = null;

vi.mock('@/lib/image-compress', () => ({
  compressImage: vi.fn(async (f: File) => ({
    blob: compressedSize === null ? f : new Blob([new Uint8Array(compressedSize)], { type: 'image/jpeg' }),
    mime: 'image/webp',
    width: 1,
    height: 1,
  })),
}));
vi.mock('@/lib/crop-source', () => ({
  loadCropSource: vi.fn(async () => ({
    width: 40,
    height: 30,
    draw: vi.fn(),
    pixels: () => ({ width: 40, height: 30, data: new Uint8ClampedArray(40 * 30 * 4) }),
    crop: vi.fn(async () => new Blob([new Uint8Array(cropSize)], { type: 'image/webp' })),
    close: vi.fn(),
  })),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  compressedSize = null;
});

function setup(fileId: string | null = null) {
  const onChange = vi.fn();
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ id: 'f-2' }), { status: 201, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ImageField fileId={fileId} onChange={onChange} onBusyChange={vi.fn()} />
    </MeContext.Provider>,
  );
  return { onChange, fetchMock };
}

async function pickAndUse() {
  fireEvent.change(screen.getByLabelText('Chụp hoặc chọn ảnh'), {
    target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
  });
  await userEvent.click(await screen.findByRole('button', { name: 'Dùng ảnh' }));
}

describe('ImageField — màn cắt', () => {
  it('ảnh cắt đúng 5 MB → tải lên', async () => {
    cropSize = FIVE_MB;
    const { onChange } = setup();
    await pickAndUse();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('f-2'));
  });

  it('sau nén còn 5 MB + 1 byte → lỗi "Ảnh lớn hơn 5 MB", không tải lên, màn cắt vẫn mở giữ vùng cắt', async () => {
    cropSize = FIVE_MB + 1;
    const { onChange, fetchMock } = setup();
    await pickAndUse();
    expect(await screen.findByRole('alert')).toHaveTextContent('Ảnh lớn hơn 5 MB — chọn ảnh nhỏ hơn.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Cắt ảnh món' })).toBeInTheDocument();
  });

  it('ảnh cắt 5 MB + 1 byte nhưng nén còn đúng 5 MB → tải lên (kiểm cỡ sau khi nén)', async () => {
    cropSize = FIVE_MB + 1;
    compressedSize = FIVE_MB;
    const { onChange } = setup();
    await pickAndUse();
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('f-2'));
  });

  it('tải lên lỗi mạng → báo lỗi, màn cắt vẫn mở để bấm Dùng ảnh lại', async () => {
    cropSize = 10;
    const { onChange, fetchMock } = setup();
    fetchMock.mockRejectedValueOnce(new TypeError('network'));
    await pickAndUse();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Cắt ảnh món' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dùng ảnh' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('f-2'));
  });

  it('món đã có ảnh: Cắt lại mở màn cắt từ /api/files/:id', async () => {
    setup('abc');
    await userEvent.click(screen.getByRole('button', { name: 'Cắt lại' }));
    expect(await screen.findByRole('dialog', { name: 'Cắt ảnh món' })).toBeInTheDocument();
    expect(loadCropSource).toHaveBeenLastCalledWith(expect.stringContaining('abc'));
  });

  it('Cắt lại: tải ảnh lỗi 500 → "Không tải được ảnh, thử lại.", không mở màn cắt', async () => {
    vi.mocked(loadCropSource).mockRejectedValueOnce(new ApiError(500, null));
    setup('abc');
    await userEvent.click(screen.getByRole('button', { name: 'Cắt lại' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được ảnh, thử lại.');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Cắt lại: 401 → không báo lỗi riêng (luồng hết phiên lo)', async () => {
    vi.mocked(loadCropSource).mockRejectedValueOnce(new ApiError(401, null));
    setup('abc');
    await userEvent.click(screen.getByRole('button', { name: 'Cắt lại' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cắt lại' })).toBeEnabled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
