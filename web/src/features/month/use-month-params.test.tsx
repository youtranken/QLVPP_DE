import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { act, renderHook, waitFor } from '@testing-library/react';
import { pickDefaultYm, useMonthParams } from './use-month-params';

function wrapper(initial: string) {
  return ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
}

// null = trang chưa tính xong kỳ mặc định (tham số mặc định của JS nuốt undefined)
function setup(initial: string, openYm = '2026-11', defaultYm: string | null = '2026-10') {
  return renderHook(
    () => {
      const p = useMonthParams(openYm, defaultYm ?? undefined);
      return { p, search: useLocation().search };
    },
    { wrapper: wrapper(initial) },
  );
}

describe('pickDefaultYm', () => {
  it('kỳ khóa còn dòng chưa giao → kỳ khóa', () => {
    expect(pickDefaultYm('2026-11', { registered: 4, lines_pending_delivery: 3 })).toBe('2026-10');
  });
  it('kỳ khóa không có phiếu (registered=0) → kỳ đang đăng ký', () => {
    expect(pickDefaultYm('2026-11', { registered: 0, lines_pending_delivery: 0 })).toBe('2026-11');
  });
  it('kỳ khóa đã giao xong (lines_pending_delivery=0) → kỳ đang đăng ký', () => {
    expect(pickDefaultYm('2026-11', { registered: 4, lines_pending_delivery: 0 })).toBe('2026-11');
  });
  it('chỉ người ngoài danh sách chụp lúc khóa có phiếu (registered=0) nhưng còn dòng chưa giao → kỳ khóa', () => {
    expect(pickDefaultYm('2026-11', { registered: 0, lines_pending_delivery: 2 })).toBe('2026-10');
  });
});

describe('useMonthParams', () => {
  it('không có ?ym, chưa có kỳ mặc định → ym chưa có và không ghi URL', () => {
    const { result } = setup('/admin/month', '2026-11', null);
    expect(result.current.p.ym).toBeUndefined();
    expect(result.current.search).toBe('');
  });

  it('không có ?ym, kỳ mặc định là kỳ đang đăng ký → ghi ?ym=2026-11', async () => {
    const { result } = setup('/admin/month', '2026-11', '2026-11');
    expect(result.current.p.ym).toBe('2026-11');
    await waitFor(() => expect(result.current.search).toBe('?ym=2026-11'));
  });

  it('có ?ym= → giữ nguyên, không theo kỳ mặc định', () => {
    const { result } = setup('/admin/month?ym=2026-10', '2026-11', '2026-11');
    expect(result.current.p.ym).toBe('2026-10');
    expect(result.current.search).toBe('?ym=2026-10');
  });

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

  it('left=1 → left=true, chip vẫn Tất cả (chip Người đã nghỉ đã tự lọc phần chưa nhận), giữ left trên URL', async () => {
    const { result } = setup('/admin/month?ym=2026-10&left=1');
    expect(result.current.p.left).toBe(true);
    expect(result.current.p.presetReason).toBe('user_left');
    expect(result.current.p.chip).toBe('all');
    expect(result.current.search).toBe('?ym=2026-10&left=1');
  });

  it('setLeft(true) thêm left=1, setLeft(false) bỏ; đổi chip không gỡ left', async () => {
    const { result } = setup('/admin/month?ym=2026-10');
    act(() => result.current.p.setLeft(true));
    await waitFor(() => expect(result.current.search).toBe('?ym=2026-10&left=1'));
    act(() => result.current.p.setChip('noted'));
    await waitFor(() => expect(result.current.search).toBe('?ym=2026-10&left=1&chip=noted'));
    act(() => result.current.p.setLeft(false));
    await waitFor(() => expect(result.current.search).toBe('?ym=2026-10&chip=noted'));
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
