import { describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { render, screen, userEvent } from '@/test/test-utils';
import { useSummaryParams } from './use-summary-params';

function Probe() {
  const p = useSummaryParams('2026-11');
  const navigate = useNavigate();
  const { search } = useLocation();
  return (
    <>
      <output data-testid="search">{search}</output>
      <button type="button" onClick={() => p.openAdjust('r-2')}>open</button>
      <button type="button" onClick={() => p.stepAdjust('r-3')}>step</button>
      <button type="button" onClick={() => navigate(-1)}>back</button>
    </>
  );
}

describe('useSummaryParams — ?request=', () => {
  it('mở ngăn kéo thêm mục lịch sử; ↑/↓ (stepAdjust) thay tại chỗ → Back về trang trước khi mở, không qua từng người', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/summary?ym=2026-11']}>
        <Probe />
      </MemoryRouter>,
    );
    const search = () => screen.getByTestId('search').textContent;
    await userEvent.click(screen.getByRole('button', { name: 'open' }));
    expect(search()).toContain('request=r-2');
    await userEvent.click(screen.getByRole('button', { name: 'step' }));
    expect(search()).toContain('request=r-3');
    await userEvent.click(screen.getByRole('button', { name: 'back' }));
    expect(search()).toBe('?ym=2026-11');
  });
});
