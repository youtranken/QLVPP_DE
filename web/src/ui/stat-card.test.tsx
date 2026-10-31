import { describe, it, expect, vi } from 'vitest';
import { StatCard } from '@/ui/stat-card';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

describe('StatCard', () => {
  it('có onClick → role button, bấm gọi onClick', async () => {
    const onClick = vi.fn();
    renderWithI18n(<StatCard label="Sắp hết" value={3} onClick={onClick} />);
    await userEvent.click(screen.getByRole('button', { name: /Sắp hết/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
  it('aria-pressed phản ánh pressed true và false', () => {
    const { rerender } = renderWithI18n(<StatCard label="A" value={1} onClick={() => {}} pressed />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    rerender(<StatCard label="A" value={1} onClick={() => {}} pressed={false} />);
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });
  it('không onClick → không có role button, vẫn hiện nhãn, số, đơn vị, dòng phụ', () => {
    renderWithI18n(<StatCard label="Tổng" value={12} unit="món" sub="tháng 11" />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('Tổng')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('món')).toBeInTheDocument();
    expect(screen.getByText('tháng 11')).toBeInTheDocument();
  });
  it('meter kẹp trong 0–100%: 1.25 → 100%, 0.5 → 50%, −1 → 0%; không meter thì không có thanh', () => {
    const width = () => (document.querySelector('[data-meter] > span') as HTMLElement).style.width;
    const { rerender } = renderWithI18n(<StatCard label="A" value={1} meter={1.25} />);
    expect(width()).toBe('100%');
    rerender(<StatCard label="A" value={1} meter={0.5} />);
    expect(width()).toBe('50%');
    rerender(<StatCard label="A" value={1} meter={-1} />);
    expect(width()).toBe('0%');
    rerender(<StatCard label="A" value={1} />);
    expect(document.querySelector('[data-meter]')).toBeNull();
  });
});
