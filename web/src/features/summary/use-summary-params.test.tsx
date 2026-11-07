import { describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';
import { useSummaryParams } from './use-summary-params';

function Probe() {
  const p = useSummaryParams('2026-11');
  const { search } = useLocation();
  return (
    <>
      <output data-testid="search">{search}</output>
      <output data-testid="item">{p.item ?? ''}</output>
      <output data-testid="ym">{p.ym ?? ''}</output>
      <output data-testid="view">{p.view}</output>
      <button type="button" onClick={p.clearItem}>clear item</button>
      <button type="button" onClick={() => p.setView('person')}>person</button>
    </>
  );
}

describe('useSummaryParams — ?item=', () => {
  it('đọc item khi view=item; bỏ lọc món xóa item khỏi URL; đổi sang theo người cũng bỏ item', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/summary?ym=2026-10&view=item&item=i-a4']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('item')).toHaveTextContent('i-a4');
    await userEvent.click(screen.getByRole('button', { name: 'clear item' }));
    expect(screen.getByTestId('search').textContent).toBe('?ym=2026-10&view=item');
    expect(screen.getByTestId('item')).toHaveTextContent('');
  });

  it('view=person thì item không có hiệu lực', () => {
    render(
      <MemoryRouter initialEntries={['/admin/summary?ym=2026-10&item=i-a4']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('item')).toHaveTextContent('');
  });
});

describe('useSummaryParams — chỉ kỳ đã khóa', () => {
  it('?ym=2026-11 (kỳ đang mở, chỉ xem) → giữ nguyên, URL không đổi', () => {
    render(
      <MemoryRouter initialEntries={['/admin/summary?ym=2026-11']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('ym')).toHaveTextContent('2026-11');
    expect(screen.getByTestId('search').textContent).toBe('?ym=2026-11');
  });

  it.each(['2026-12', 'abc'])('?ym=%s (tương lai / sai) → kỳ khóa 2026-10, URL thay theo', async (asked) => {
    render(
      <MemoryRouter initialEntries={[`/admin/summary?ym=${asked}`]}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('ym')).toHaveTextContent('2026-10');
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?ym=2026-10'));
  });

  it('?ym=2026-10 (kỳ khóa gần nhất) giữ nguyên; lọc chỉ-kỳ-khóa giữ được', () => {
    render(
      <MemoryRouter initialEntries={['/admin/summary?ym=2026-10&filter=over_max']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('ym')).toHaveTextContent('2026-10');
    expect(screen.getByTestId('search').textContent).toBe('?ym=2026-10&filter=over_max');
  });
});

describe('useSummaryParams — view=items là bí danh của view=item', () => {
  it('?view=items → xem theo món, URL chuẩn hóa thành view=item', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/summary?ym=2026-10&view=items&item=i-a4']}>
        <Probe />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('view')).toHaveTextContent('item');
    expect(screen.getByTestId('item')).toHaveTextContent('i-a4');
    await waitFor(() => expect(screen.getByTestId('search').textContent).toBe('?ym=2026-10&view=item&item=i-a4'));
  });
});
