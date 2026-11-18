import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { loadCropSource } from '@/lib/crop-source';
import { ImageField } from './image-field';

const FIVE_MB = 5 * 1024 * 1024;
let cropSize = 10;

vi.mock('@/lib/image-compress', () => ({
  compressImage: vi.fn(async (f: File) => ({ blob: f, mime: 'image/webp', width: 1, height: 1 })),
}));
vi.mock('@/lib/crop-source', () => ({
  loadCropSource: vi.fn(async () => ({
    width: 40,
    height: 30,
    draw: vi.fn(),
    pixels: () => ({ width: 40, height: 30, data: new Uint8ClampedArray(40 * 30 * 4) }),
    crop: vi.fn(async () => new Blob([new Uint8Array(cropSize)], { type: 'image/webp' })),
  })),
}));

afterEach(() => vi.unstubAllGlobals());

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

  it('ảnh cắt 5 MB + 1 byte → lỗi "Ảnh lớn hơn 5 MB", không tải lên', async () => {
    cropSize = FIVE_MB + 1;
    const { onChange, fetchMock } = setup();
    await pickAndUse();
    expect(await screen.findByRole('alert')).toHaveTextContent('Ảnh lớn hơn 5 MB — chọn ảnh nhỏ hơn.');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('món đã có ảnh: Cắt lại mở màn cắt từ /api/files/:id', async () => {
    setup('abc');
    await userEvent.click(screen.getByRole('button', { name: 'Cắt lại' }));
    expect(await screen.findByRole('dialog', { name: 'Cắt ảnh món' })).toBeInTheDocument();
    expect(loadCropSource).toHaveBeenLastCalledWith(expect.stringContaining('abc'));
  });
});
