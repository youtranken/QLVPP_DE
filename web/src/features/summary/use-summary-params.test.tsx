import { describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, userEvent } from '@/test/test-utils';
import { useSummaryParams } from './use-summary-params';

function Probe() {
  const p = useSummaryParams('2026-11');
  const { search } = useLocation();
  return (
    <>
      <output data-testid="search">{search}</output>
      <output data-testid="item">{p.item ?? ''}</output>
      <button type="button" onClick={p.clearItem}>clear item</button>
      <button type="button" onClick={() => p.setView('person')}>person</button>
    </>
  );
}

describe('useSummaryParams — ?item=', () => {
  it('đọc item khi view=item; bỏ lọc món xóa item khỏi URL; đổi sang theo người cũng bỏ item', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/summary?ym=2026-11&view=item&item=i-a4']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('item')).toHaveTextContent('i-a4');
    await userEvent.click(screen.getByRole('button', { name: 'clear item' }));
    expect(screen.getByTestId('search').textContent).toBe('?ym=2026-11&view=item');
    expect(screen.getByTestId('item')).toHaveTextContent('');
  });

  it('view=person thì item không có hiệu lực', () => {
    render(
      <MemoryRouter initialEntries={['/admin/summary?ym=2026-11&item=i-a4']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('item')).toHaveTextContent('');
  });
});
