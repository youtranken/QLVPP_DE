import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ImageField } from './image-field';

vi.mock('@/lib/image-compress', () => ({
  compressImage: vi.fn(async (f: File) => ({ blob: f, mime: 'image/webp', width: 1, height: 1 })),
}));

vi.mock('@/lib/crop-source', () => ({
  loadCropSource: vi.fn(async () => ({
    width: 40,
    height: 30,
    draw: vi.fn(),
    pixels: () => ({ width: 40, height: 30, data: new Uint8ClampedArray(40 * 30 * 4) }),
    crop: vi.fn(async () => new Blob(['x'], { type: 'image/webp' })),
    close: vi.fn(),
  })),
}));

afterEach(() => vi.unstubAllGlobals());

function pasteEvent(target: Element | Document, items: { file?: File; text?: string }[]) {
  const dt = {
    items: items.map((i) => ({
      kind: i.file ? 'file' : 'string',
      type: i.file?.type ?? 'text/plain',
      getAsFile: () => i.file ?? null,
    })),
    getData: () => items.find((i) => i.text)?.text ?? '',
  };
  const ev = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(ev, 'clipboardData', { value: dt });
  fireEvent(target, ev);
  return ev;
}

function setup() {
  const onChange = vi.fn();
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ id: 'f-1' }), { status: 201, headers: { 'content-type': 'application/json' } }),
  );
  vi.stubGlobal('fetch', fetchMock);
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <input aria-label="Tên món" />
      <ImageField fileId={null} onChange={onChange} onBusyChange={vi.fn()} />
    </MeContext.Provider>,
  );
  return { onChange, fetchMock };
}

describe('ImageField — dán ảnh Ctrl+V', () => {
  it('có gợi ý "Ctrl+V để dán ảnh" và ô chọn tệp chỉ nhận 3 loại', () => {
    setup();
    expect(screen.getByText('Ctrl+V để dán ảnh')).toBeInTheDocument();
    expect(screen.getByLabelText('Chụp hoặc chọn ảnh')).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp',
    );
  });

  it('màn cảm ứng (pointer: coarse) không có bàn phím: ẩn gợi ý Ctrl+V, vẫn chọn ảnh được', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('pointer: coarse'), media: q, addEventListener() {}, removeEventListener() {} }));
    setup();
    expect(screen.queryByText('Ctrl+V để dán ảnh')).toBeNull();
    expect(screen.getByLabelText('Chụp hoặc chọn ảnh')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])('dán %s → mở màn cắt, Dùng ảnh thì tải lên và gán ảnh', async (type) => {
    const { onChange, fetchMock } = setup();
    const ev = pasteEvent(document.body, [{ file: new File(['x'], 'p', { type }) }]);
    expect(await screen.findByRole('dialog', { name: 'Cắt ảnh món' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Dùng ảnh' }));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('f-1'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('dán image/gif → lỗi "Chỉ nhận ảnh JPG, PNG hoặc WEBP", không tải lên', async () => {
    const { onChange, fetchMock } = setup();
    pasteEvent(document.body, [{ file: new File(['x'], 'p.gif', { type: 'image/gif' }) }]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ nhận ảnh JPG, PNG hoặc WEBP');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('chọn tệp image/gif qua nút → cùng câu lỗi', async () => {
    setup();
    fireEvent.change(screen.getByLabelText('Chụp hoặc chọn ảnh'), {
      target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] },
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Chỉ nhận ảnh JPG, PNG hoặc WEBP');
  });

  it('dán chữ vào ô khác → không chặn, không lỗi, không tải lên', () => {
    const { fetchMock } = setup();
    const ev = pasteEvent(screen.getByLabelText('Tên món'), [{ text: 'Bút bi' }]);
    expect(ev.defaultPrevented).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('dán tệp không phải ảnh (PDF) vào ô khác → không chặn, không lỗi, không mở màn cắt', () => {
    const { fetchMock } = setup();
    const ev = pasteEvent(screen.getByLabelText('Tên món'), [{ file: new File(['x'], 'a.pdf', { type: 'application/pdf' }) }]);
    expect(ev.defaultPrevented).toBe(false);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('Hủy ở màn cắt → không tải lên, không đổi ảnh', async () => {
    const { onChange, fetchMock } = setup();
    pasteEvent(document.body, [{ file: new File(['x'], 'p.png', { type: 'image/png' }) }]);
    await userEvent.click(await screen.findByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
