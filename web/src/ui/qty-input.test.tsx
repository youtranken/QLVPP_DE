import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { mockViewport } from '@/test/viewport';
import { QtyInput } from '@/ui/qty-input';

function Controlled({ start, steppers = false, onChange }: { start: string; steppers?: boolean; onChange?: (t: string) => void }) {
  const [value, setValue] = useState(start);
  return (
    <QtyInput
      value={value}
      label="Đề nghị: Bút bi"
      name="Bút bi"
      max={1000}
      steppers={steppers}
      onChange={(t) => {
        setValue(t);
        onChange?.(t);
      }}
    />
  );
}

const box = () => screen.getByRole('spinbutton', { name: 'Đề nghị: Bút bi' });

describe('QtyInput', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('bấm vào ô thì tô hết số (select sau một khung hình, iOS/Android mất select gọi thẳng trong focus)', async () => {
    renderWithI18n(<Controlled start="12" />);
    const input = box() as HTMLInputElement;
    const select = vi.spyOn(input, 'select');
    await userEvent.click(input);
    await act(() => new Promise((r) => requestAnimationFrame(() => r(null))));
    expect(select).toHaveBeenCalled();
  });

  it('rời ô mà trống thì về 0, không báo lỗi', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Controlled start="12" onChange={onChange} />);
    await userEvent.clear(box());
    await userEvent.tab();
    expect(box()).toHaveValue(0);
    expect(onChange).toHaveBeenLastCalledWith('0');
  });

  it('ô có max=1000; không bật mũi tên thì không có nút', () => {
    renderWithI18n(<Controlled start="3" />);
    expect(box()).toHaveAttribute('max', '1000');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('máy tính: nút − / + của khung Stepper chung, tabIndex -1, nhãn kèm tên món; + tăng, − giảm', async () => {
    mockViewport(1280);
    renderWithI18n(<Controlled start="3" steppers />);
    const up = screen.getByRole('button', { name: 'Thêm Bút bi' });
    const down = screen.getByRole('button', { name: 'Bớt Bút bi' });
    expect(up).toHaveAttribute('tabindex', '-1');
    expect(down).toHaveAttribute('tabindex', '-1');
    expect(up.closest('.stepper')).toHaveAttribute('data-size', 'sm');
    await userEvent.click(up);
    expect(box()).toHaveValue(4);
    await userEvent.click(down);
    await userEvent.click(down);
    expect(box()).toHaveValue(2);
  });

  it.each([
    ['0', 'Bớt Bút bi', 'Thêm Bút bi'],
    ['1000', 'Thêm Bút bi', 'Bớt Bút bi'],
  ])('biên %s: nút về phía biên tắt, nút kia bật', (start, off, on) => {
    mockViewport(1280);
    renderWithI18n(<Controlled start={start} steppers />);
    expect(screen.getByRole('button', { name: off })).toBeDisabled();
    expect(screen.getByRole('button', { name: on })).toBeEnabled();
  });

  it('999 → ▲ còn bật, bấm thành 1000 rồi tắt; 1 → ▼ còn bật, bấm thành 0 rồi tắt', async () => {
    mockViewport(1280);
    const { unmount } = renderWithI18n(<Controlled start="999" steppers />);
    await userEvent.click(screen.getByRole('button', { name: 'Thêm Bút bi' }));
    expect(box()).toHaveValue(1000);
    expect(screen.getByRole('button', { name: 'Thêm Bút bi' })).toBeDisabled();
    unmount();
    renderWithI18n(<Controlled start="1" steppers />);
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Bút bi' }));
    expect(box()).toHaveValue(0);
    expect(screen.getByRole('button', { name: 'Bớt Bút bi' })).toBeDisabled();
  });

  it('số đang vượt trần (gõ 1500): ▲ tắt, ▼ đưa về 1000', async () => {
    mockViewport(1280);
    renderWithI18n(<Controlled start="1500" steppers />);
    expect(screen.getByRole('button', { name: 'Thêm Bút bi' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Bớt Bút bi' }));
    expect(box()).toHaveValue(1000);
  });

  it.each([390, 1280])('%i px: cùng một dáng "− số +" (không còn mũi tên ▲▼ 24×16)', (w) => {
    mockViewport(w);
    renderWithI18n(<Controlled start="3" steppers />);
    const wrap = box().closest('.stepper')!;
    expect(wrap.querySelector('.qty-input__spin')).toBeNull();
    const [first, , last] = Array.from(wrap.querySelectorAll('button, input'));
    expect(first).toHaveAccessibleName('Bớt Bút bi');
    expect(last).toHaveAccessibleName('Thêm Bút bi');
  });

  it('ref (prop thường, React 19) trỏ tới ô nhập, cả khi có nút − / +', () => {
    const plain = createRef<HTMLInputElement>();
    const stepped = createRef<HTMLInputElement>();
    renderWithI18n(
      <>
        <QtyInput ref={plain} value="1" onChange={() => {}} label="Ô một" max={9} />
        <QtyInput ref={stepped} value="2" onChange={() => {}} label="Ô hai" max={9} steppers />
      </>,
    );
    expect(plain.current).toBe(screen.getByRole('spinbutton', { name: 'Ô một' }));
    expect(stepped.current).toBe(screen.getByRole('spinbutton', { name: 'Ô hai' }));
  });
});
