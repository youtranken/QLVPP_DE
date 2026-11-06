import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { memberItem } from '@/test/fixtures-request';
import { ItemCard } from './item-card';
import type { CartLine } from './use-cart';

const ITEM = memberItem({ id: 'i-1', name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'cay', max_qty: 5, category_id: 'c-1' });
const line = (qty: number, extra: Partial<CartLine> = {}) => ({ key: 'i-1', qty, ...extra }) as CartLine;
const view = (l: CartLine | undefined, onQty = vi.fn()) => {
  renderWithI18n(<ItemCard item={ITEM} line={l} tone="g1" groupLabel="Bút & viết" onQty={onQty} />);
  return onQty;
};

describe('ItemCard', () => {
  it('chưa chọn → nút "Thêm vào phiếu" gọi onChange(1); không có stepper, không badge', async () => {
    const onQty = view(undefined);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Bút bi xanh' }));
    expect(onQty).toHaveBeenCalledWith(1);
    expect(screen.getByText('Thêm vào phiếu')).toBeInTheDocument();
    expect(screen.getByText('Bút & viết')).toBeInTheDocument();
  });
  it('đã chọn qty = max → "+" vô hiệu; "−" ở 1 → 0 (bỏ khỏi phiếu); badge = qty', async () => {
    view(line(5));
    expect(screen.getByRole('button', { name: 'Thêm Bút bi xanh' })).toBeDisabled();
    expect(screen.getByTestId('pick-badge')).toHaveTextContent('5');
  });
  it('qty 1 → bấm Bớt gọi onChange(0)', async () => {
    const onQty = view(line(1));
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Bút bi xanh' }));
    expect(onQty).toHaveBeenCalledWith(0);
  });
  it('không bao giờ hiện tồn kho / hết hàng', () => {
    const { container } = renderWithI18n(<ItemCard item={ITEM} line={line(2)} tone="g1" groupLabel="x" onQty={vi.fn()} />);
    expect(container.textContent).not.toMatch(/hết|tồn|sắp hết/i);
  });
  it('ghi chú "đvt, tối đa N/tháng" và ghi chú gói', () => {
    view(undefined);
    expect(screen.getByText(/tối đa 5\/tháng/)).toBeInTheDocument();
  });
  it('dòng chỉ đọc (Hành chính thêm) → không stepper, không nút thêm', () => {
    view(line(3, { readonly: true, added_by_admin: true }));
    expect(screen.queryByRole('button', { name: /Thêm Bút/ })).toBeNull();
    expect(screen.getByText('Hành chính thêm · 3')).toBeInTheDocument();
  });
});
