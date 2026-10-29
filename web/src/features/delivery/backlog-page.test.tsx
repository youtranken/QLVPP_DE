import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { backlogLine } from './backlog-fixtures';
import { callsTo, stubBacklog } from './backlog-test-stub';

const PEN_DUC = backlogLine();
const PEN_LAN = backlogLine({ line_id: 'l-pen-lan', request_id: 'r-2', user_sub: 'u-lan', full_name: 'Võ Thị Lan', department: null, user_status: 'locked', qty: 1, delivered_qty: 0, remaining_qty: 1 });
const TAPE = backlogLine({ line_id: 'l-tape', item_id: null, name: 'Băng keo 2 mặt', unit: 'cai', qty: 2, delivered_qty: 0, remaining_qty: 2, stock_qty: null });

function openPage(path = '/admin/backlog') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}

const groupOf = (name: string) => screen.findByRole('region', { name });
const rowOf = async (group: string, text: string) =>
  within(await groupOf(group))
    .getAllByRole('listitem')
    .find((li) => li.textContent?.includes(text))!;

afterEach(() => vi.unstubAllGlobals());

describe('BacklogPage — trang Còn nợ', () => {
  it('mặc định theo món: "Theo món" aria-pressed, nhóm "Bút bi xanh · còn 4 cây · Tồn 10", dòng "Tháng 10/2026 · Phạm Văn Đức · đã giao 2/5 · còn 3"', async () => {
    const f = stubBacklog([PEN_DUC, PEN_LAN]);
    openPage();
    const group = await groupOf('Bút bi xanh');
    expect(screen.getByRole('heading', { level: 1, name: 'Còn nợ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Theo món' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Theo người' })).toHaveAttribute('aria-pressed', 'false');
    expect(callsTo(f, '/api/admin/backlog?by=item')).toHaveLength(1);
    expect(within(group).getByText('còn 4 cây')).toBeInTheDocument();
    expect(within(group).getByText('Tồn 10')).toBeInTheDocument();
    const row = await rowOf('Bút bi xanh', 'Phạm Văn Đức');
    for (const text of ['Tháng 10/2026', 'đã giao 2/5', 'còn 3']) expect(within(row).getByText(text)).toBeInTheDocument();
    expect(within(await rowOf('Bút bi xanh', 'Võ Thị Lan')).getByText('Người đã nghỉ')).toBeInTheDocument();
    expect(within(row).queryByText('Người đã nghỉ')).toBeNull();
  });

  it('bấm "Theo người" → ?by=person, aria-pressed đổi, gọi by=person; nhóm có phòng ban (hoặc "Chưa có phòng ban") + "Người đã nghỉ"', async () => {
    const f = stubBacklog([PEN_DUC, PEN_LAN]);
    openPage();
    await groupOf('Bút bi xanh');
    await userEvent.click(screen.getByRole('button', { name: 'Theo người' }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?by=person');
    expect(screen.getByRole('button', { name: 'Theo người' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Theo món' })).toHaveAttribute('aria-pressed', 'false');
    const lan = await groupOf('Võ Thị Lan');
    expect(callsTo(f, '/api/admin/backlog?by=person')).toHaveLength(1);
    expect(within(lan).getByText('Người đã nghỉ')).toBeInTheDocument();
    expect(within(lan).getByText('Chưa có phòng ban')).toBeInTheDocument();
    const duc = await groupOf('Phạm Văn Đức');
    expect(within(duc).getByText('Tổ Giám sát')).toBeInTheDocument();
    expect(within(duc).queryByText('Người đã nghỉ')).toBeNull();
    expect(within(duc).getByText('Bút bi xanh')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Theo món' }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('?by=item');
  });

  it('mở thẳng ?by=person → nhóm theo người; ?by=lạ → theo món', async () => {
    const f = stubBacklog([PEN_DUC]);
    openPage('/admin/backlog?by=xyz');
    await groupOf('Bút bi xanh');
    expect(callsTo(f, '/api/admin/backlog?by=item')).toHaveLength(1);
  });

  it('không còn dòng nợ → "Không còn nợ"', async () => {
    stubBacklog([]);
    openPage();
    expect(await screen.findByText('Không còn nợ')).toBeInTheDocument();
  });

  it('tồn 0 → "Giao bổ sung…" vô hiệu + nhãn "Hết hàng"; "Hủy nợ…" vẫn bấm được; dòng ngoài danh mục không giới hạn tồn', async () => {
    stubBacklog([backlogLine({ stock_qty: 0 }), TAPE]);
    openPage();
    const pen = await rowOf('Bút bi xanh', 'Phạm Văn Đức');
    expect(within(pen).getByRole('button', { name: 'Giao bổ sung…' })).toBeDisabled();
    expect(within(pen).getByText('Hết hàng')).toBeInTheDocument();
    expect(within(pen).getByRole('button', { name: 'Hủy nợ…' })).toBeEnabled();
    const tape = await rowOf('Băng keo 2 mặt', 'Phạm Văn Đức');
    expect(within(await groupOf('Băng keo 2 mặt')).queryByText(/^Tồn/)).toBeNull();
    await userEvent.click(within(tape).getByRole('button', { name: 'Giao bổ sung…' }));
    expect(screen.getByLabelText('Số lượng giao')).toHaveValue(2);
  });

  it('giao bổ sung đủ phần còn lại (3) → dòng biến mất; nhóm hết dòng thì mất cả nhóm', async () => {
    const f = stubBacklog([PEN_DUC, TAPE]);
    openPage();
    await userEvent.click(within(await rowOf('Bút bi xanh', 'Phạm Văn Đức')).getByRole('button', { name: 'Giao bổ sung…' }));
    const dialog = screen.getByRole('dialog', { name: 'Giao bổ sung Bút bi xanh cho Phạm Văn Đức' });
    expect(within(dialog).getByLabelText('Số lượng giao')).toHaveValue(3);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Giao' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Bút bi xanh' })).toBeNull());
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('region', { name: 'Băng keo 2 mặt' })).toBeInTheDocument();
    const body = JSON.parse(String(callsTo(f, '/api/admin/lines/l-pen/deliver')[0][1]?.body));
    expect(body).toEqual({ qty: 3, expected_delivered_qty: 2 });
  });

  it('giao bổ sung 2 (còn lại 3) → dòng ở lại với "còn 1", "đã giao 4/5"', async () => {
    stubBacklog([PEN_DUC]);
    openPage();
    await userEvent.click(within(await rowOf('Bút bi xanh', 'Phạm Văn Đức')).getByRole('button', { name: 'Giao bổ sung…' }));
    fireEvent.change(screen.getByLabelText('Số lượng giao'), { target: { value: '2' } });
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const row = await rowOf('Bút bi xanh', 'Phạm Văn Đức');
    await waitFor(() => expect(within(row).getByText('còn 1')).toBeInTheDocument());
    expect(within(row).getByText('đã giao 4/5')).toBeInTheDocument();
  });

  it('hủy nợ với lý do → dòng biến mất khỏi nhóm, dòng khác của nhóm còn', async () => {
    stubBacklog([PEN_DUC, PEN_LAN]);
    openPage();
    await userEvent.click(within(await rowOf('Bút bi xanh', 'Phạm Văn Đức')).getByRole('button', { name: 'Hủy nợ…' }));
    await userEvent.type(screen.getByLabelText('Lý do hủy nợ'), 'Hết mẫu');
    await userEvent.click(screen.getByRole('button', { name: 'Hủy nợ' }));
    const group = await groupOf('Bút bi xanh');
    await waitFor(() => expect(within(group).queryByText('Phạm Văn Đức')).toBeNull());
    expect(within(group).getByText('Võ Thị Lan')).toBeInTheDocument();
    expect(within(group).getByText('còn 1 cây')).toBeInTheDocument();
  });

  it('hủy nợ bị STALE_UPDATE → hộp đóng, báo ở đầu trang và tải lại danh sách', async () => {
    const f = stubBacklog([PEN_DUC], { cancel: () => jsonResponse(409, { code: 'STALE_UPDATE' }) });
    openPage();
    await userEvent.click(within(await rowOf('Bút bi xanh', 'Phạm Văn Đức')).getByRole('button', { name: 'Hủy nợ…' }));
    await userEvent.type(screen.getByLabelText('Lý do hủy nợ'), 'Hết mẫu');
    await userEvent.click(screen.getByRole('button', { name: 'Hủy nợ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Dòng vừa được giao ở nơi khác — số đã cập nhật');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(callsTo(f, '/api/admin/backlog?by=item').length).toBeGreaterThan(1));
  });

  it('"Lịch sử" mở ngăn lịch sử đợt giao của dòng', async () => {
    stubBacklog([PEN_DUC]);
    openPage();
    await userEvent.click(within(await rowOf('Bút bi xanh', 'Phạm Văn Đức')).getByRole('button', { name: 'Lịch sử' }));
    expect(screen.getByRole('dialog', { name: 'Lịch sử giao Bút bi xanh' })).toBeInTheDocument();
    expect(await screen.findByText('Chưa giao đợt nào')).toBeInTheDocument();
  });
});
