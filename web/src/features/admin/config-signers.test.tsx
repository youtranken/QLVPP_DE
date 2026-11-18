import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import i18n from '@/lib/i18n';
import { CONFIG, block, configInvalid, openConfig, putBodies, putHeaders, stubConfigApi } from './config-fixtures';

afterEach(() => vi.unstubAllGlobals());

const signers = () => block('Ô ký trên phiếu đề xuất');
const row = (n: number) => within(signers()).getByRole('group', { name: new RegExp(`^Ô ký ${n}\\b`) });
const saveSigners = () => userEvent.click(within(signers()).getByRole('button', { name: 'Lưu ô ký' }));

describe('Cấu hình · khối Ô ký trên phiếu đề xuất', () => {
  it('mỗi hàng có Chức danh *, Chức danh tiếng Anh, Người ký với maxLength 60/60/200', async () => {
    stubConfigApi();
    await openConfig();
    const second = row(2);
    expect(within(second).getByLabelText(/^Chức danh/, { selector: 'input[aria-required]' })).toHaveValue('Người yêu cầu');
    expect(within(second).getByLabelText(/^Chức danh/, { selector: 'input[aria-required]' })).toHaveAttribute('maxLength', '60');
    expect(within(second).getByLabelText('Chức danh tiếng Anh')).toHaveAttribute('maxLength', '60');
    expect(within(second).getByLabelText('Người ký')).toHaveValue('Lê Thị Bình');
    expect(within(second).getByLabelText('Người ký')).toHaveAttribute('maxLength', '200');
  });

  it('AD-56 biên: 2 ô → không ô nào "Không in", "Thêm ô ký" bật; thêm ô 3 → ô 3 mang nhãn "Không in", nút tắt; câu cạnh nút luôn "Tối đa 3 ô; phiếu in 2 ô đầu"', async () => {
    stubConfigApi();
    await openConfig();
    const add = () => within(signers()).getByRole('button', { name: 'Thêm ô ký' });
    expect(add()).toBeEnabled();
    expect(add()).toHaveAccessibleDescription('Tối đa 3 ô; phiếu in 2 ô đầu');
    expect(within(signers()).queryByText('Không in')).toBeNull();
    expect(within(signers()).queryByText(/Đã đủ|Phiếu chỉ in/)).toBeNull();
    await userEvent.click(add());
    expect(within(row(3)).getByText('Không in')).toBeInTheDocument();
    expect(within(row(2)).queryByText('Không in')).toBeNull();
    expect(add()).toBeDisabled();
    expect(add()).toHaveAccessibleDescription('Tối đa 3 ô; phiếu in 2 ô đầu');
  });

  it('còn 1 ô thì không xóa được; xóa ô 2 rồi thêm lại vẫn bật nút', async () => {
    stubConfigApi();
    await openConfig();
    await userEvent.click(within(row(2)).getByRole('button', { name: 'Xóa ô ký 2 · Người yêu cầu' }));
    expect(within(row(1)).queryByRole('button', { name: /^Xóa ô ký/ })).toBeNull();
    await userEvent.click(within(signers()).getByRole('button', { name: 'Thêm ô ký' }));
    expect(row(2)).toBeInTheDocument();
    expect(within(signers()).getByRole('button', { name: 'Thêm ô ký' })).toBeEnabled();
  });

  it('Thêm ô ký → ô Chức danh mới trống chưa báo lỗi (chưa chạm), nút Lưu khóa kèm lý do; gõ rồi xóa hết → báo lỗi', async () => {
    stubConfigApi();
    await openConfig();
    await userEvent.click(within(row(2)).getByRole('button', { name: 'Xóa ô ký 2 · Người yêu cầu' }));
    await userEvent.click(within(signers()).getByRole('button', { name: 'Thêm ô ký' }));
    const title = within(row(2)).getByLabelText(/^Chức danh/, { selector: 'input[aria-required]' });
    expect(title).not.toHaveAttribute('aria-invalid');
    expect(within(signers()).getByRole('button', { name: 'Lưu ô ký' })).toBeDisabled();
    await userEvent.type(title, 'x');
    await userEvent.clear(title);
    expect(title).toHaveAttribute('aria-invalid', 'true');
  });

  it('nút Xóa có nhãn kèm tên ô (ô chưa có chức danh thì chỉ số ô)', async () => {
    stubConfigApi();
    await openConfig();
    expect(within(row(1)).getByRole('button', { name: 'Xóa ô ký 1 · Chủ quản đơn vị' })).toHaveTextContent('Xóa ô ký');
    await userEvent.clear(within(row(2)).getByLabelText(/^Chức danh/, { selector: 'input[aria-required]' }));
    expect(within(row(2)).getByRole('button', { name: 'Xóa ô ký 2' })).toBeInTheDocument();
  });

  it('cấu hình 3 ô: ô thứ 3 mờ kèm nhãn "Không in", vẫn sửa/xóa được; xem trước chỉ 2 ô đầu', async () => {
    const boxes = [...CONFIG.signature_boxes, { title: 'Duyệt', title_en: 'Approved by', name: 'Đỗ Minh Châu' }];
    stubConfigApi(undefined, (url, init) => (url === '/api/admin/config' && !init?.method ? jsonResponse(200, { ...CONFIG, signature_boxes: boxes }) : undefined));
    await openConfig();
    const third = row(3);
    expect(third).toHaveClass('cf-box--off');
    expect(within(third).getByText('Không in')).toBeInTheDocument();
    expect(within(row(1)).queryByText('Không in')).toBeNull();
    expect(within(third).getByLabelText('Người ký')).toBeEnabled();
    const preview = within(signers()).getByRole('group', { name: 'Chữ ký' });
    expect(within(preview).getAllByRole('group').map((g) => g.getAttribute('aria-label'))).toEqual(['Chủ quản đơn vị', 'Người yêu cầu']);
    await userEvent.click(within(third).getByRole('button', { name: 'Xóa ô ký 3 · Duyệt' }));
    expect(within(signers()).queryByText('Không in')).toBeNull();
  });

  it('sửa người ký → gửi cả mảng signature_boxes (giữ chức danh), kèm X-CSRF-Token, chỉ khóa của khối', async () => {
    const boxes = [{ ...CONFIG.signature_boxes[0], name: 'Trần Văn Cường' }, CONFIG.signature_boxes[1]];
    const fetchMock = stubConfigApi(() => jsonResponse(200, { ...CONFIG, signature_boxes: boxes }));
    await openConfig();
    await userEvent.type(within(row(1)).getByLabelText('Người ký'), 'Trần Văn Cường');
    await saveSigners();
    expect(await within(signers()).findByText('Đã lưu.')).toBeInTheDocument();
    expect(putBodies(fetchMock)).toEqual([{ signature_boxes: boxes }]);
    expect(putHeaders(fetchMock)[0]['X-CSRF-Token']).toBe('csrf-1');
    expect(within(signers()).getByRole('button', { name: 'Chưa có thay đổi' })).toBeDisabled();
  });

  it('xóa ô 2 rồi thêm lại → gửi 2 phần tử, ô mới có chức danh đã nhập và tên trống', async () => {
    const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...body }));
    await openConfig();
    await userEvent.click(within(row(2)).getByRole('button', { name: /^Xóa ô ký 2/ }));
    await userEvent.click(within(signers()).getByRole('button', { name: 'Thêm ô ký' }));
    await userEvent.type(within(row(2)).getByLabelText(/^Chức danh/, { selector: 'input[aria-required]' }), 'Duyệt');
    await saveSigners();
    await vi.waitFor(() => expect(putBodies(fetchMock)).toHaveLength(1));
    expect(putBodies(fetchMock)[0]).toEqual({
      signature_boxes: [CONFIG.signature_boxes[0], { title: 'Duyệt', title_en: '', name: '' }],
    });
  });

  it('chức danh để trống → lỗi tại ô của đúng hàng, không gửi', async () => {
    const fetchMock = stubConfigApi();
    await openConfig();
    const title = within(row(2)).getByLabelText(/^Chức danh/, { selector: 'input[aria-required]' });
    await userEvent.clear(title);
    await saveSigners();
    expect(title).toHaveAccessibleDescription('Nhập chức danh, tối đa 60 ký tự.');
    expect(putBodies(fetchMock)).toHaveLength(0);
  });

  it('CONFIG_INVALID {field: signature_boxes.1.title} → lỗi tại ô Chức danh hàng 2, hàng 1 không lỗi', async () => {
    stubConfigApi(() => configInvalid('signature_boxes.1.title'));
    await openConfig();
    await userEvent.type(within(row(1)).getByLabelText('Người ký'), 'A');
    await saveSigners();
    const title2 = within(row(2)).getByLabelText(/^Chức danh/, { selector: 'input[aria-required]' });
    await vi.waitFor(() => expect(title2).toHaveAttribute('aria-invalid', 'true'));
    expect(title2).toHaveAccessibleDescription('Nhập chức danh, tối đa 60 ký tự.');
    expect(within(row(1)).getByLabelText(/^Chức danh/, { selector: 'input[aria-required]' })).not.toHaveAttribute('aria-invalid');
  });

  it('CONFIG_INVALID {field: signature_boxes.0.name} (201 ký tự) → lỗi tại ô Người ký hàng 1', async () => {
    stubConfigApi(() => configInvalid('signature_boxes.0.name'));
    await openConfig();
    const name = within(row(1)).getByLabelText('Người ký');
    await userEvent.type(name, 'Trần Văn Cường');
    await saveSigners();
    await vi.waitFor(() => expect(name).toHaveAttribute('aria-invalid', 'true'));
    expect(name).toHaveAccessibleDescription('Tên tối đa 200 ký tự.');
  });

  it('CONFIG_INVALID {field: signature_boxes.1.title_en} → lỗi tại ô Chức danh tiếng Anh hàng 2', async () => {
    stubConfigApi(() => configInvalid('signature_boxes.1.title_en'));
    await openConfig();
    await userEvent.type(within(row(2)).getByLabelText('Chức danh tiếng Anh'), 'x');
    await saveSigners();
    const en = within(row(2)).getByLabelText('Chức danh tiếng Anh');
    await vi.waitFor(() => expect(en).toHaveAttribute('aria-invalid', 'true'));
    expect(en).toHaveAccessibleDescription('Tối đa 60 ký tự.');
  });

  it('người ký 200 ký tự gửi đi nguyên vẹn', async () => {
    const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...body }));
    await openConfig();
    const name = within(row(1)).getByLabelText('Người ký');
    await userEvent.click(name);
    await userEvent.paste('a'.repeat(200));
    await saveSigners();
    await vi.waitFor(() => expect(putBodies(fetchMock)).toHaveLength(1));
    const sent = putBodies(fetchMock)[0].signature_boxes as { name: string }[];
    expect(sent[0].name).toHaveLength(200);
  });

  it('"Xem trước chân phiếu" dùng đúng ô ký của tờ in: chức danh song ngữ, tên hoặc dòng chấm để ký tay', async () => {
    stubConfigApi();
    await openConfig();
    const region = within(signers()).getByRole('region', { name: 'Xem trước chân phiếu' });
    const preview = within(region).getByRole('group', { name: 'Chữ ký' });
    expect(preview).toHaveClass('pp-signs');
    expect(within(preview).getByRole('group', { name: 'Chủ quản đơn vị' })).toContainElement(within(preview).getByTestId('sign-dots'));
    expect(within(preview).getByRole('group', { name: 'Người yêu cầu' })).toHaveTextContent('Lê Thị Bình');
    await userEvent.type(within(row(1)).getByLabelText('Người ký'), 'Trần Văn Cường');
    expect(within(preview).getByRole('group', { name: 'Chủ quản đơn vị' })).toHaveTextContent('Trần Văn Cường');
  });

  it('giao diện en: tên hàng dùng title_en, ô thiếu title_en dùng title; nhãn Xóa và xem trước bằng en', async () => {
    const boxes = [CONFIG.signature_boxes[0], { ...CONFIG.signature_boxes[1], title_en: '' }];
    stubConfigApi(undefined, (url, init) => (url === '/api/admin/config' && !init?.method ? jsonResponse(200, { ...CONFIG, signature_boxes: boxes }) : undefined));
    await i18n.changeLanguage('en');
    try {
      await openConfig();
      const form = screen.getByRole('form', { name: 'Signature boxes on the request form' });
      expect(within(form).getByRole('group', { name: 'Box 1 · Head of Dept.' })).toBeInTheDocument();
      expect(within(form).getByRole('group', { name: 'Box 2 · Người yêu cầu' })).toBeInTheDocument();
      // Chân phiếu theo mẫu D&E: in cả chức danh tiếng Việt, không theo ngôn ngữ giao diện
      expect(within(form).getByRole('region', { name: 'Footer preview' })).toBeInTheDocument();
      expect(within(form).getByRole('button', { name: 'Remove signature box 1 · Head of Dept.' })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});
