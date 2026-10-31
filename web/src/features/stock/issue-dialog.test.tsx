import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent } from '@/test/test-utils';
import { IssueDialog } from './issue-dialog';
import { makeRow, mutationCall, stubMutation, wrap } from './stock-dialog-fixtures';

const URL = '/api/admin/items/i-1/issue';

describe('IssueDialog', () => {
  it('tiêu đề "Xuất lẻ Giấy A4"; tồn 3 gõ 3 → "Tồn sau khi lưu 0" và gửi {qty:3}', async () => {
    const f = stubMutation(jsonResponse(201, { stock_qty: 0 }));
    const onClose = vi.fn();
    wrap(<IssueDialog item={makeRow(3)} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Xuất lẻ Giấy A4' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '3');
    expect(screen.getByText('Tồn sau khi lưu 0')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Dùng chung'));
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'Máy in tầng 2');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất lẻ' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const { body } = mutationCall(f, URL);
    expect(body).toEqual({ qty: 3, reason: 'Máy in tầng 2' });
    expect(body).not.toHaveProperty('recipient_sub');
    expect(await screen.findByText('Đã xuất lẻ 3 ram Giấy A4 cho Dùng chung')).toBeInTheDocument();
  });

  it('tồn 3 gõ 4: không còn dòng tồn sau, server chặn STOCK_INSUFFICIENT {available: 3} → "Chỉ còn 3 ram." tại ô số', async () => {
    stubMutation(jsonResponse(409, { code: 'STOCK_INSUFFICIENT', message: 'x', available: 3 }));
    const onClose = vi.fn();
    wrap(<IssueDialog item={makeRow(3)} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '4');
    expect(screen.queryByText(/Tồn sau khi lưu/)).toBeNull();
    await userEvent.click(screen.getByLabelText('Dùng chung'));
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'In hồ sơ thầu');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất lẻ' }));
    await vi.waitFor(() => expect(screen.getByLabelText(/^Số lượng/)).toHaveAccessibleDescription('Chỉ còn 3 ram.'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('chọn người từ danh bạ → gửi recipient_sub, toast có tên người; người đã khóa không chọn được', async () => {
    const f = stubMutation(jsonResponse(201, { stock_qty: 4 }));
    const onClose = vi.fn();
    wrap(<IssueDialog item={makeRow(5)} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '1');
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'Người mới vào giữa kỳ');
    expect(await screen.findByRole('button', { name: /Lê Văn Cường/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: /Trần Thị Bình/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Xuất lẻ' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutationCall(f, URL).body).toEqual({ qty: 1, recipient_sub: 'u-binh', reason: 'Người mới vào giữa kỳ' });
    expect(await screen.findByText('Đã xuất lẻ 1 ram Giấy A4 cho Trần Thị Bình')).toBeInTheDocument();
  });

  it('chưa chọn người nhận và không "Dùng chung" → lỗi ở ô Người nhận, không gọi API', async () => {
    const f = stubMutation(jsonResponse(201, {}));
    wrap(<IssueDialog item={makeRow(5)} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '1');
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất lẻ' }));
    expect(await screen.findByText('Chọn người nhận hoặc đánh dấu “Dùng chung”.', { selector: '.ff-error, .ff-error *' })).toBeInTheDocument();
    expect(f.mock.calls.filter((c) => c[0] === URL)).toHaveLength(0);
  });

  it('lý do rỗng → server REASON_REQUIRED gắn ô Lý do; USER_INACTIVE gắn ô Người nhận', async () => {
    stubMutation(jsonResponse(400, { code: 'REASON_REQUIRED', message: 'x' }));
    wrap(<IssueDialog item={makeRow(5)} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '1');
    await userEvent.click(screen.getByLabelText('Dùng chung'));
    await userEvent.click(screen.getByRole('button', { name: 'Xuất lẻ' }));
    await vi.waitFor(() => expect(screen.getByLabelText(/^Lý do/)).toHaveAccessibleDescription('Cần ghi lý do.'));
  });
});
