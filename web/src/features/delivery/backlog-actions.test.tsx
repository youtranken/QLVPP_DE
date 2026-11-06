import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { backlogLine } from './backlog-fixtures';
import { callsTo, stubBacklog } from './backlog-test-stub';

const PEN_DUC = backlogLine();
const PEN_LAN = backlogLine({ line_id: 'l-pen-lan', request_id: 'r-2', user_sub: 'u-lan', full_name: 'Võ Thị Lan', department: null, user_status: 'locked', qty: 1, delivered_qty: 0, remaining_qty: 1 });
const TAPE = backlogLine({ line_id: 'l-tape', item_id: null, name: 'Băng keo 2 mặt', unit: 'cai', qty: 2, delivered_qty: 0, remaining_qty: 2, stock_qty: null });

function openPage() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/backlog');
}

const bodyRows = () => screen.getAllByRole('row').filter((r) => within(r).queryByRole('button', { name: /^Lịch sử giao/ }));
const rowOf = async (text: string) => {
  await screen.findByText('Bút bi xanh');
  return bodyRows().find((r) => r.textContent?.includes(text))!;
};
const openCancel = async (who: string) => {
  await userEvent.click(within(await rowOf(who)).getByRole('button', { name: `Thao tác khác Bút bi xanh — ${who}` }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Hủy nợ' }));
};
const pickReason = (name: string) => userEvent.click(within(screen.getByRole('radiogroup', { name: 'Lý do hủy nợ' })).getByRole('radio', { name }));
const heads = () => screen.queryAllByRole('row').filter((r) => r.classList.contains('dt-group'));
const hasHead = (text: string) => heads().some((r) => r.textContent?.includes(text));

afterEach(() => vi.unstubAllGlobals());

describe('BacklogPage — thao tác trên dòng', () => {
  it('giao bổ sung đủ phần còn lại (3) → dòng và nhóm biến mất, toast "Đã giao bổ sung 3 cây Bút bi xanh cho Phạm Văn Đức"', async () => {
    const f = stubBacklog([PEN_DUC, TAPE]);
    openPage();
    await userEvent.click(within(await rowOf('Phạm Văn Đức')).getByRole('button', { name: 'Giao bổ sung' }));
    const dialog = screen.getByRole('dialog', { name: 'Giao bổ sung Bút bi xanh cho Phạm Văn Đức' });
    expect(within(dialog).getByLabelText('Số lượng giao')).toHaveValue(3);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Giao' }));
    await waitFor(() => expect(hasHead('Bút bi xanh')).toBe(false));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(hasHead('Băng keo 2 mặt')).toBe(true);
    expect(await screen.findByText('Đã giao bổ sung 3 cây Bút bi xanh cho Phạm Văn Đức')).toBeInTheDocument();
    expect(JSON.parse(String(callsTo(f, '/api/admin/lines/l-pen/deliver')[0][1]?.body))).toEqual({ qty: 3, expected_delivered_qty: 2 });
  });

  it('giao bổ sung 2 (còn lại 3): bấm "−" một lần từ 3 → gửi 2, dòng ở lại "Còn 1", "đã giao" tăng lên 4', async () => {
    stubBacklog([PEN_DUC]);
    openPage();
    await userEvent.click(within(await rowOf('Phạm Văn Đức')).getByRole('button', { name: 'Giao bổ sung' }));
    await userEvent.click(screen.getByRole('button', { name: /^Bớt/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(async () => expect(await rowOf('Phạm Văn Đức')).toHaveTextContent('Còn 1 cây'));
  });

  it('giao bổ sung bị DELIVER_EXCEEDS_QTY {remaining: 1} → hộp ở lại, lỗi dưới ô số lượng, danh sách tải lại; sửa còn 1 rồi giao được', async () => {
    const f = stubBacklog([PEN_DUC], {
      deliver: (_l, qty) => (qty > 1 ? jsonResponse(400, { code: 'DELIVER_EXCEEDS_QTY', remaining: 1 }) : jsonResponse(200, {})),
      elsewhere: (l) => ({ ...l, qty: 3, remaining_qty: 1 }),
    });
    openPage();
    await userEvent.click(within(await rowOf('Phạm Văn Đức')).getByRole('button', { name: 'Giao bổ sung' }));
    await userEvent.click(screen.getByRole('button', { name: 'Giao' }));
    const dialog = screen.getByRole('dialog', { name: 'Giao bổ sung Bút bi xanh cho Phạm Văn Đức' });
    await waitFor(() => expect(within(dialog).getByText('Chỉ còn 1 chưa giao.')).toBeInTheDocument());
    await waitFor(() => expect(callsTo(f, '/api/admin/backlog?by=item').length).toBeGreaterThan(1));
    expect(within(dialog).getByLabelText('Số lượng giao')).toHaveValue(1);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Giao' }));
    await waitFor(() => expect(hasHead('Bút bi xanh')).toBe(false));
  });

  it('1280: dòng không có nút "Hủy nợ" trực tiếp; menu ⋯ có "Hủy nợ" (đỏ); chọn lý do "Người nhận không cần nữa" → dòng biến mất, dòng khác còn, toast "Đã hủy nợ 3 cây Bút bi xanh của Phạm Văn Đức"', async () => {
    const f = stubBacklog([PEN_DUC, PEN_LAN]);
    openPage();
    const row = await rowOf('Phạm Văn Đức');
    expect(within(row).queryByRole('button', { name: 'Hủy nợ' })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Giao bổ sung' })).toBeInTheDocument();
    await userEvent.click(within(row).getByRole('button', { name: 'Thao tác khác Bút bi xanh — Phạm Văn Đức' }));
    expect(screen.getByRole('menuitem', { name: 'Hủy nợ' })).toHaveClass('row-menu__item--danger');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hủy nợ' }));
    expect(screen.getByRole('dialog', { name: 'Hủy nợ 3 cây Bút bi xanh của Phạm Văn Đức?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hủy nợ' })).toBeDisabled();
    await pickReason('Người nhận không cần nữa');
    await userEvent.click(screen.getByRole('button', { name: 'Hủy nợ' }));
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(bodyRows()[0]).toHaveTextContent('Võ Thị Lan');
    expect(await screen.findByText('Đã hủy nợ 3 cây Bút bi xanh của Phạm Văn Đức')).toBeInTheDocument();
    expect(JSON.parse(String(callsTo(f, '/api/admin/lines/l-pen/cancel-remaining')[0][1]?.body))).toEqual({ reason_code: 'not_needed', expected_delivered_qty: 2, expected_qty: 5 });
  });

  it('W23: dòng có counted_in_snapshot_qty 2 → hộp Hủy nợ có "Phiếu gửi ADM tháng 10 đã tính 2 cây này — hủy thì hàng về dư vào kho." (tháng đang giao)', async () => {
    stubBacklog([{ ...PEN_DUC, counted_in_snapshot_qty: 2 }]);
    openPage();
    await openCancel('Phạm Văn Đức');
    expect(screen.getByText('Phiếu gửi ADM tháng 10 đã tính 2 cây này — hủy thì hàng về dư vào kho.')).toBeInTheDocument();
  });

  it('?left=1 → chỉ dòng người đã nghỉ; mở Hủy nợ thì "Đã nghỉ việc" chọn sẵn, gửi user_left', async () => {
    const f = stubBacklog([PEN_DUC, PEN_LAN]);
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/backlog?left=1');
    await screen.findByText('Bút bi xanh');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    await openCancel('Võ Thị Lan');
    expect(within(screen.getByRole('radiogroup', { name: 'Lý do hủy nợ' })).getByRole('radio', { name: 'Đã nghỉ việc' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Hủy nợ' }));
    await waitFor(() => expect(callsTo(f, '/api/admin/lines/l-pen-lan/cancel-remaining')).toHaveLength(1));
    expect(JSON.parse(String(callsTo(f, '/api/admin/lines/l-pen-lan/cancel-remaining')[0][1]?.body)).reason_code).toBe('user_left');
  });

  it('không có ?left=1 → mở Hủy nợ không chọn sẵn lý do', async () => {
    stubBacklog([PEN_LAN]);
    openPage();
    await openCancel('Võ Thị Lan');
    expect(within(screen.getByRole('radiogroup', { name: 'Lý do hủy nợ' })).queryByRole('radio', { checked: true })).toBeNull();
  });

  it('hủy nợ bị STALE_UPDATE {qty 4, delivered_qty 3} → hộp ở lại, khối "Dòng vừa thay đổi (đăng ký 4, đã giao 3) — kiểm tra lại." và tiêu đề đổi "Hủy nợ 1 cây"', async () => {
    const f = stubBacklog([PEN_DUC], { cancel: () => jsonResponse(409, { code: 'STALE_UPDATE', qty: 4, delivered_qty: 3 }) });
    openPage();
    await openCancel('Phạm Văn Đức');
    await pickReason('Đã nghỉ việc');
    await userEvent.click(screen.getByRole('button', { name: 'Hủy nợ' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Dòng vừa thay đổi (đăng ký 4, đã giao 3) — kiểm tra lại.');
    expect(screen.getByRole('dialog', { name: 'Hủy nợ 1 cây Bút bi xanh của Phạm Văn Đức?' })).toBeInTheDocument();
    await waitFor(() => expect(callsTo(f, '/api/admin/backlog?by=item').length).toBeGreaterThan(1));
  });

  it('"Lịch sử giao" mở panel phủ ?line=<id> có bộ đếm; Đóng gỡ tham số; ?line=<dòng không còn nợ> → không panel, gỡ tham số', async () => {
    stubBacklog([PEN_DUC, PEN_LAN]);
    openPage();
    await userEvent.click(within(await rowOf('Phạm Văn Đức')).getByRole('button', { name: /^Lịch sử giao/ }));
    const panel = await screen.findByRole('dialog', { name: 'Lịch sử giao Phạm Văn Đức' });
    expect(screen.getByTestId('location-search')).toHaveTextContent('line=l-pen');
    expect(within(panel).getByText(/^\d\/2$/)).toBeInTheDocument();
    expect(await within(panel).findByText('Chưa giao đợt nào')).toBeInTheDocument();
    await userEvent.click(within(panel).getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).not.toHaveTextContent('line='));
  });

  it('?line= trỏ tới dòng không có trong Còn nợ → không mở panel, gỡ tham số', async () => {
    stubBacklog([PEN_DUC]);
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/backlog?line=l-gone');
    await screen.findByText('Bút bi xanh');
    await waitFor(() => expect(screen.getByTestId('location-search')).not.toHaveTextContent('line='));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('390 px: dòng chỉ có nút "Giao bổ sung" + menu ⋯ chứa "Hủy nợ" và "Lịch sử giao"; chọn "Hủy nợ" mở hộp hủy nợ', async () => {
    stubBacklog([PEN_DUC]);
    mockViewport(390);
    renderApp(makeMe('admin'), '/admin/backlog');
    const more = await screen.findByRole('button', { name: 'Thao tác khác Bút bi xanh — Phạm Văn Đức' });
    expect(screen.getByRole('button', { name: 'Giao bổ sung' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Hủy nợ' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Lịch sử giao/ })).toBeNull();
    await userEvent.click(more);
    expect(screen.getByRole('menuitem', { name: 'Lịch sử giao' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('menuitem', { name: 'Hủy nợ' }));
    expect(await screen.findByRole('dialog', { name: 'Hủy nợ 3 cây Bút bi xanh của Phạm Văn Đức?' })).toBeInTheDocument();
  });
});
