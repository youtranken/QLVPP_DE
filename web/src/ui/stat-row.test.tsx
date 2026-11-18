import { describe, it, expect, vi } from 'vitest';
import { StatRow } from '@/ui/stat-row';
import { StatCard } from '@/ui/stat-card';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';

describe('StatRow', () => {
  it('hiện đủ các thẻ con; 3 thẻ đặt data-count=3', () => {
    const { container } = renderWithI18n(
      <StatRow>
        <StatCard label="A" value={1} />
        <StatCard label="B" value={2} />
        <StatCard label="C" value={3} />
      </StatRow>,
    );
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute('data-count', '3');
  });
  it('4 thẻ → data-count=4', () => {
    const { container } = renderWithI18n(
      <StatRow>
        <StatCard label="A" value={1} />
        <StatCard label="B" value={2} />
        <StatCard label="C" value={3} />
        <StatCard label="D" value={4} />
      </StatRow>,
    );
    expect(container.firstElementChild).toHaveAttribute('data-count', '4');
  });
});

describe('StatRow làm bộ lọc (TC-04)', () => {
  const row = (selected: string, onSelect = vi.fn()) =>
    renderWithI18n(
      <StatRow label="Lọc theo trạng thái" selected={selected} onSelect={onSelect}>
        <StatCard filterKey="pending" label="Chưa nhận" value={12} />
        <StatCard filterKey="done" label="Đã nhận đủ" value={4} />
        <StatCard filterKey="left" label="Người đã nghỉ" value={2} tone="danger" />
      </StatRow>,
    );

  it('là tablist có tên; mỗi thẻ là tab, chỉ thẻ đang chọn có aria-selected=true', () => {
    row('done');
    const list = screen.getByRole('tablist', { name: 'Lọc theo trạng thái' });
    expect(within(list).getAllByRole('tab')).toHaveLength(3);
    expect(screen.getByRole('tab', { name: /Đã nhận đủ/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /Chưa nhận/ })).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('bấm thẻ gọi onSelect(key) của thẻ đó', async () => {
    const onSelect = vi.fn();
    row('pending', onSelect);
    await userEvent.click(screen.getByRole('tab', { name: /Người đã nghỉ/ }));
    expect(onSelect).toHaveBeenCalledWith('left');
  });

  it('thẻ tone="danger" có số > 0 mang lớp stat-card--danger; thẻ thường thì không', () => {
    row('pending');
    expect(screen.getByRole('tab', { name: /Người đã nghỉ/ })).toHaveClass('stat-card--danger');
    expect(screen.getByRole('tab', { name: /Chưa nhận/ })).not.toHaveClass('stat-card--danger');
  });
});
