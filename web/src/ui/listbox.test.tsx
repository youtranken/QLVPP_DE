import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { Listbox } from '@/ui/listbox';
import { Dialog, DialogTitle } from '@/ui/dialog';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

const OPTIONS = [
  { value: 'a4', label: 'Giấy A4' },
  { value: 'bb', label: 'Bút bi xanh' },
  { value: 'bc', label: 'Bút chì' },
  { value: 'old', label: 'Bút xóa cũ', disabled: true },
  { value: 'kg', label: 'Kẹp giấy' },
];

function Harness({ onChange = vi.fn(), initial = 'a4', placeholder }: { onChange?: (v: string) => void; initial?: string; placeholder?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Listbox
      aria-label="Món"
      value={value}
      options={OPTIONS}
      placeholder={placeholder}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

const box = () => screen.getByRole('combobox', { name: 'Món' });
const active = () => document.getElementById(box().getAttribute('aria-activedescendant') ?? '');

describe('Listbox — combobox chỉ-chọn', () => {
  it('đóng: role=combobox, aria-haspopup=listbox, aria-expanded=false, hiện nhãn mục đang chọn', () => {
    renderWithI18n(<Harness />);
    expect(box()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(box()).toHaveAttribute('aria-expanded', 'false');
    expect(box()).toHaveTextContent('Giấy A4');
  });

  it('giá trị không khớp lựa chọn nào → hiện chữ gợi ý', () => {
    renderWithI18n(<Harness initial="" placeholder="Chọn món" />);
    expect(box()).toHaveTextContent('Chọn món');
  });

  it('L5 vòng 8: giá trị lạ, không có placeholder → hiện lựa chọn đầu như <select> cũ (không để nút trống), không tô màu placeholder', () => {
    renderWithI18n(<Harness initial="khong-con" />);
    expect(box()).toHaveTextContent('Giấy A4');
    expect(box().querySelector('[data-placeholder]')).toBeNull();
  });

  it('bàn phím: ↓ mở ở mục đang chọn, ↓↓ bỏ qua mục tắt, Enter chọn và đóng; focus ở lại nút', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Harness onChange={onChange} />);
    box().focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(box()).toHaveAttribute('aria-expanded', 'true');
    expect(active()).toHaveTextContent('Giấy A4');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(active()).toHaveTextContent('Kẹp giấy');
    await userEvent.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith('kg');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(box()).toHaveFocus();
  });

  it('Home/End nhảy mục đầu/cuối; Escape đóng không đổi giá trị', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Harness onChange={onChange} />);
    box().focus();
    await userEvent.keyboard('{End}');
    expect(active()).toHaveTextContent('Kẹp giấy');
    await userEvent.keyboard('{Home}');
    expect(active()).toHaveTextContent('Giấy A4');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('gõ tìm không dấu: "bu" → "Bút bi xanh"; gõ lặp "b" xoay vòng sang "Bút chì"', async () => {
    renderWithI18n(<Harness />);
    box().focus();
    await userEvent.keyboard('bu');
    expect(box()).toHaveAttribute('aria-expanded', 'true');
    expect(active()).toHaveTextContent('Bút bi xanh');
    await new Promise((r) => setTimeout(r, 700));
    await userEvent.keyboard('b');
    expect(active()).toHaveTextContent('Bút chì');
  });

  it('bấm mục tắt không chọn; bấm ra ngoài thì đóng', async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <>
        <Harness onChange={onChange} />
        <button type="button">ngoài</button>
      </>,
    );
    await userEvent.click(box());
    const off = screen.getByRole('option', { name: 'Bút xóa cũ' });
    expect(off).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(off);
    expect(onChange).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'ngoài' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('trong hộp thoại: Escape chỉ đóng danh sách, hộp vẫn mở', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogTitle>Xuất lẻ</DialogTitle>
        <Harness />
      </Dialog>,
    );
    await userEvent.click(box());
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Xuất lẻ' })).toBeInTheDocument();
  });
});
