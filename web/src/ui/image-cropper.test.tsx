import { describe, expect, it, vi } from 'vitest';
import { fireEvent, renderWithI18n, screen, userEvent } from '@/test/test-utils';
import type { CropSource } from '@/lib/crop-source';
import { ImageCropper } from './image-cropper';

function fakeSource(): CropSource {
  const width = 200;
  const height = 100;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 10; y < 90; y++) for (let x = 20; x < 180; x++) data.set([0, 0, 0, 255], (y * width + x) * 4);
  return { width, height, draw: vi.fn(), pixels: () => ({ width, height, data }), crop: vi.fn() };
}

function setup() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  renderWithI18n(<ImageCropper title="Cắt ảnh món" source={fakeSource()} onConfirm={onConfirm} onCancel={onCancel} />);
  return { onConfirm, onCancel, box: screen.getByRole('group', { name: 'Khung cắt' }) };
}

describe('ImageCropper', () => {
  it('mở với khung bằng cả ảnh, hiện cỡ "200 × 100 px"', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Cắt ảnh món' })).toBeInTheDocument();
    expect(screen.getByText('200 × 100 px')).toBeInTheDocument();
  });

  it('Tự cắt viền trắng → khung ôm nội dung 160 × 80, Dùng ảnh trả đúng khung', async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Tự cắt viền trắng' }));
    expect(screen.getByText('160 × 80 px')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dùng ảnh' }));
    expect(onConfirm).toHaveBeenCalledWith({ x: 20, y: 10, w: 160, h: 80 });
  });

  it('Dùng cả ảnh đưa khung về toàn ảnh', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: 'Tự cắt viền trắng' }));
    await userEvent.click(screen.getByRole('button', { name: 'Dùng cả ảnh' }));
    expect(screen.getByText('200 × 100 px')).toBeInTheDocument();
  });

  it('Shift+mũi tên trái thu cạnh phải 10 px; mũi tên dời khung', async () => {
    const { box, onConfirm } = setup();
    fireEvent.keyDown(box, { key: 'ArrowLeft', shiftKey: true });
    expect(screen.getByText('190 × 100 px')).toBeInTheDocument();
    fireEvent.keyDown(box, { key: 'ArrowRight' });
    await userEvent.click(screen.getByRole('button', { name: 'Dùng ảnh' }));
    expect(onConfirm).toHaveBeenCalledWith({ x: 10, y: 0, w: 190, h: 100 });
  });

  it('kéo tay nắm góc dưới phải bằng con trỏ thu khung, không nhỏ hơn 16 × 16', () => {
    setup();
    const handle = screen.getByTestId('crop-handle-se');
    fireEvent.pointerDown(handle, { clientX: 200, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 150, clientY: 60, pointerId: 1 });
    expect(screen.getByText('150 × 60 px')).toBeInTheDocument();
    fireEvent.pointerMove(handle, { clientX: -500, clientY: -500, pointerId: 1 });
    expect(screen.getByText('16 × 16 px')).toBeInTheDocument();
    fireEvent.pointerUp(handle, { pointerId: 1 });
  });

  it('Hủy → gọi onCancel, không xác nhận', async () => {
    const { onCancel, onConfirm } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
