import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { memberItem } from '@/test/fixtures-request';
import { ItemCard } from './item-card';
import type { CartLine } from './use-cart';

const ITEM = memberItem({ id: 'i-1', name: 'Bút bi xanh', name_en: 'Blue pen', unit: 'cay', pack_note: 'hộp 10', max_qty: 5, category_id: 'c-1' });
const line = (qty: number, extra: Partial<CartLine> = {}) => ({ key: 'i-1', qty, ...extra }) as CartLine;
const view = (l: CartLine | undefined, onQty = vi.fn()) => {
  renderWithI18n(<ItemCard item={ITEM} line={l} tone="g1" groupLabel="Bút & viết" onQty={onQty} />);
  return onQty;
};
const ADD = 'Thêm vào phiếu: Bút bi xanh';

describe('ItemCard', () => {
  it('chưa chọn → nút "Thêm vào phiếu" (tên chứa chữ hiển thị) gọi onChange(1); không stepper, không badge', async () => {
    const onQty = view(undefined);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByTestId('pick-badge')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: ADD }));
    expect(onQty).toHaveBeenCalledWith(1);
    expect(screen.getByText('Thêm vào phiếu')).toBeInTheDocument();
    expect(screen.getByText('Bút & viết')).toBeInTheDocument();
  });
  it('đã chọn qty = max → "+" vô hiệu; badge = qty', () => {
    view(line(5));
    expect(screen.getByRole('button', { name: 'Thêm Bút bi xanh' })).toBeDisabled();
    expect(screen.getByTestId('pick-badge')).toHaveTextContent('5');
  });
  it('qty = max − 1 → "+" còn bấm được và gọi onChange(max)', async () => {
    const onQty = view(line(4));
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Bút bi xanh' }));
    expect(onQty).toHaveBeenCalledWith(5);
  });
  it('gõ số lớn hơn max → kẹp về max', async () => {
    const onQty = view(line(1));
    await userEvent.clear(screen.getByRole('spinbutton', { name: 'Bút bi xanh' }));
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Bút bi xanh' }), '9');
    expect(onQty).toHaveBeenLastCalledWith(5);
  });
  it('qty 1 → bấm Bớt gọi onChange(0)', async () => {
    const onQty = view(line(1));
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Bút bi xanh' }));
    expect(onQty).toHaveBeenCalledWith(0);
  });
  it('về 0 bằng Bớt → focus chuyển sang nút "Thêm vào phiếu" mới', async () => {
    function Harness() {
      const [qty, setQty] = useState(1);
      return <ItemCard item={ITEM} line={qty ? line(qty) : undefined} tone="g1" groupLabel={null} onQty={setQty} />;
    }
    renderWithI18n(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Bút bi xanh' }));
    expect(screen.getByRole('button', { name: ADD })).toHaveFocus();
  });
  it('không bao giờ hiện tồn kho / hết hàng', () => {
    const { container } = renderWithI18n(<ItemCard item={ITEM} line={line(2)} tone="g1" groupLabel="x" onQty={vi.fn()} />);
    expect(container.textContent).not.toMatch(/hết|tồn|sắp hết/i);
  });
  it('hiện "đvt · tối đa N/tháng" và ghi chú gói; tên đầy đủ nằm ở title', () => {
    view(undefined);
    expect(screen.getByText(/tối đa 5\/tháng/)).toBeInTheDocument();
    expect(screen.getByText(/hộp 10/)).toBeInTheDocument();
    expect(screen.getByTitle('Bút bi xanh')).toBeInTheDocument();
  });
  it('dòng chỉ đọc (Hành chính thêm) → không stepper, không nút thêm', () => {
    view(line(3, { readonly: true, added_by_admin: true }));
    expect(screen.queryByRole('button', { name: /Thêm/ })).toBeNull();
    expect(screen.getByText('Hành chính thêm · 3')).toBeInTheDocument();
  });
});

describe('ItemCard — tiếng Anh', () => {
  it('en: hiện name_en và nút "Add to order: Blue pen"', async () => {
    const i18n = (await import('@/lib/i18n')).default;
    await i18n.changeLanguage('en');
    try {
      view(undefined);
      expect(screen.getByText('Blue pen')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add to order: Blue pen' })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});
