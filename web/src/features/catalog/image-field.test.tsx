import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ImageField } from './image-field';

vi.mock('@/lib/image-compress', () => ({ compressImage: vi.fn(async () => ({ error: 'decode' })) }));

afterEach(() => vi.unstubAllGlobals());

describe('ImageField — chữ dưới ô ảnh', () => {
  it('chưa lỗi: gợi ý thường, không có alert', () => {
    renderWithI18n(
      <MeContext.Provider value={makeMe('admin')}>
        <ImageField fileId={null} onChange={vi.fn()} onBusyChange={vi.fn()} />
      </MeContext.Provider>,
    );
    expect(screen.getByText(/^JPG, PNG hoặc WEBP tới 5 MB/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ảnh không đọc được → lỗi dưới ô ảnh có role=alert, ô chọn trỏ aria-describedby vào lỗi', async () => {
    renderWithI18n(
      <MeContext.Provider value={makeMe('admin')}>
        <ImageField fileId={null} onChange={vi.fn()} onBusyChange={vi.fn()} />
      </MeContext.Provider>,
    );
    const input = screen.getByLabelText('Chụp hoặc chọn ảnh');
    await userEvent.upload(input, new File(['x'], 'hong.jpg', { type: 'image/jpeg' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Chọn ảnh JPG, PNG hoặc WebP');
    expect(input).toHaveAttribute('aria-describedby', alert.id);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('lỗi từ form (prop error) hiện dưới ô nhưng không đọc trùng với hộp tóm tắt của form', () => {
    renderWithI18n(
      <MeContext.Provider value={makeMe('admin')}>
        <ImageField fileId={null} error="Món phải có ảnh — chọn hoặc chụp một ảnh." onChange={vi.fn()} onBusyChange={vi.fn()} />
      </MeContext.Provider>,
    );
    expect(screen.getByText('Món phải có ảnh — chọn hoặc chụp một ảnh.')).toHaveClass('ff-error');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
