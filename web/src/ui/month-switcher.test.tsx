import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { MonthSwitcher } from '@/ui/month-switcher';

const labels = { group: 'Chọn tháng', prev: 'Tháng trước', next: 'Tháng sau' };
const fmt = (ym: string) => `Tháng ${ym.slice(5)}/${ym.slice(0, 4)}`;

describe('MonthSwitcher', () => {
  it('ở trần thì › vô hiệu, dưới trần thì bật', () => {
    const { unmount } = renderWithI18n(
      <MonthSwitcher value="2026-11" max="2026-11" onChange={() => {}} formatLabel={fmt} labels={labels} />,
    );
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
    unmount();
    renderWithI18n(
      <MonthSwitcher value="2026-10" max="2026-11" onChange={() => {}} formatLabel={fmt} labels={labels} />,
    );
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeEnabled();
  });

  it('nextReason: ở trần › mang chú thích lý do; dưới trần (bấm được) không có chú thích', () => {
    const { unmount } = renderWithI18n(<MonthSwitcher value="2026-11" max="2026-11" nextReason="Tháng 12 đang đăng ký" onChange={() => {}} formatLabel={fmt} labels={labels} />);
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toHaveAccessibleDescription('Tháng 12 đang đăng ký');
    unmount();
    renderWithI18n(<MonthSwitcher value="2026-10" max="2026-11" nextReason="Tháng 12 đang đăng ký" onChange={() => {}} formatLabel={fmt} labels={labels} />);
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toHaveAccessibleDescription('');
    expect(screen.getByRole('button', { name: 'Tháng sau' })).not.toHaveAttribute('title');
  });

  it('bấm › đi tháng kế', async () => {
    const onChange = vi.fn();
    renderWithI18n(<MonthSwitcher value="2026-10" onChange={onChange} formatLabel={fmt} labels={labels} />);
    await userEvent.click(screen.getByRole('button', { name: 'Tháng sau' }));
    expect(onChange).toHaveBeenCalledWith('2026-11');
  });

  it('có status thì hiện badge trạng thái kỳ; không có thì không', () => {
    const { unmount } = renderWithI18n(
      <MonthSwitcher value="2026-11" onChange={() => {}} formatLabel={fmt} labels={labels} status={{ tone: 'ok', label: 'Đang mở · hạn 10' }} />,
    );
    expect(screen.getByText('Đang mở · hạn 10')).toBeInTheDocument();
    unmount();
    renderWithI18n(<MonthSwitcher value="2026-11" onChange={() => {}} formatLabel={fmt} labels={labels} />);
    expect(screen.queryByText('Đang mở · hạn 10')).not.toBeInTheDocument();
  });

  it('beyond: kỳ sau trần hiện nút vô hiệu có nhãn "Đang mở" và tên tháng', () => {
    renderWithI18n(
      <MonthSwitcher value="2026-10" max="2026-10" onChange={() => {}} formatLabel={fmt} labels={labels} beyond={{ ym: '2026-11', label: 'Đang mở' }} />,
    );
    const open = screen.getByRole('button', { name: 'Tháng 11/2026 · Đang mở' });
    expect(open).toBeDisabled();
    expect(open).toHaveTextContent('Đang mở');
    expect(screen.getByRole('button', { name: 'Tháng sau' })).toBeDisabled();
  });

  it('có onBeyond: nút kỳ mở bấm được, gọi onBeyond, aria-pressed theo kỳ đang xem; không có: vẫn disabled như cũ', async () => {
    const onBeyond = vi.fn();
    const beyond = { ym: '2026-11', label: 'Đang mở' };
    const { unmount } = renderWithI18n(
      <MonthSwitcher value="2026-10" max="2026-10" onChange={() => {}} formatLabel={fmt} labels={labels} beyond={beyond} onBeyond={onBeyond} />,
    );
    const button = screen.getByRole('button', { name: 'Tháng 11/2026 · Đang mở' });
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(button);
    expect(onBeyond).toHaveBeenCalledTimes(1);
    unmount();
    const shown = renderWithI18n(
      <MonthSwitcher value="2026-11" max="2026-10" onChange={() => {}} formatLabel={fmt} labels={labels} beyond={beyond} onBeyond={onBeyond} />,
    );
    expect(screen.getByRole('button', { name: 'Tháng 11/2026 · Đang mở' })).toHaveAttribute('aria-pressed', 'true');
    shown.unmount();
    renderWithI18n(<MonthSwitcher value="2026-10" max="2026-10" onChange={() => {}} formatLabel={fmt} labels={labels} beyond={beyond} />);
    expect(screen.getByRole('button', { name: 'Tháng 11/2026 · Đang mở' })).toBeDisabled();
  });

  it('bấm nhãn tháng mở bảng năm-tháng; chọn tháng xa đi thẳng tới đó, bảng đóng, focus về nhãn', async () => {
    const onChange = vi.fn();
    renderWithI18n(<MonthSwitcher value="2026-12" min="2026-01" max="2027-01" onChange={onChange} formatLabel={fmt} labels={labels} />);
    const label = screen.getByRole('button', { name: 'Tháng 12/2026, bấm để chọn năm-tháng' });
    expect(label).toHaveAttribute('aria-haspopup', 'dialog');
    await userEvent.click(label);
    expect(label).toHaveAttribute('aria-expanded', 'true');
    const dialog = screen.getByRole('dialog', { name: 'Chọn năm-tháng' });
    // Trần/sàn của trang áp vào bảng: tháng sau trần tắt
    await userEvent.click(within(dialog).getByRole('button', { name: 'Năm sau' }));
    expect(within(dialog).getByRole('button', { name: 'Tháng 2/2027' })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tháng 1/2027' }));
    expect(onChange).toHaveBeenCalledWith('2027-01');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(label).toHaveFocus();
  });

  it('Esc đóng bảng và trả focus về nhãn tháng; chọn lại đúng tháng đang xem thì không gọi onChange', async () => {
    const onChange = vi.fn();
    renderWithI18n(<MonthSwitcher value="2026-12" onChange={onChange} formatLabel={fmt} labels={labels} />);
    const label = screen.getByRole('button', { name: /^Tháng 12\/2026, / });
    await userEvent.click(label);
    expect(screen.getByRole('button', { name: 'Tháng 12/2026' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(label).toHaveFocus();
    await userEvent.click(label);
    await userEvent.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    expect(label).toHaveFocus();
  });

  it('bấm ra ngoài thì đóng bảng; ‹ › vẫn đi từng tháng', async () => {
    const onChange = vi.fn();
    renderWithI18n(
      <>
        <MonthSwitcher value="2026-12" onChange={onChange} formatLabel={fmt} labels={labels} />
        <p>ngoài</p>
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Tháng 12\/2026, / }));
    await userEvent.click(screen.getByText('ngoài'));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    expect(onChange).toHaveBeenCalledWith('2026-11');
  });
});
