import { describe, it, expect } from 'vitest';
import { StatRow } from '@/ui/stat-row';
import { StatCard } from '@/ui/stat-card';
import { renderWithI18n, screen } from '@/test/test-utils';

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
