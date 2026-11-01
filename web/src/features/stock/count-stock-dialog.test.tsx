import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent } from '@/test/test-utils';
import { CountStockDialog } from './count-stock-dialog';
import { makeRow, mutationCall, mutationCount, stubMutation, wrap } from './stock-dialog-fixtures';

const URL = '/api/admin/items/i-1/stock/count';
const counted = () => screen.getByLabelText(/^Số đếm thực tế/);
const reason = () => screen.getByLabelText(/^Lý do/);
const submit = () => screen.getByRole('button', { name: 'Lưu kiểm kê' });

async function fill(qty: string, note = 'Kiểm kê cuối tháng') {
  await userEvent.clear(counted());
  await userEvent.type(counted(), qty);
  if (note) {
    await userEvent.clear(reason());
    await userEvent.type(reason(), note);
  }
}

describe('CountStockDialog', () => {
  it('tiêu đề ngắn "Kiểm kê" + tên món làm phụ đề (title đủ tên); hiện "Tồn hiện tại 3 ram"; gợi ý lý do', () => {
    stubMutation(jsonResponse(201, {}));
    wrap(<CountStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Kiểm kê Giấy A4' });
    expect(screen.getByRole('heading', { name: 'Kiểm kê Giấy A4' })).toBeInTheDocument();
    expect(dialog.querySelector('[title="Giấy A4"]')).not.toBeNull();
    expect(screen.getByText('Tồn hiện tại 3 ram')).toBeInTheDocument();
    expect(reason()).toHaveAccessibleDescription(/VD: kiểm kê cuối tháng, hàng hỏng/);
  });

  it('xem trước: đếm 5 tồn 3 → "Tồn 3 → 5 (+2)"; đếm 2 → "Tồn 3 → 2 (−1)"', async () => {
    stubMutation(jsonResponse(201, {}));
    wrap(<CountStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    await fill('5', '');
    expect(screen.getByText('Tồn 3 → 5 (+2)')).toBeInTheDocument();
    await fill('2', '');
    expect(screen.getByText('Tồn 3 → 2 (−1)')).toBeInTheDocument();
  });

  it('"Lưu kiểm kê" vô hiệu khi ô trống và khi số đếm = tồn hiện tại (3); bật khi 4', async () => {
    stubMutation(jsonResponse(201, {}));
    wrap(<CountStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    expect(submit()).toBeDisabled();
    await fill('3', '');
    expect(submit()).toBeDisabled();
    expect(screen.queryByText(/^Tồn 3 →/)).toBeNull();
    await fill('4', '');
    expect(submit()).toBeEnabled();
  });

  it('biên dưới: đếm 0 gửi {counted_qty: 0, expected_stock_qty: 3, note}, toast "Đã kiểm kê Giấy A4: 3 → 0"', async () => {
    const f = stubMutation(jsonResponse(201, { stock_qty: 0 }));
    const onClose = vi.fn();
    wrap(<CountStockDialog item={makeRow(3)} onClose={onClose} />);
    await fill('0');
    await userEvent.click(submit());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutationCall(f, URL).body).toEqual({ counted_qty: 0, expected_stock_qty: 3, note: 'Kiểm kê cuối tháng' });
    expect(await screen.findByText('Đã kiểm kê Giấy A4: 3 → 0')).toBeInTheDocument();
  });

  it('biên dưới: đếm −1 → lỗi gắn ô Số đếm, không gọi API', async () => {
    const f = stubMutation(jsonResponse(201, {}));
    wrap(<CountStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    await fill('-1');
    await userEvent.click(submit());
    expect(counted()).toHaveAccessibleDescription('Nhập số nguyên từ 0 đến 1 000 000.');
    expect(counted()).toBeInvalid();
    expect(mutationCount(f, URL)).toBe(0);
  });

  it('biên trên: 1 000 000 gửi được; 1 000 001 bị chặn ở ô, không gọi API', async () => {
    const f = stubMutation(jsonResponse(201, {}));
    const onClose = vi.fn();
    wrap(<CountStockDialog item={makeRow(3)} onClose={onClose} />);
    await fill('1000001');
    await userEvent.click(submit());
    expect(counted()).toHaveAccessibleDescription('Nhập số nguyên từ 0 đến 1 000 000.');
    expect(mutationCount(f, URL)).toBe(0);
    await fill('1000000', '');
    await userEvent.click(submit());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutationCall(f, URL).body.counted_qty).toBe(1_000_000);
  });

  it('STALE_UPDATE {stock_qty: 7}: báo ngay trong hộp, tồn hiện tại cập nhật 7, không tự gửi lại; gửi tiếp dùng expected 7', async () => {
    const f = stubMutation(jsonResponse(409, { code: 'STALE_UPDATE', message: 'x', stock_qty: 7 }));
    const onClose = vi.fn();
    wrap(<CountStockDialog item={makeRow(3)} onClose={onClose} />);
    await fill('5');
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toHaveTextContent('Tồn vừa đổi thành 7 ram ở nơi khác — đếm lại rồi lưu.');
    expect(screen.getByText('Tồn hiện tại 7 ram')).toBeInTheDocument();
    expect(screen.getByText('Tồn 7 → 5 (−2)')).toBeInTheDocument();
    expect(mutationCount(f, URL)).toBe(1);
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(submit());
    await vi.waitFor(() => expect(mutationCount(f, URL)).toBe(2));
    expect(JSON.parse(String((f.mock.calls.filter((c) => c[0] === URL)[1][1] as RequestInit).body)).expected_stock_qty).toBe(7);
  });

  it('STALE_UPDATE mà tồn mới đúng bằng số đã đếm (5): gợi ý "Số đếm khớp tồn hiện tại — không cần lưu.", không báo lỗi đếm lại', async () => {
    stubMutation(jsonResponse(409, { code: 'STALE_UPDATE', message: 'x', stock_qty: 5 }));
    wrap(<CountStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    await fill('5');
    await userEvent.click(submit());
    expect(await screen.findByRole('status')).toHaveTextContent('Số đếm khớp tồn hiện tại — không cần lưu.');
    expect(screen.getByText('Tồn hiện tại 5 ram')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(submit()).toBeDisabled();
  });

  it('REASON_REQUIRED gắn ô Lý do (aria-invalid), không gắn ô Số đếm', async () => {
    stubMutation(jsonResponse(400, { code: 'REASON_REQUIRED', message: 'x' }));
    wrap(<CountStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    await fill('5', 'ab');
    await userEvent.click(submit());
    await vi.waitFor(() => expect(reason()).toHaveAccessibleDescription('Cần ghi lý do.'));
    expect(reason()).toBeInvalid();
    expect(counted()).not.toBeInvalid();
  });

  it('VALIDATION fields [counted_qty] gắn ô Số đếm', async () => {
    stubMutation(jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['counted_qty'] }));
    wrap(<CountStockDialog item={makeRow(3)} onClose={vi.fn()} />);
    await fill('5');
    await userEvent.click(submit());
    await vi.waitFor(() => expect(counted()).toHaveAccessibleDescription('Kiểm tra lại giá trị này.'));
    expect(reason()).not.toBeInvalid();
  });

  it('lý do đúng 500 ký tự gửi nguyên vẹn; ô không nhận ký tự thứ 501', async () => {
    const f = stubMutation(jsonResponse(201, {}));
    const onClose = vi.fn();
    wrap(<CountStockDialog item={makeRow(3)} onClose={onClose} />);
    await fill('4', '');
    expect(reason()).toHaveAttribute('maxlength', '500');
    await userEvent.click(reason());
    await userEvent.paste('x'.repeat(500));
    await userEvent.type(reason(), 'y');
    expect(reason()).toHaveValue('x'.repeat(500));
    await userEvent.click(submit());
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutationCall(f, URL).body.note).toBe('x'.repeat(500));
  });
});
