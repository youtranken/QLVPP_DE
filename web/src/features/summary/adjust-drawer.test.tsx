import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { lineView } from '@/test/fixtures-request';
import { ADMIN_ITEMS, adminItem, adminRequest } from './adjust-fixtures';
import { SENT, less, noteBox, pick, reasons, renderDrawer, row, saveButton, stubAdjust } from './adjust-render-fixtures';

afterEach(() => vi.unstubAllGlobals());

const facts = (name: string, unit: string, over: { active?: boolean; admin_only?: boolean } = {}) => ({
  name,
  name_en: null,
  unit,
  pack_note: null,
  image_file_id: null,
  active: over.active ?? true,
  admin_only: over.admin_only ?? false,
});

const REASONS = ['Vượt định mức', 'ADM không còn hàng', 'Trùng với phiếu khác', 'Người đã nghỉ', 'Khác'];

// Giấy note vàng 5 bịch, tối đa hiện tại 4 (đã hạ sau khi nhân viên lưu)
const overMaxView = () => {
  const view = adminRequest();
  view.lines[1] = { ...view.lines[1], qty: 5, max_qty: 4 };
  return view;
};

describe('AdjustDrawer — đầu ngăn', () => {
  it('kỳ khóa: eyebrow, "Đã khóa", cảnh báo chỉ giảm/bỏ; không còn ô lý do cấp phiếu; "3 dòng" + "15 đơn vị"', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    expect(within(drawer).getByText('Tháng 10/2026 · Tổ Giám sát')).toBeInTheDocument();
    expect(within(drawer).getByText('Đã khóa')).toBeInTheDocument();
    expect(within(drawer).getByText('Kỳ đã khóa. Chỉ giảm hoặc bỏ dòng, mỗi dòng giảm cần lý do; không giảm dưới số đã giao.')).toBeInTheDocument();
    expect(within(drawer).queryByLabelText(/^Lý do điều chỉnh/)).toBeNull();
    expect(within(drawer).getByText('Món trong phiếu · 3 dòng')).toBeInTheDocument();
    expect(within(drawer).getByText('15 đơn vị')).toBeInTheDocument();
    expect(within(drawer).getByText(/^Lưu lần cuối /)).toBeInTheDocument();
  });
});

describe('AdjustDrawer — chỉ giảm sau khóa sổ (R-D6.3)', () => {
  it('không phần tử nào là "+"/"Tăng"/"Thêm <món>", không còn "Thêm món vào phiếu" (chỉ còn review "Thêm vào danh mục" của món ngoài DM)', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    expect(within(drawer).queryAllByRole('button', { name: /^(\+|Tăng|Thêm (?!vào danh mục —))/ })).toHaveLength(0);
    expect(within(drawer).queryAllByRole('button').filter((b) => b.textContent?.trim() === '+')).toHaveLength(0);
    expect(within(drawer).queryByText(/Thêm món vào phiếu/)).toBeNull();
    expect(less(drawer, 'Giấy note vàng')).toBeEnabled();
  });

  it('gõ 7 với số cũ 5 → về 5 + "Không tăng được sau khóa sổ"; gõ 4 → câu đó ẩn', async () => {
    const view = adminRequest();
    view.lines[1] = { ...view.lines[1], qty: 5 };
    stubAdjust({ views: [view] });
    const { drawer } = await renderDrawer();
    const box = within(drawer).getByRole('spinbutton', { name: 'Giấy note vàng' });
    await userEvent.clear(box);
    await userEvent.type(box, '7');
    fireEvent.blur(box);
    expect(box).toHaveValue(5);
    expect(within(row(drawer, 'Giấy note vàng')).getByText('Không tăng được sau khóa sổ')).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, '4');
    expect(box).toHaveValue(4);
    expect(within(drawer).queryByText('Không tăng được sau khóa sổ')).toBeNull();
  });

  it('dòng đã giao 3: ở 4 nút Bớt bấm được, xuống 3 thì vô hiệu; badge "đã giao 3", không có nút bỏ', async () => {
    const view = adminRequest();
    view.lines[0] = { ...view.lines[0], qty: 4 };
    stubAdjust({ views: [view] });
    const { drawer } = await renderDrawer();
    const pen = row(drawer, 'Bút bi xanh');
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    expect(within(pen).getByRole('spinbutton')).toHaveValue(3);
    expect(less(drawer, 'Bút bi xanh')).toBeDisabled();
    expect(within(pen).getByText('đã giao 3')).toBeInTheDocument();
    expect(within(pen).getByText('Trước khi sửa: 4')).toBeInTheDocument();
    expect(within(pen).queryByRole('button', { name: /^Bỏ / })).toBeNull();
  });

  it('bỏ dòng → "Sẽ bỏ khỏi phiếu" + "Giữ lại" (bấm thì trở lại); dòng đã hủy nợ có badge "đã hủy nợ 2"', async () => {
    const view = adminRequest();
    view.lines[0] = { ...view.lines[0], qty: 5, delivered_qty: 3, cancelled_qty: 2 };
    stubAdjust({ views: [view] });
    const { drawer } = await renderDrawer();
    expect(within(row(drawer, 'Bút bi xanh')).getByText('đã hủy nợ 2')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' }));
    const note = row(drawer, 'Giấy note vàng');
    expect(within(note).getByText('Sẽ bỏ khỏi phiếu')).toBeInTheDocument();
    await userEvent.click(within(note).getByRole('button', { name: 'Giữ lại Giấy note vàng' }));
    expect(within(row(drawer, 'Giấy note vàng')).queryByText('Sẽ bỏ khỏi phiếu')).toBeNull();
  });

  it('món đã ngừng: nhãn "Đã ngừng", vẫn giảm được; món chỉ Hành chính: "Chỉ Hành chính", "ram · Hành chính đặt"', async () => {
    stubAdjust({
      views: [
        adminRequest({
          lines: [
            ...adminRequest().lines,
            lineView({ id: 'l-old', item_id: 'i-old', item: facts('Giấy cũ', 'cai', { active: false }), qty: 5 }),
            lineView({ id: 'l-a4', item_id: 'i-a4', item: facts('Giấy A4 Double A', 'ram', { admin_only: true }), qty: 40 }),
          ],
        }),
      ],
    });
    const { drawer } = await renderDrawer();
    expect(within(row(drawer, 'Giấy cũ')).getByText('Đã ngừng')).toBeInTheDocument();
    expect(less(drawer, 'Giấy cũ')).toBeEnabled();
    const a4 = row(drawer, 'Giấy A4 Double A');
    expect(within(a4).getByText('Chỉ Hành chính')).toBeInTheDocument();
    expect(within(a4).getByText('ram · Hành chính đặt')).toBeInTheDocument();
  });

  it('Quay lại sau khi sửa → hỏi "Bỏ thay đổi?"; Ở lại giữ ngăn, Bỏ thay đổi đóng; chân ngăn đếm thay đổi', async () => {
    stubAdjust();
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' }));
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    expect(within(drawer).getByText('2 thay đổi chưa lưu')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Quay lại' }));
    expect(await screen.findByText('Bỏ thay đổi?')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Ở lại'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Quay lại' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('AdjustDrawer — khối lý do từng dòng (R-D6.14)', () => {
  it('chưa giảm → không có khối; giảm 3 → 2 → "Vì sao giảm?" với 5 lựa chọn, báo "Chọn lý do giảm", Lưu vô hiệu tới khi chọn', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    expect(within(drawer).queryByRole('radiogroup')).toBeNull();
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    const group = reasons(drawer, 'Giấy note vàng');
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual(REASONS);
    expect(radios.every((r) => !(r as HTMLInputElement).checked)).toBe(true);
    expect(within(drawer).getByText('Chọn lý do giảm', { selector: '[aria-live]' })).toBeInTheDocument();
    // Không chuyển focus vào khối vừa mở
    expect(less(drawer, 'Giấy note vàng')).toHaveFocus();
    expect(saveButton(drawer)).toBeDisabled();
    await userEvent.click(pick(drawer, 'Giấy note vàng', 'Trùng với phiếu khác'));
    expect(saveButton(drawer)).toBeEnabled();
    expect(within(row(drawer, 'Bút bi xanh')).queryByRole('radiogroup')).toBeNull();
  });

  it('"Khác" bắt buộc ghi thêm ≥ 3 ký tự: rỗng/"ab" → Lưu vô hiệu, "abc" → bật; ô ghi thêm có bộ đếm 200', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    expect(noteBox(drawer, 'Giấy note vàng')).not.toHaveAttribute('aria-required');
    await userEvent.click(pick(drawer, 'Giấy note vàng', 'Khác'));
    expect(noteBox(drawer, 'Giấy note vàng')).toHaveAttribute('aria-required', 'true');
    expect(within(row(drawer, 'Giấy note vàng')).getByText('Chọn "Khác" thì ghi lý do, ít nhất 3 chữ')).toBeInTheDocument();
    expect(saveButton(drawer)).toBeDisabled();
    await userEvent.type(noteBox(drawer, 'Giấy note vàng'), 'ab');
    expect(saveButton(drawer)).toBeDisabled();
    await userEvent.type(noteBox(drawer, 'Giấy note vàng'), 'c');
    expect(saveButton(drawer)).toBeEnabled();
    expect(within(row(drawer, 'Giấy note vàng')).getByText('3/200')).toBeInTheDocument();
  });

  it('ghi thêm 200/201: dán 199 rồi gõ 2 → giữ đúng 200 ký tự, đếm "200/200"', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    await userEvent.click(noteBox(drawer, 'Giấy note vàng'));
    await userEvent.paste('a'.repeat(199));
    expect(within(row(drawer, 'Giấy note vàng')).getByText('199/200')).toBeInTheDocument();
    await userEvent.type(noteBox(drawer, 'Giấy note vàng'), 'bc');
    expect((noteBox(drawer, 'Giấy note vàng') as HTMLTextAreaElement).value).toHaveLength(200);
    expect(within(row(drawer, 'Giấy note vàng')).getByText('200/200')).toBeInTheDocument();
  });

  it('về lại số cũ → khối ẩn nhưng giữ nháp; giảm lại → còn nguyên "Khác" + ghi chú', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    await userEvent.click(pick(drawer, 'Giấy note vàng', 'Khác'));
    await userEvent.type(noteBox(drawer, 'Giấy note vàng'), 'An báo nhầm');
    const box = within(drawer).getByRole('spinbutton', { name: 'Giấy note vàng' });
    await userEvent.clear(box);
    await userEvent.type(box, '3');
    expect(within(row(drawer, 'Giấy note vàng')).queryByRole('radiogroup')).toBeNull();
    expect(saveButton(drawer)).toBeDisabled();
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    expect(pick(drawer, 'Giấy note vàng', 'Khác')).toBeChecked();
    expect(noteBox(drawer, 'Giấy note vàng')).toHaveValue('An báo nhầm');
  });

  it('bấm Bỏ dòng cũng mở khối lý do', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' }));
    expect(reasons(drawer, 'Giấy note vàng')).toBeInTheDocument();
  });

  it('"Dùng cho các món giảm còn lại" ở dòng giảm đầu tiên đã có lý do: chỉ điền dòng chưa chọn, không ghi đè', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    await userEvent.click(less(drawer, 'Bút bi xanh'));
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    await userEvent.click(less(drawer, 'Băng keo 2 mặt'));
    expect(within(drawer).queryByRole('button', { name: 'Dùng cho các món giảm còn lại' })).toBeNull();
    await userEvent.click(pick(drawer, 'Băng keo 2 mặt', 'Trùng với phiếu khác'));
    await userEvent.click(pick(drawer, 'Bút bi xanh', 'Khác'));
    await userEvent.type(noteBox(drawer, 'Bút bi xanh'), 'Phòng đủ bút');
    expect(within(drawer).getAllByRole('button', { name: 'Dùng cho các món giảm còn lại' })).toHaveLength(1);
    await userEvent.click(within(row(drawer, 'Bút bi xanh')).getByRole('button', { name: 'Dùng cho các món giảm còn lại' }));
    expect(pick(drawer, 'Giấy note vàng', 'Khác')).toBeChecked();
    expect(noteBox(drawer, 'Giấy note vàng')).toHaveValue('Phòng đủ bút');
    expect(pick(drawer, 'Băng keo 2 mặt', 'Trùng với phiếu khác')).toBeChecked();
    expect(within(drawer).queryByRole('button', { name: 'Dùng cho các món giảm còn lại' })).toBeNull();
    expect(saveButton(drawer)).toBeEnabled();
  });

  it('dòng vượt tối đa: nhãn "Vượt tối đa hiện tại (4)"; giảm → chọn sẵn "Vượt định mức", đổi được', async () => {
    stubAdjust({ views: [overMaxView()] });
    const { drawer } = await renderDrawer();
    expect(within(row(drawer, 'Giấy note vàng')).getByText('Vượt tối đa hiện tại (4)')).toBeInTheDocument();
    expect(within(row(drawer, 'Bút bi xanh')).queryByText(/Vượt tối đa/)).toBeNull();
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    expect(pick(drawer, 'Giấy note vàng', 'Vượt định mức')).toBeChecked();
    expect(saveButton(drawer)).toBeEnabled();
    await userEvent.click(pick(drawer, 'Giấy note vàng', 'ADM không còn hàng'));
    expect(pick(drawer, 'Giấy note vàng', 'ADM không còn hàng')).toBeChecked();
  });

  it('mở từ ?left=1 → dòng giảm chọn sẵn "Người đã nghỉ", không bắt ghi thêm', async () => {
    stubAdjust({ views: [overMaxView()] });
    const { drawer } = await renderDrawer({ preset: 'user_left' });
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    expect(pick(drawer, 'Giấy note vàng', 'Người đã nghỉ')).toBeChecked();
    expect(noteBox(drawer, 'Giấy note vàng')).not.toHaveAttribute('aria-required');
    expect(saveButton(drawer)).toBeEnabled();
  });
});

describe('AdjustDrawer — giảm sau khi đã gửi ADM (W11, R-D17.6)', () => {
  it('kỳ đã có bản: hạ 5 → 3 → W11 ngay dưới dòng trước khi Lưu, n = 2; không chặn Lưu', async () => {
    const view = adminRequest();
    view.lines[1] = { ...view.lines[1], qty: 5 };
    stubAdjust({ views: [view], send: SENT });
    const { drawer } = await renderDrawer();
    const text = 'Phiếu gửi ADM lúc 22:12 05/11 đã tính số cũ — giảm bây giờ thì hàng về dư 2 bịch vào kho.';
    expect(within(drawer).queryByText(text)).toBeNull();
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    expect(await within(row(drawer, 'Giấy note vàng')).findByText(text)).toBeInTheDocument();
    expect(within(row(drawer, 'Bút bi xanh')).queryByText(/Phiếu gửi ADM/)).toBeNull();
    await userEvent.click(pick(drawer, 'Giấy note vàng', 'Vượt định mức'));
    expect(saveButton(drawer)).toBeEnabled();
  });

  it('kỳ chưa có bản → không có W11', async () => {
    stubAdjust();
    const { drawer } = await renderDrawer();
    await userEvent.click(less(drawer, 'Giấy note vàng'));
    await waitFor(() => expect(reasons(drawer, 'Giấy note vàng')).toBeInTheDocument());
    expect(within(drawer).queryByText(/Phiếu gửi ADM/)).toBeNull();
  });
});

describe('AdjustDrawer — món thuộc nhóm đang ngừng (active, usable=false)', () => {
  it('dòng đã có của món đó: chỉ giảm/bỏ, nhãn "Đã ngừng"', async () => {
    const paused = adminItem({ id: 'i-paused', name: 'Giấy nhóm ngừng', usable: false });
    stubAdjust({
      items: [...ADMIN_ITEMS, paused],
      views: [adminRequest({ lines: [...adminRequest().lines, lineView({ id: 'l-paused', item_id: 'i-paused', item: facts('Giấy nhóm ngừng', 'cai'), qty: 4 })] })],
    });
    const { drawer } = await renderDrawer();
    expect(less(drawer, 'Giấy nhóm ngừng')).toBeEnabled();
    expect(within(row(drawer, 'Giấy nhóm ngừng')).getByText('Đã ngừng')).toBeInTheDocument();
  });
});
