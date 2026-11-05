import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { SummaryPersonTable } from './summary-person-table';
import { PEOPLE, person, stubSummaryApi } from './summary-fixtures';
import type { PersonRow } from './summary.api';

function renderTable(props: { locked?: boolean; ym?: string; rows?: PersonRow[]; onOpen?: (id: string) => void } = {}) {
  if (props.rows) stubSummaryApi((url) => (url.includes('by=person') ? jsonResponse(200, { items: props.rows, next_cursor: null }) : undefined));
  else stubSummaryApi();
  const onOpen = props.onOpen ?? vi.fn();
  renderWithI18n(
    <MemoryRouter>
      <SummaryPersonTable ym={props.ym ?? (props.locked ? '2026-10' : '2026-11')} locked={props.locked ?? false} filter={null} q="" onOpen={onOpen} onClearFilter={() => {}} />
    </MemoryRouter>,
  );
  return onOpen;
}

const rowOf = async (name: string) => (await screen.findByText(name)).closest('tr')!;

afterEach(() => vi.unstubAllGlobals());

describe('SummaryPersonTable — bảng theo người', () => {
  it('nhóm dính theo phòng ban, "Chưa có phòng ban" cuối dù API trả trước', async () => {
    renderTable();
    await screen.findByText('Phạm Văn Đức');
    const rows = screen.getAllByRole('row').map((r) => r.textContent ?? '');
    const at = (s: string) => rows.findIndex((r) => r.includes(s));
    expect(at('Phòng Công trình')).toBeLessThan(at('Phạm Văn Đức'));
    expect(at('Võ Thị Lan')).toBeLessThan(at('Chưa có phòng ban'));
    expect(at('Chưa có phòng ban')).toBeLessThan(at('Trần Bình'));
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
  });

  it('nhãn "Người đã nghỉ" khi user_status ≠ active; badge "1 món ngoài DM chờ xem"', async () => {
    renderTable();
    const lan = await rowOf('Võ Thị Lan');
    expect(within(lan).getByText('Người đã nghỉ')).toBeInTheDocument();
    const duc = await rowOf('Phạm Văn Đức');
    expect(within(duc).queryByText('Người đã nghỉ')).toBeNull();
    expect(within(duc).getByText('1 món ngoài DM chờ xem')).toBeInTheDocument();
  });

  it('kỳ mở: cột Giao "Giao sau khi khóa kỳ", không thanh tiến độ, không nút Giao', async () => {
    renderTable();
    const duc = await rowOf('Phạm Văn Đức');
    expect(within(duc).getByText('Giao sau khi khóa kỳ')).toBeInTheDocument();
    expect(within(duc).queryByRole('progressbar')).toBeNull();
    expect(within(duc).queryByRole('link', { name: /Giao/ })).toBeNull();
  });

  it('kỳ khóa: Progress "đã giao {delivered+cancelled}/{total}" — giao 3 + hủy 2 trên 5 → đầy "đã giao 5/5 đơn vị", không nút Giao', async () => {
    renderTable({ locked: true, rows: [person({ request_id: 'r-7', full_name: 'Lê Hủy', total_qty: 5, delivered_qty: 3, cancelled_qty: 2 })] });
    const row = await rowOf('Lê Hủy');
    const bar = within(row).getByRole('progressbar', { name: 'đã giao 5/5 đơn vị' });
    expect(bar).toHaveAttribute('aria-valuenow', '5');
    expect(bar).toHaveAttribute('aria-valuemax', '5');
    expect(within(row).queryByRole('link', { name: /Giao/ })).toBeNull();
  });

  it('kỳ khóa gần nhất (2026-10, hiện tại 11), còn phải giao (4/7) → nút Giao → /admin/delivery?person=<user_sub> (trang mới), không mở ngăn kéo', async () => {
    const onOpen = renderTable({ locked: true, rows: [PEOPLE[1]] });
    const row = await rowOf('Phạm Văn Đức');
    expect(within(row).getByRole('progressbar', { name: 'đã giao 4/7 đơn vị' })).toBeInTheDocument();
    const link = await within(row).findByRole('link', { name: 'Giao phiếu của Phạm Văn Đức' });
    await vi.waitFor(() => expect(link).toHaveAttribute('href', `/admin/delivery?person=${PEOPLE[1].user_sub}`));
    await userEvent.click(link);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('user_sub có + và # được mã hóa trong link: ?person=a%2Bb%23c (không bị cắt ở #, + không thành dấu cách)', async () => {
    renderTable({ locked: true, rows: [{ ...PEOPLE[1], user_sub: 'a+b#c' }] });
    const row = await rowOf('Phạm Văn Đức');
    const link = await within(row).findByRole('link', { name: 'Giao phiếu của Phạm Văn Đức' });
    await vi.waitFor(() => expect(link).toHaveAttribute('href', '/admin/delivery?person=a%2Bb%23c'));
  });

  it('kỳ cũ hơn kỳ khóa gần nhất (2026-09) → giữ liên kết trang cũ /admin/delivery/classic?ym=2026-09&request=', async () => {
    renderTable({ locked: true, ym: '2026-09', rows: [PEOPLE[1]] });
    const row = await rowOf('Phạm Văn Đức');
    const link = await within(row).findByRole('link', { name: 'Giao phiếu của Phạm Văn Đức' });
    await vi.waitFor(() => expect(link).toHaveAttribute('href', '/admin/delivery/classic?ym=2026-09&request=r-1'));
  });

  it('tổng 0 (chỉ dòng chờ xem) → cột Giao "—", không NaN', async () => {
    renderTable({ locked: true, rows: [person({ request_id: 'r-9', full_name: 'Đỗ Chờ', total_qty: 0, custom_pending: 1 })] });
    const row = await rowOf('Đỗ Chờ');
    expect(within(row).queryByRole('progressbar')).toBeNull();
    expect(within(row).getByText('—')).toBeInTheDocument();
    expect(row).not.toHaveTextContent('NaN');
  });

  it('bấm hàng → onOpen(request_id); "Điều chỉnh phiếu của …" cũng vậy', async () => {
    const onOpen = renderTable();
    await userEvent.click(await screen.findByText('Trần Bình'));
    expect(onOpen).toHaveBeenLastCalledWith('r-3');
    await userEvent.click(screen.getByRole('button', { name: 'Điều chỉnh phiếu của Võ Thị Lan' }));
    expect(onOpen).toHaveBeenLastCalledWith('r-2');
  });

  it('cột "Lưu lúc" hiện giờ:phút theo giờ VN', async () => {
    renderTable({ rows: [person({ request_id: 'r-5', full_name: 'Giờ Lưu', updated_at: '2020-01-02T07:20:00.000Z' })] });
    const row = await rowOf('Giờ Lưu');
    expect(row).toHaveTextContent('02/01 · 14:20');
  });

  it('"Xem thêm" khi phòng ban trải hai trang → một tiêu đề nhóm', async () => {
    stubSummaryApi((url) =>
      url.includes('by=person')
        ? jsonResponse(200, url.includes('cursor=') ? { items: [PEOPLE[2], PEOPLE[0]], next_cursor: null } : { items: [PEOPLE[1]], next_cursor: 'c-1' })
        : undefined,
    );
    renderWithI18n(
      <MemoryRouter>
        <SummaryPersonTable ym="2026-11" locked={false} filter={null} q="" onOpen={() => {}} onClearFilter={() => {}} />
      </MemoryRouter>,
    );
    await screen.findByText('Phạm Văn Đức');
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    await screen.findByText('Võ Thị Lan');
    expect(screen.getAllByRole('rowheader', { name: /Phòng Công trình/ })).toHaveLength(1);
    expect(screen.getAllByRole('rowheader', { name: /Chưa có phòng ban/ })).toHaveLength(1);
  });
});
