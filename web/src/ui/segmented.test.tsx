import { describe, it, expect, vi } from 'vitest';
import { Segmented } from '@/ui/segmented';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { mockViewport } from '@/test/viewport';

const opts = [
  { value: 'a', label: 'Một', count: 6 },
  { value: 'b', label: 'Hai' },
  { value: 'c', label: 'Ba' },
];

describe('Segmented', () => {
  it('radiogroup có nhãn; mục chọn aria-checked=true, còn lại false; hiện count', () => {
    renderWithI18n(<Segmented label="Chế độ" value="b" options={opts} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Chế độ' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: /Một/ })).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('6')).toBeInTheDocument();
  });
  it('đếm tách khỏi nhãn trong tên truy cập: "Một, 6"', () => {
    renderWithI18n(<Segmented label="Chế độ" value="b" options={opts} onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Một, 6' })).toBeInTheDocument();
  });
  it('đếm 0 gắn data-zero để tô trung tính; đếm 1 thì không', () => {
    const counts = [
      { value: 'a', label: 'Một', count: 0 },
      { value: 'b', label: 'Hai', count: 1 },
    ];
    renderWithI18n(<Segmented label="x" value="a" options={counts} onChange={() => {}} />);
    expect(screen.getByText('0')).toHaveAttribute('data-zero');
    expect(screen.getByText('1')).not.toHaveAttribute('data-zero');
  });
  it('chỉ tab cần xử lý (urgent) có số > 0 mới tô đỏ (data-urgent); "Tất cả 3", "Đã chấp nhận 1" trung tính', () => {
    const counts = [
      { value: 'p', label: 'Chờ xem', count: 2, urgent: true },
      { value: 'z', label: 'Chờ khác', count: 0, urgent: true },
      { value: 'a', label: 'Đã chấp nhận', count: 1 },
      { value: 't', label: 'Tất cả', count: 3 },
    ];
    renderWithI18n(<Segmented label="x" value="t" options={counts} onChange={() => {}} />);
    expect(screen.getByText('2')).toHaveAttribute('data-urgent');
    for (const n of ['0', '1', '3']) expect(screen.getByText(n)).not.toHaveAttribute('data-urgent');
  });
  it('ArrowRight từ mục cuối quay về mục đầu và gọi onChange', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Segmented label="x" value="c" options={opts} onChange={onChange} />);
    screen.getByRole('radio', { name: 'Ba' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenCalledWith('a');
  });
  it('ArrowLeft từ mục đầu quay về mục cuối; ArrowRight giữa đi tới', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Segmented label="x" value="a" options={opts} onChange={onChange} />);
    screen.getByRole('radio', { name: /Một/ }).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('c');
    screen.getByRole('radio', { name: /Một/ }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('b');
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveFocus();
  });
  it('bấm mục gọi onChange; chỉ mục chọn nằm trong thứ tự tab', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Segmented label="x" value="b" options={opts} onChange={onChange} />);
    expect(screen.getByRole('radio', { name: 'Hai' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'Ba' })).toHaveAttribute('tabindex', '-1');
    await userEvent.click(screen.getByRole('radio', { name: 'Ba' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('dưới 480 (mặc định compactBelow): hiện combobox cùng lựa chọn kèm số, chọn → onChange cùng giá trị', async () => {
    mockViewport(479);
    const onChange = vi.fn();
    renderWithI18n(<Segmented label="Chế độ" value="b" options={opts} onChange={onChange} />);
    expect(screen.queryByRole('radiogroup')).toBeNull();
    const box = screen.getByRole('combobox', { name: 'Chế độ' });
    expect(box).toHaveTextContent('Hai');
    await userEvent.click(box);
    await userEvent.click(screen.getByRole('option', { name: /Một/ }));
    expect(onChange).toHaveBeenCalledWith('a');
    vi.unstubAllGlobals();
  });

  it('dưới 480 nhưng chỉ hai lựa chọn → vẫn là radiogroup (công tắc)', () => {
    mockViewport(390);
    renderWithI18n(<Segmented label="Xem" value="a" options={opts.slice(0, 2)} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Xem' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('đúng 480: vẫn là radiogroup (biên dưới của compactBelow)', () => {
    mockViewport(480);
    renderWithI18n(<Segmented label="Chế độ" value="b" options={opts} onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Chế độ' })).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
