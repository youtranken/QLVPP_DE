import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent } from '@/test/test-utils';
import { PurchaseDialog } from './purchase-dialog';
import { makeRow, mutationCall, mutationCount, stubMutation, wrap } from './stock-dialog-fixtures';

const URL = '/api/admin/items/i-1/stock';

describe('PurchaseDialog', () => {
  it('tiêu đề "Nhập ngoài kỳ (tự mua lẻ) Giấy A4", "Tồn hiện tại 5 ram", gõ 10 → "Tồn sau khi lưu 15"', async () => {
    stubMutation(jsonResponse(201, {}));
    wrap(<PurchaseDialog item={makeRow(5)} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Nhập ngoài kỳ (tự mua lẻ) Giấy A4' })).toBeInTheDocument();
    expect(screen.getByText('Tồn hiện tại 5 ram')).toBeInTheDocument();
    expect(screen.queryByText(/Tồn sau khi lưu/)).toBeNull();
    await userEvent.type(screen.getByLabelText(/^Số lượng nhập/), '10');
    expect(screen.getByText('Tồn sau khi lưu 15')).toBeInTheDocument();
  });

  it('nhập 10 kèm ghi chú → POST stock {delta: 10, reason: purchase, note} kèm CSRF, đóng, toast "Đã nhập 10 ram Giấy A4"', async () => {
    const f = stubMutation(jsonResponse(201, { stock_qty: 15 }));
    const onClose = vi.fn();
    wrap(<PurchaseDialog item={makeRow(5)} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng nhập/), '10');
    await userEvent.type(screen.getByLabelText('Ghi chú'), 'Đơn T11');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nhập mua' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const { init, body } = mutationCall(f, URL);
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
    expect(body).toEqual({ delta: 10, reason: 'purchase', note: 'Đơn T11' });
    expect(await screen.findByText('Đã nhập 10 ram Giấy A4')).toBeInTheDocument();
  });

  it('ghi chú trống → note null (ghi chú tùy chọn)', async () => {
    const f = stubMutation(jsonResponse(201, {}));
    const onClose = vi.fn();
    wrap(<PurchaseDialog item={makeRow(5)} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng nhập/), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nhập mua' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutationCall(f, URL).body).toEqual({ delta: 1, reason: 'purchase', note: null });
  });

  it('server VALIDATION {fields:[delta]} (nhập 0) → lỗi gắn ô "Số lượng nhập", hộp không đóng', async () => {
    stubMutation(jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['delta'] }));
    const onClose = vi.fn();
    wrap(<PurchaseDialog item={makeRow(5)} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng nhập/), '0');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu nhập mua' }));
    await vi.waitFor(() => expect(screen.getByLabelText(/^Số lượng nhập/)).toHaveAccessibleDescription('Kiểm tra lại giá trị này.'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('bấm "Lưu nhập mua" hai lần trước khi vẽ lại → chỉ một POST', async () => {
    let release: (r: Response) => void = () => {};
    const f = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>((res) => (release = res)));
    vi.stubGlobal('fetch', f);
    wrap(<PurchaseDialog item={makeRow(5)} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng nhập/), '10');
    const submit = screen.getByRole('button', { name: 'Lưu nhập mua' });
    act(() => {
      submit.click();
      submit.click();
    });
    expect(f.mock.calls.filter((c) => c[0] === URL)).toHaveLength(1);
    await act(async () => release(jsonResponse(200, {})));
    expect(mutationCount(f as never, URL)).toBe(1);
  });
});
