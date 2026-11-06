import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import i18n from '@/lib/i18n';
import { CartPanel } from './cart-panel';
import type { CartLine } from './use-cart';

const mk = (n: number, over: Partial<CartLine> = {}): CartLine => ({
  key: `k${n}`,
  item_id: `i${n}`,
  custom_name: null,
  custom_unit: null,
  custom_note: null,
  image_file_id: null,
  qty: n,
  min: 1,
  max: 5,
  readonly: false,
  added_by_admin: false,
  review_status: null,
  label: { name: `Món ${n}`, name_en: `Item ${n}`, unit: 'cay', pack_note: null, image_file_id: null, category_id: null },
  lowered: null,
  ...over,
});

type Props = Partial<Parameters<typeof CartPanel>[0]>;
const show = (props: Props = {}) => {
  const fns = { onQty: vi.fn(), onRemove: vi.fn(), onSave: vi.fn(), onAddCustom: vi.fn(), onEdit: vi.fn() };
  renderWithI18n(
    <MeContext.Provider value={makeMe('member')}>
      <CartPanel
        lines={[]}
        errors={{}}
        categories={[]}
        month={11}
        prevMonth={10}
        dirty={false}
        saved={null}
        showSave
        saveLabel="Lưu phiếu"
        canSave={false}
        panelRef={createRef()}
        {...fns}
        {...props}
      />
    </MeContext.Provider>,
  );
  return fns;
};
const aside = () => screen.getByRole('complementary', { name: 'Phiếu tháng 11' });

describe('CartPanel', () => {
  it('rỗng: khung "Chưa có món nào" nhắc chép lại tháng trước; đầu phiếu "0 loại món · 0 đơn vị" + chip Chưa lưu', () => {
    show();
    expect(within(aside()).getByText(/Chưa có món nào\. Bấm “Thêm vào phiếu” ở món cần dùng, hoặc chép lại danh sách tháng 10\./)).toBeInTheDocument();
    expect(within(aside()).getByText('0 loại món · 0 đơn vị')).toBeInTheDocument();
    expect(within(aside()).getByText('Chưa lưu')).toBeInTheDocument();
    expect(within(aside()).getByText('Phiếu chỉ được tính khi bạn bấm Lưu phiếu.')).toBeInTheDocument();
  });

  it('rỗng và không có tháng trước: câu nhắc không nhắc chép lại', () => {
    show({ prevMonth: null });
    expect(within(aside()).getByText('Chưa có món nào. Bấm “Thêm vào phiếu” ở món cần dùng.')).toBeInTheDocument();
  });

  it('chip "Chưa lưu" khi dirty (kể cả đã có bản lưu); "Đã lưu" + ghi chú giờ khi đã lưu và không dirty', () => {
    show({ lines: [mk(1)], dirty: true, saved: { time: '09:41', lastDay: '10/11' } });
    expect(within(aside()).getByText('Chưa lưu')).toBeInTheDocument();
    expect(within(aside()).queryByText('Đã lưu')).toBeNull();
  });

  it('đã lưu, không dirty: chip "Đã lưu", ghi chú "Đã lưu lúc 09:41. Bạn vẫn sửa được tới hết 10/11."', () => {
    show({ lines: [mk(1), mk(2)], saved: { time: '09:41', lastDay: '10/11' } });
    expect(within(aside()).getByText('Đã lưu')).toBeInTheDocument();
    expect(within(aside()).getByText('Đã lưu lúc 09:41. Bạn vẫn sửa được tới hết 10/11.')).toBeInTheDocument();
    expect(within(aside()).getByText('2 loại món · 3 đơn vị')).toBeInTheDocument();
  });

  it('16 dòng: danh sách là vùng cuộn riêng, nút Lưu phiếu nằm ngoài vùng cuộn', () => {
    show({ lines: Array.from({ length: 16 }, (_, i) => mk(i + 1)), dirty: true, canSave: true });
    const list = within(aside()).getByRole('list');
    expect(list.querySelectorAll('li')).toHaveLength(16);
    expect(list.classList.contains('rq-lines')).toBe(true); // cuộn thật được Playwright V2C-T5 kiểm bằng scrollHeight
    expect(list.contains(within(aside()).getByRole('button', { name: 'Lưu phiếu' }))).toBe(false);
  });

  it('dòng: tên, "qty đvt", stepper − +, nút bỏ; gọi onQty/onRemove đúng khóa', async () => {
    const fns = show({ lines: [mk(2)] });
    expect(within(aside()).getByText('Món 2')).toBeInTheDocument();
    expect(within(aside()).getByText('2 cây')).toBeInTheDocument();
    await userEvent.click(within(aside()).getByRole('button', { name: 'Thêm Món 2' }));
    expect(fns.onQty).toHaveBeenCalledWith('k2', 3);
    await userEvent.click(within(aside()).getByRole('button', { name: 'Bỏ Món 2' }));
    expect(fns.onRemove).toHaveBeenCalledWith('k2');
  });

  it('thứ tự Tab trong dòng: tên → stepper (− ô +) → nút Bỏ cuối cùng', () => {
    show({ lines: [mk(2)] });
    const li = within(aside()).getByText('Món 2').closest('li')!;
    const stepper = within(li).getByRole('spinbutton', { name: 'Món 2' });
    const remove = within(li).getByRole('button', { name: 'Bỏ Món 2' });
    expect(stepper.compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(li).getByRole('button', { name: 'Thêm Món 2' }).compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('lỗi dòng gắn vào đúng dòng (aria-describedby, aria-invalid), dòng có data-line-key để focus', () => {
    show({ lines: [mk(1), mk(2)], errors: { k2: 'Vượt mức tối đa' } });
    const li = within(aside()).getByText('Món 2').closest('li')!;
    expect(li).toHaveAttribute('data-line-key', 'k2');
    expect(within(li).getByText('Vượt mức tối đa')).toBeInTheDocument();
    expect(within(li).getByRole('spinbutton', { name: 'Món 2' })).toHaveAttribute('aria-invalid', 'true');
    expect(within(within(aside()).getByText('Món 1').closest('li')!).queryByText('Vượt mức tối đa')).toBeNull();
  });

  it('dòng ngoài danh mục: nhãn + trạng thái xem + bấm tên để sửa; dòng Hành chính thêm chỉ đọc không stepper', async () => {
    const custom = mk(3, { item_id: null, id: 'L3', review_status: 'pending', custom_name: 'Giấy lạ', label: { ...mk(3).label, name: 'Giấy lạ' } });
    const admin = mk(4, { readonly: true, added_by_admin: true });
    const fns = show({ lines: [custom, admin] });
    expect(within(aside()).getByText('Ngoài danh mục')).toBeInTheDocument();
    expect(within(aside()).getByText('Chờ Hành chính xem')).toBeInTheDocument();
    await userEvent.click(within(aside()).getByRole('button', { name: 'Sửa Giấy lạ' }));
    expect(fns.onEdit).toHaveBeenCalledWith('k3');
    const li = within(aside()).getByText('Món 4').closest('li')!;
    expect(within(li).queryByRole('spinbutton')).toBeNull();
    expect(within(li).getByText('Hành chính thêm')).toBeInTheDocument();
  });

  it('en: tên theo ngôn ngữ, tiêu đề và chip tiếng Anh', async () => {
    await i18n.changeLanguage('en');
    try {
      show({ lines: [mk(1)], dirty: true });
      expect(screen.getByRole('complementary', { name: 'Order for month 11' })).toBeInTheDocument();
      const a = screen.getByRole('complementary');
      expect(within(a).getByText('Item 1')).toBeInTheDocument();
      expect(within(a).queryByText('Món 1')).toBeNull();
      expect(within(a).getByText('Unsaved')).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('vi');
    }
  });

  it('showSave=false (điện thoại): không có nút Lưu phiếu trong phiếu', () => {
    show({ lines: [mk(1)], showSave: false });
    expect(within(aside()).queryByRole('button', { name: 'Lưu phiếu' })).toBeNull();
  });
});
