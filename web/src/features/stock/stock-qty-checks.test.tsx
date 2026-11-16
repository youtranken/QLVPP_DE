import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { IssueDialog } from './issue-dialog';
import { PurchaseDialog } from './purchase-dialog';
import { makeRow, stubMutation, wrap } from './stock-dialog-fixtures';

const qtyBox = () => screen.getByLabelText(/^Số lượng/);

describe('Xuất lẻ: kiểm số ngay tại ô (tồn 20)', () => {
  it('gõ 21 → "Tủ chỉ còn 20 — nhập từ 1 đến 20" ở ô số, nút Xuất khóa kèm lý do; sửa thành 20 → hết lỗi, nút bật', async () => {
    stubMutation(jsonResponse(201, {}));
    wrap(<IssueDialog item={makeRow(20)} onClose={vi.fn()} />);
    await userEvent.type(qtyBox(), '21');
    expect(qtyBox()).toHaveAccessibleDescription('Tủ chỉ còn 20 — nhập từ 1 đến 20');
    expect(screen.getByRole('button', { name: 'Xuất' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Xuất' })).toHaveAccessibleDescription('Tủ chỉ còn 20 — nhập từ 1 đến 20');
    await userEvent.clear(qtyBox());
    await userEvent.type(qtyBox(), '20');
    expect(qtyBox()).not.toHaveAccessibleDescription(/Tủ chỉ còn/);
    expect(screen.getByRole('button', { name: 'Xuất' })).toBeEnabled();
  });

  it('gõ 0 → "Nhập từ 1 đến 20"; gõ 2.5 → "Nhập số nguyên"; 1 → hợp lệ', async () => {
    stubMutation(jsonResponse(201, {}));
    wrap(<IssueDialog item={makeRow(20)} onClose={vi.fn()} />);
    await userEvent.type(qtyBox(), '0');
    expect(qtyBox()).toHaveAccessibleDescription('Nhập từ 1 đến 20');
    await userEvent.clear(qtyBox());
    await userEvent.type(qtyBox(), '2.5');
    expect(qtyBox()).toHaveAccessibleDescription('Nhập số nguyên');
    await userEvent.clear(qtyBox());
    await userEvent.type(qtyBox(), '1');
    expect(screen.getByRole('button', { name: 'Xuất' })).toBeEnabled();
  });

  it('"Xuất lẻ một món": ô tìm món — gõ "băng" chỉ còn Băng keo; mỗi món ghi "Tủ: n"; không khớp → "Không có món khớp"', async () => {
    stubMutation(jsonResponse(201, {}));
    const paper = makeRow(6);
    const tape = { ...makeRow(5), id: 'i-2', name: 'Băng keo trong' };
    wrap(<IssueDialog choices={[paper, tape]} onClose={vi.fn()} />);
    const list = () => screen.getByRole('list', { name: 'Món còn trong tủ' });
    expect(within(list()).getByText('Tủ: 6')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món' }), 'băng');
    expect(within(list()).getAllByRole('button').map((b) => b.textContent)).toEqual(['Băng keo trongTủ: 5']);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm món' }), 'zzz');
    expect(within(list()).getByText('Không có món khớp')).toBeInTheDocument();
  });
});

describe('Nhập mua: kiểm số ngay tại ô (DTO 1..1.000.000)', () => {
  it('1.000.000 hợp lệ; 1.000.001 → "Tối đa 1.000.000", nút Lưu khóa; 0 → "Nhập từ 1"', async () => {
    stubMutation(jsonResponse(201, {}));
    wrap(<PurchaseDialog item={makeRow(3)} onClose={vi.fn()} />);
    const save = () => screen.getByRole('button', { name: /^Lưu/ });
    await userEvent.type(qtyBox(), '1000000');
    expect(save()).toBeEnabled();
    await userEvent.type(qtyBox(), '1');
    expect(qtyBox()).toHaveAccessibleDescription('Tối đa 1.000.000');
    expect(save()).toBeDisabled();
    await userEvent.clear(qtyBox());
    await userEvent.type(qtyBox(), '0');
    expect(qtyBox()).toHaveAccessibleDescription('Nhập từ 1');
  });
});
