import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent } from '@/test/test-utils';
import { IssueDialog } from './issue-dialog';
import { makeRow, mutationCall, mutationCount, stubMutation, wrap } from './stock-dialog-fixtures';

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
    await userEvent.click(screen.getByRole('button', { name: 'Xuất' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    const { body } = mutationCall(f, URL);
    expect(body).toEqual({ qty: 3, reason: 'Máy in tầng 2' });
    expect(body).not.toHaveProperty('recipient_sub');
    expect(await screen.findByText('Đã xuất lẻ 3 ram Giấy A4 cho Dùng chung')).toBeInTheDocument();
  });

  it('tồn 3 gõ 4 (vượt tủ) → chặn ngay "Chỉ còn 3 ram." tại ô số, không gọi API; gõ 3 thì bỏ chặn', async () => {
    const f = stubMutation(jsonResponse(201, { stock_qty: 0 }));
    const onClose = vi.fn();
    wrap(<IssueDialog item={makeRow(3)} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '4');
    expect(screen.queryByText(/Tồn sau khi lưu/)).toBeNull();
    await userEvent.click(screen.getByLabelText('Dùng chung'));
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'In hồ sơ thầu');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất' }));
    expect(screen.getByLabelText(/^Số lượng/)).toHaveAccessibleDescription('Chỉ còn 3 ram.');
    expect(mutationCount(f, URL)).toBe(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('server vẫn chặn STOCK_INSUFFICIENT {available: 2} (tồn đổi nơi khác) → "Chỉ còn 2 ram." tại ô số', async () => {
    stubMutation(jsonResponse(409, { code: 'STOCK_INSUFFICIENT', message: 'x', available: 2 }));
    wrap(<IssueDialog item={makeRow(3)} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '3');
    await userEvent.click(screen.getByLabelText('Dùng chung'));
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'In hồ sơ thầu');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất' }));
    await vi.waitFor(() => expect(screen.getByLabelText(/^Số lượng/)).toHaveAccessibleDescription('Chỉ còn 2 ram.'));
  });

  describe('tủ 5, giữ 4 cho 2 người chờ (còn trống 1)', () => {
    it('xuất 1 → không cảnh báo, nút "Xuất"', async () => {
      stubMutation(jsonResponse(201, {}));
      wrap(<IssueDialog item={makeRow(5, 4, 2)} onClose={vi.fn()} />);
      await userEvent.type(screen.getByLabelText(/^Số lượng/), '1');
      expect(screen.queryByRole('note')).toBeNull();
      expect(screen.getByRole('button', { name: 'Xuất' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Vẫn xuất' })).toBeNull();
    });

    it('xuất 3 → khối cam "Phần này đang giữ cho 2 người chờ nhận." + "Xuất 3 sẽ lấy 2 ram đang giữ."; "Vẫn xuất" gửi {qty: 3}', async () => {
      const f = stubMutation(jsonResponse(201, { stock_qty: 2 }));
      const onClose = vi.fn();
      wrap(<IssueDialog item={makeRow(5, 4, 2)} onClose={onClose} />);
      await userEvent.type(screen.getByLabelText(/^Số lượng/), '3');
      const note = screen.getByRole('note');
      expect(note).toHaveTextContent('Phần này đang giữ cho 2 người chờ nhận.');
      expect(note).toHaveTextContent('Xuất 3 sẽ lấy 2 ram đang giữ.');
      await userEvent.click(screen.getByLabelText('Dùng chung'));
      await userEvent.type(screen.getByLabelText(/^Lý do/), 'Phòng họp');
      await userEvent.click(screen.getByRole('button', { name: 'Vẫn xuất' }));
      await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(mutationCall(f, URL).body).toEqual({ qty: 3, reason: 'Phòng họp' });
    });

    it('xuất 2 (= trống + 1) đã cảnh báo lấy 1; xuất 6 (> tủ) → chặn, không gọi API', async () => {
      const f = stubMutation(jsonResponse(201, {}));
      wrap(<IssueDialog item={makeRow(5, 4, 2)} onClose={vi.fn()} />);
      await userEvent.type(screen.getByLabelText(/^Số lượng/), '2');
      expect(screen.getByRole('note')).toHaveTextContent('Xuất 2 sẽ lấy 1 ram đang giữ.');
      await userEvent.clear(screen.getByLabelText(/^Số lượng/));
      await userEvent.type(screen.getByLabelText(/^Số lượng/), '6');
      await userEvent.click(screen.getByLabelText('Dùng chung'));
      await userEvent.type(screen.getByLabelText(/^Lý do/), 'x');
      await userEvent.click(screen.getByRole('button', { name: /Xuất/ }));
      expect(screen.getByLabelText(/^Số lượng/)).toHaveAccessibleDescription('Chỉ còn 5 ram.');
      expect(mutationCount(f, URL)).toBe(0);
    });
  });

  it('chưa gõ thì không liệt kê ai; gõ không dấu "binh" → gợi ý Trần Thị Bình kèm phòng; người đã khóa không hiện; chọn → gửi recipient_sub, toast có tên', async () => {
    const f = stubMutation(jsonResponse(201, { stock_qty: 4 }));
    const onClose = vi.fn();
    wrap(<IssueDialog item={makeRow(5)} onClose={onClose} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '1');
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'Người mới vào giữa kỳ');
    const search = screen.getByRole('searchbox', { name: /Tìm người nhận/ });
    expect(search).toHaveAttribute('placeholder', 'Gõ tên hoặc email để tìm');
    // Chưa gõ thì chưa kéo danh bạ về
    expect(f.mock.calls.some((c) => String(c[0]).startsWith('/api/admin/users'))).toBe(false);
    expect(screen.queryByRole('list', { name: 'Kết quả tìm người' })).toBeNull();
    await userEvent.type(search, 'cuong');
    expect(await screen.findByText('Không tìm thấy ai.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Lê Văn Cường/ })).toBeNull();
    await userEvent.clear(search);
    await userEvent.type(search, 'binh');
    const binh = await screen.findByRole('button', { name: /Trần Thị Bình/ });
    expect(binh).toHaveTextContent('Giám sát');
    expect(screen.getByText('1 người khớp')).toBeInTheDocument();
    await userEvent.click(binh);
    await userEvent.click(screen.getByRole('button', { name: 'Xuất' }));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mutationCall(f, URL).body).toEqual({ qty: 1, recipient_sub: 'u-binh', reason: 'Người mới vào giữa kỳ' });
    expect(await screen.findByText('Đã xuất lẻ 1 ram Giấy A4 cho Trần Thị Bình')).toBeInTheDocument();
  });

  it('tìm theo cùng bộ trường với trang Danh bạ: mã nhân viên "nv042", nhóm "ca sang", phòng "giam sat" đều ra Trần Thị Bình', async () => {
    stubMutation(jsonResponse(201, {}));
    wrap(<IssueDialog item={makeRow(5)} onClose={vi.fn()} />);
    const search = screen.getByRole('searchbox', { name: /Tìm người nhận/ });
    for (const q of ['nv042', 'ca sang', 'giam sat']) {
      await userEvent.clear(search);
      await userEvent.type(search, q);
      expect(await screen.findByRole('button', { name: /Trần Thị Bình/ })).toBeInTheDocument();
    }
  });

  it('chưa chọn người nhận và không "Dùng chung" → lỗi ở ô Người nhận, không gọi API', async () => {
    const f = stubMutation(jsonResponse(201, {}));
    wrap(<IssueDialog item={makeRow(5)} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '1');
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'x');
    await userEvent.click(screen.getByRole('button', { name: 'Xuất' }));
    expect(await screen.findByText('Chọn người nhận hoặc đánh dấu “Dùng chung”.', { selector: '.ff-error, .ff-error *' })).toBeInTheDocument();
    expect(f.mock.calls.filter((c) => c[0] === URL)).toHaveLength(0);
  });

  it('lý do rỗng → server REASON_REQUIRED gắn ô Lý do', async () => {
    stubMutation(jsonResponse(400, { code: 'REASON_REQUIRED', message: 'x' }));
    wrap(<IssueDialog item={makeRow(5)} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '1');
    await userEvent.click(screen.getByLabelText('Dùng chung'));
    await userEvent.click(screen.getByRole('button', { name: 'Xuất' }));
    await vi.waitFor(() => expect(screen.getByLabelText(/^Lý do/)).toHaveAccessibleDescription('Cần ghi lý do.'));
  });

  it.each([
    ['USER_INACTIVE', 'Người này không còn hoạt động — chọn người khác.'],
    ['USER_NOT_FOUND', 'Không tìm thấy người nhận — chọn lại.'],
  ])('server %s → gắn ô Người nhận (aria-invalid + câu lỗi), không gắn ô Lý do', async (code, message) => {
    stubMutation(jsonResponse(400, { code, message: 'x' }));
    wrap(<IssueDialog item={makeRow(5)} onClose={vi.fn()} />);
    await userEvent.type(screen.getByLabelText(/^Số lượng/), '1');
    await userEvent.type(screen.getByLabelText(/^Lý do/), 'x');
    await userEvent.type(screen.getByRole('searchbox', { name: /Tìm người nhận/ }), 'Bình');
    await userEvent.click(await screen.findByRole('button', { name: /Trần Thị Bình/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Xuất' }));
    const picker = await screen.findByRole('searchbox', { name: /Tìm người nhận/ });
    await vi.waitFor(() => expect(picker).toHaveAccessibleDescription(message));
    expect(picker).toBeInvalid();
    expect(screen.getByLabelText(/^Lý do/)).not.toBeInvalid();
  });
});
