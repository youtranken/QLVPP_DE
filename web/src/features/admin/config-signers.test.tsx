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

  it('"Thêm ô ký" ẩn khi đủ 3 ô; "Xóa ô ký" ẩn khi chỉ còn 1 ô', async () => {
    stubConfigApi();
    await openConfig();
    await userEvent.click(within(signers()).getByRole('button', { name: 'Thêm ô ký' }));
    expect(row(3)).toBeInTheDocument();
    expect(within(signers()).queryByRole('button', { name: 'Thêm ô ký' })).toBeNull();
    expect(within(signers()).getAllByRole('button', { name: 'Xóa ô ký' })).toHaveLength(3);
    await userEvent.click(within(row(3)).getByRole('button', { name: 'Xóa ô ký' }));
    expect(within(signers()).getByRole('button', { name: 'Thêm ô ký' })).toBeInTheDocument();
    await userEvent.click(within(row(2)).getByRole('button', { name: 'Xóa ô ký' }));
    expect(within(signers()).getAllByRole('group')).toHaveLength(1);
    expect(within(signers()).queryByRole('button', { name: 'Xóa ô ký' })).toBeNull();
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

  it('thêm ô thứ 3 → gửi 3 phần tử, ô mới có chức danh đã nhập và tên trống', async () => {
    const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...body }));
    await openConfig();
    await userEvent.click(within(signers()).getByRole('button', { name: 'Thêm ô ký' }));
    await userEvent.type(within(row(3)).getByLabelText(/^Chức danh/, { selector: 'input[aria-required]' }), 'Duyệt');
    await saveSigners();
    await vi.waitFor(() => expect(putBodies(fetchMock)).toHaveLength(1));
    expect(putBodies(fetchMock)[0]).toEqual({
      signature_boxes: [...CONFIG.signature_boxes, { title: 'Duyệt', title_en: '', name: '' }],
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

  it('CONFIG_INVALID {field: signature_boxes.2.title_en} → lỗi tại ô Chức danh tiếng Anh hàng 3', async () => {
    stubConfigApi(() => configInvalid('signature_boxes.2.title_en'));
    await openConfig();
    await userEvent.click(within(signers()).getByRole('button', { name: 'Thêm ô ký' }));
    await userEvent.type(within(row(3)).getByLabelText(/^Chức danh/, { selector: 'input[aria-required]' }), 'Duyệt');
    await saveSigners();
    const en = within(row(3)).getByLabelText('Chức danh tiếng Anh');
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

  it('xem trước như bản in: chức danh ở đầu ô, tên hoặc dòng chấm để ký tay', async () => {
    stubConfigApi();
    await openConfig();
    const table = within(signers()).getByRole('table', { name: 'Xem trước ô ký' });
    expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Chủ quản đơn vị', 'Người yêu cầu']);
    expect(within(table).getByRole('cell', { name: 'Lê Thị Bình' })).toBeInTheDocument();
    expect(within(table).getAllByRole('cell')[0]).toHaveTextContent('…');
  });

  it('giao diện en: tên hàng và xem trước dùng title_en, ô thiếu title_en dùng title', async () => {
    const boxes = [CONFIG.signature_boxes[0], { ...CONFIG.signature_boxes[1], title_en: '' }];
    stubConfigApi(undefined, (url, init) => (url === '/api/admin/config' && !init?.method ? jsonResponse(200, { ...CONFIG, signature_boxes: boxes }) : undefined));
    await i18n.changeLanguage('en');
    try {
      await openConfig();
      const form = screen.getByRole('form', { name: 'Signature boxes on the request form' });
      expect(within(form).getByRole('group', { name: 'Box 1 · Head of Dept.' })).toBeInTheDocument();
      expect(within(form).getByRole('group', { name: 'Box 2 · Người yêu cầu' })).toBeInTheDocument();
      const table = within(form).getByRole('table');
      expect(within(table).getAllByRole('columnheader').map((th) => th.textContent)).toEqual(['Head of Dept.', 'Người yêu cầu']);
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});
