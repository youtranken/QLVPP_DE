import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent } from '@/test/test-utils';
import { AdjustStockDialog } from './adjust-stock-dialog';
import { makeRow, mutationCall, stubMutation, wrap } from './stock-dialog-fixtures';

const URL = '/api/admin/items/i-1/stock';

describe('AdjustStockDialog', () => {
  it('tiêu đề "Điều chỉnh tồn Giấy A4"; −3 với tồn 3 → "Tồn sau khi lưu 0"; −4 → không có dòng tồn sau (âm)', async () => {
    stubMutation(jsonResponse(201, {}));
    wrap(<AdjustStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Điều chỉnh tồn Giấy A4' })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Thay đổi/), '-3');
    expect(screen.getByText('Tồn sau khi lưu 0')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/^Thay đổi/));
    await userEvent.type(screen.getByLabelText(/^Thay đổi/), '-4');
    expect(screen.queryByText(/Tồn sau khi lưu/)).toBeNull();
  });

  it('−3 tồn 3 + lý do → POST {delta:-3, reason: adjust, note}, toast "Đã điều chỉnh tồn Giấy A4: −3"', async () => {
    const f = stubMutation(jsonResponse(201, { stock_qty: 0 }));
    const onClose = vi.fn();
    wrap(<AdjustStockDialog item={makeRow(3)} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Thay đổi/), '-3');
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'Kiểm kê');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutationCall(f, URL).body).toEqual({ delta: -3, reason: 'adjust', note: 'Kiểm kê' });
    expect(await screen.findByText('Đã điều chỉnh tồn Giấy A4: −3')).toBeInTheDocument();
  });

  it('−4 tồn 3: server STOCK_INSUFFICIENT {available: 3} → "Chỉ còn 3 ram." gắn ô Thay đổi', async () => {
    stubMutation(jsonResponse(409, { code: 'STOCK_INSUFFICIENT', message: 'x', available: 3 }));
    wrap(<AdjustStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Thay đổi/), '-4');
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'Hỏng');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }));
    await vi.waitFor(() => expect(screen.getByLabelText(/^Thay đổi/)).toHaveAccessibleDescription('Chỉ còn 3 ram.'));
  });

  it('lý do rỗng → vẫn gửi, server REASON_REQUIRED gắn ô Lý do (aria-invalid), không phải ô số', async () => {
    stubMutation(jsonResponse(400, { code: 'REASON_REQUIRED', message: 'x' }));
    wrap(<AdjustStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Thay đổi/), '-1');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }));
    await vi.waitFor(() => expect(screen.getByLabelText(/^Lý do/)).toHaveAccessibleDescription('Cần ghi lý do.'));
    expect(screen.getByLabelText(/^Lý do/)).toBeInvalid();
    expect(screen.getByLabelText(/^Thay đổi/)).not.toBeInvalid();
  });

  it('lý do đúng 500 ký tự gửi được nguyên vẹn; ô không nhận ký tự thứ 501', async () => {
    const f = stubMutation(jsonResponse(201, {}));
    const onClose = vi.fn();
    wrap(<AdjustStockDialog item={makeRow(3)} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Thay đổi/), '-1');
    const reason = screen.getByLabelText(/^Lý do/);
    expect(reason).toHaveAttribute('maxlength', '500');
    await userEvent.click(reason);
    await userEvent.paste('x'.repeat(500));
    await userEvent.type(reason, 'y');
    expect(reason).toHaveValue('x'.repeat(500));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutationCall(f, URL).body.note).toBe('x'.repeat(500));
  });

  it('thay đổi không phải số nguyên ("1.5") → lỗi ở ô, không gọi API', async () => {
    const f = stubMutation(jsonResponse(201, {}));
    wrap(<AdjustStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Thay đổi/), '1.5');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu điều chỉnh' }));
    expect(screen.getByLabelText(/^Thay đổi/)).toHaveAccessibleDescription('Kiểm tra lại giá trị này.');
    expect(f.mock.calls.filter((c) => c[0] === URL)).toHaveLength(0);
  });
});
