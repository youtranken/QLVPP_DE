import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { MonthPicker, type MonthMark } from '@/ui/month-picker';

const marks: Record<string, MonthMark> = {
  '2026-11': { tone: 'past', label: 'Đã qua' },
  '2026-12': { tone: 'locked', label: 'Đang giao' },
  '2027-01': { tone: 'open', label: 'Đang đăng ký' },
};
const setup = (over: Partial<Parameters<typeof MonthPicker>[0]> = {}) => {
  const onPick = vi.fn();
  const onEscape = vi.fn();
  renderWithI18n(<MonthPicker value="2026-12" min="2026-11" max="2027-01" markOf={(ym) => marks[ym]} onPick={onPick} onEscape={onEscape} {...over} />);
  return { onPick, onEscape };
};
const month = (name: string | RegExp) => screen.getByRole('button', { name });

afterEach(() => void i18n.changeLanguage('vi'));

describe('MonthPicker', () => {
  it('lưới 3×4 của năm đang xem, focus sẵn ở tháng đang chọn (aria-current)', () => {
    setup();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    expect(screen.getAllByRole('gridcell')).toHaveLength(12);
    const dec = month('Tháng 12/2026 · Đang giao');
    expect(dec).toHaveFocus();
    expect(dec).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('grid', { name: '2026' })).toBeInTheDocument();
  });

  it('tháng ngoài [min, max] bị tắt; năm ngoài khoảng thì nút năm tắt', () => {
    setup();
    expect(month('Tháng 10/2026')).toBeDisabled();
    expect(month('Tháng 1/2026')).toBeDisabled();
    expect(month('Tháng 11/2026 · Đã qua')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Năm trước' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Năm sau' })).toBeEnabled();
  });

  it('nhãn trạng thái chỉ hiện ở tháng có dữ liệu', () => {
    setup();
    const grid = screen.getByRole('grid');
    expect(within(grid).getByText('Đang giao')).toBeInTheDocument();
    expect(within(grid).getByText('Đã qua')).toBeInTheDocument();
    expect(within(grid).queryByText('Đang đăng ký')).toBeNull();
    expect(month('Tháng 12/2026 · Đang giao').querySelector('.mp__mark--locked')).not.toBeNull();
  });

  it('› năm sang 2027: tháng 1 có nhãn Đang đăng ký, tháng 2 trở đi tắt; bấm tháng 1 → onPick 2027-01', async () => {
    const { onPick } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Năm sau' }));
    expect(screen.getByRole('grid', { name: '2027' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Năm sau' })).toBeDisabled();
    expect(month('Tháng 2/2027')).toBeDisabled();
    await userEvent.click(month('Tháng 1/2027 · Đang đăng ký'));
    expect(onPick).toHaveBeenCalledWith('2027-01');
  });

  it('phím: → sang tháng 1 năm sau (đổi năm theo), ← quay lại, ↑ chạm sàn thì đứng yên, Enter chọn', async () => {
    const { onPick } = setup();
    await userEvent.keyboard('{ArrowRight}');
    expect(month('Tháng 1/2027 · Đang đăng ký')).toHaveFocus();
    expect(screen.getByRole('grid', { name: '2027' })).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(month('Tháng 1/2027 · Đang đăng ký')).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(month('Tháng 11/2026 · Đã qua')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(month('Tháng 11/2026 · Đã qua')).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onPick).toHaveBeenCalledWith('2026-11');
  });

  it('↑/↓ đi 3 tháng, PageUp/PageDown đi một năm (trong khoảng cho phép)', async () => {
    setup({ value: '2026-06', min: '2025-01', max: '2027-12', markOf: undefined });
    await userEvent.keyboard('{ArrowDown}');
    expect(month('Tháng 9/2026')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(month('Tháng 3/2026')).toHaveFocus();
    await userEvent.keyboard('{PageUp}');
    expect(month('Tháng 3/2025')).toHaveFocus();
    await userEvent.keyboard('{PageUp}');
    expect(month('Tháng 1/2025')).toHaveFocus();
  });

  it('Esc gọi onEscape', async () => {
    const { onEscape } = setup();
    await userEvent.keyboard('{Escape}');
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('không có sàn thì vẫn chặn trước 01/2000', () => {
    setup({ value: '2000-03', min: undefined, max: undefined, markOf: undefined });
    expect(month('Tháng 1/2000')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Năm trước' })).toBeDisabled();
  });

  it('tiếng Anh: tên tháng bằng chữ', async () => {
    await i18n.changeLanguage('en');
    setup({ markOf: undefined });
    expect(screen.getByRole('button', { name: 'December 2026' })).toHaveTextContent('December');
  });
});
