import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { renderHook, waitFor } from '@testing-library/react';
import { useMonthParams } from './use-month-params';

function wrapper(initial: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
}

function setup(initial: string, openYm = '2026-11') {
  return renderHook(
    () => {
      const p = useMonthParams(openYm);
      return { p, search: useLocation().search };
    },
    { wrapper: wrapper(initial) },
  );
}

describe('useMonthParams', () => {
  it('không có ?ym → kỳ khóa gần nhất 2026-10 và ghi vào URL (replace)', async () => {
    const { result } = setup('/admin/month');
    expect(result.current.p.ym).toBe('2026-10');
    await waitFor(() => expect(result.current.search).toBe('?ym=2026-10'));
  });

  it('?ym=kỳ mở hợp lệ giữ nguyên (xem kỳ đang đăng ký)', () => {
    const { result } = setup('/admin/month?ym=2026-11');
    expect(result.current.p.ym).toBe('2026-11');
    expect(result.current.search).toBe('?ym=2026-11');
  });

  it.each(['2026-12', 'abc', '2026-13', '1999-01'])('?ym=%s (tương lai/sai mẫu) → thay về 2026-10', async (bad) => {
    const { result } = setup(`/admin/month?ym=${bad}`);
    expect(result.current.p.ym).toBe('2026-10');
    await waitFor(() => expect(result.current.search).toBe('?ym=2026-10'));
  });

  it('biên kỳ mở: ?ym=2026-11 được, 2026-12 bị thay', () => {
    expect(setup('/admin/month?ym=2026-11').result.current.p.ym).toBe('2026-11');
    expect(setup('/admin/month?ym=2026-12').result.current.p.ym).toBe('2026-10');
  });

  it('filter=pending_delivery → chip=undelivered; over_max và custom_pending → noted; bỏ ?filter', async () => {
    const a = setup('/admin/month?ym=2026-10&filter=pending_delivery');
    expect(a.result.current.p.chip).toBe('undelivered');
    await waitFor(() => expect(a.result.current.search).toBe('?ym=2026-10&chip=undelivered'));
    expect(setup('/admin/month?ym=2026-10&filter=over_max').result.current.p.chip).toBe('noted');
    expect(setup('/admin/month?ym=2026-10&filter=custom_pending').result.current.p.chip).toBe('noted');
  });

  it('left=1 → left=true và chip undelivered, giữ left trên URL', async () => {
    const { result } = setup('/admin/month?ym=2026-10&left=1');
    expect(result.current.p.left).toBe(true);
    expect(result.current.p.presetReason).toBe('user_left');
    expect(result.current.p.chip).toBe('undelivered');
    expect(result.current.search).toBe('?ym=2026-10&left=1');
  });

  it('view=item, item=…, filter=unregistered/low bị bỏ khỏi URL', async () => {
    const { result } = setup('/admin/month?ym=2026-10&view=item&item=x&filter=unregistered');
    await waitFor(() => expect(result.current.search).toBe('?ym=2026-10'));
    expect(result.current.p.chip).toBe('all');
  });

  it('?chip= đã có thì thắng ?filter= cũ', () => {
    expect(setup('/admin/month?ym=2026-10&chip=noted&filter=pending_delivery').result.current.p.chip).toBe('noted');
  });
});
