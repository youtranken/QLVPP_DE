import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { renderApp } from '@/test/render-app';
import { mockViewport } from '@/test/viewport';
import { CONFIG, block, configInvalid, openConfig, putBodies, stubConfigApi } from './config-fixtures';

afterEach(() => vi.unstubAllGlobals());

const group = () => screen.getByLabelText('Nhóm PMH ID của Hành chính');
const contact = () => screen.getByLabelText('Tên và cách liên hệ Hành chính');
const saveAccess = () => userEvent.click(screen.getByRole('button', { name: 'Lưu quyền Hành chính' }));

async function retype(el: HTMLElement, value: string) {
  await userEvent.clear(el);
  await userEvent.type(el, value);
}

describe('Cấu hình · trang', () => {
  it('đầu trang có đúng một h1, mô tả, 4 khối; không còn khối "Lưu thế nào", thay bằng một dòng dưới mỗi nút Lưu', async () => {
    stubConfigApi();
    await openConfig();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Cấu hình' })).toBeInTheDocument();
    expect(screen.getByText('Tham số chung của app, áp dụng cho mọi người dùng.', { exact: true })).toBeInTheDocument();
    for (const name of ['Kỳ đăng ký', 'Quyền Hành chính', 'Ô ký trên phiếu đề xuất', 'Liên hệ & thông báo']) expect(block(name)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Lưu thế nào' })).toBeNull();
    for (const name of ['Kỳ đăng ký', 'Quyền Hành chính', 'Ô ký trên phiếu đề xuất', 'Liên hệ & thông báo']) {
      expect(within(block(name)).getByText('Chỉ lưu khối này · ghi vào Nhật ký')).toBeInTheDocument();
    }
  });

  it('nhãn ngắn: "Hạn đăng ký (ngày)", "Nhắc trước (ngày)", "Tối đa mỗi món"', async () => {
    stubConfigApi();
    await openConfig();
    for (const label of ['Hạn đăng ký (ngày)', 'Nhắc trước (ngày)', 'Tối đa mỗi món']) expect(screen.getByLabelText(label)).toBeInTheDocument();
  });

  it('đang tải cấu hình vẫn có đầu trang: đúng một h1 "Cấu hình"', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/config');
    expect(await screen.findByRole('heading', { level: 1, name: 'Cấu hình' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('lỗi tải cấu hình → "Không tải được dữ liệu — thử lại." + Thử lại', async () => {
    stubConfigApi(undefined, (url) => (url === '/api/admin/config' ? jsonResponse(500, { code: 'INTERNAL' }) : undefined));
    await openConfig().catch(() => undefined);
    expect(await screen.findByText('Không tải được dữ liệu — thử lại.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('chưa sửa gì → cả 4 nút Lưu ghi "Chưa có thay đổi" và vô hiệu, không gửi PUT; đầu trang không có nhãn "khối chưa lưu"', async () => {
    const fetchMock = stubConfigApi();
    await openConfig();
    for (const name of ['Kỳ đăng ký', 'Quyền Hành chính', 'Ô ký trên phiếu đề xuất', 'Liên hệ & thông báo']) {
      const button = within(block(name)).getByRole('button', { name: 'Chưa có thay đổi' });
      expect(button).toBeDisabled();
      await userEvent.click(button);
    }
    expect(putBodies(fetchMock)).toHaveLength(0);
    expect(screen.queryByText(/khối chưa lưu/)).toBeNull();
  });

  it('sửa một khối → chỉ nút khối đó thành "Lưu liên hệ" (bật), khối khác vẫn "Chưa có thay đổi"; Hủy → về "Chưa có thay đổi"', async () => {
    stubConfigApi();
    await openConfig();
    await retype(contact(), 'chị Hoa');
    expect(within(block('Liên hệ & thông báo')).getByRole('button', { name: 'Lưu liên hệ' })).toBeEnabled();
    expect(within(block('Kỳ đăng ký')).getByRole('button', { name: 'Chưa có thay đổi' })).toBeDisabled();
    expect(screen.queryByText(/khối chưa lưu/)).toBeNull();
    await userEvent.click(within(block('Liên hệ & thông báo')).getByRole('button', { name: 'Hủy' }));
    expect(contact()).toHaveValue(CONFIG.admin_contact);
    expect(within(block('Liên hệ & thông báo')).getByRole('button', { name: 'Chưa có thay đổi' })).toBeDisabled();
  });

  it('rời trang khi bẩn → hỏi "Bỏ thay đổi?" liệt kê khối; Ở lại thì ở lại', async () => {
    stubConfigApi();
    await openConfig();
    await retype(contact(), 'chị Hoa');
    await userEvent.click(screen.getByRole('link', { name: 'Nhật ký' }));
    const dialog = await screen.findByRole('dialog', { name: 'Bỏ thay đổi?' });
    expect(dialog).toHaveTextContent('Chưa lưu: Liên hệ & thông báo.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Ở lại' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/config');
    await userEvent.click(screen.getByRole('link', { name: 'Nhật ký' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    await vi.waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/admin/audit'));
  });

  it('khi bẩn, đóng tab bị chặn bằng beforeunload; sạch thì không', async () => {
    stubConfigApi();
    await openConfig();
    const clean = new Event('beforeunload', { cancelable: true });
    fireEvent(window, clean);
    expect(clean.defaultPrevented).toBe(false);
    await retype(contact(), 'chị Hoa');
    const dirty = new Event('beforeunload', { cancelable: true });
    fireEvent(window, dirty);
    expect(dirty.defaultPrevented).toBe(true);
  });
});

describe('Cấu hình · khối Quyền Hành chính', () => {
  it('đếm người trong danh bạ thuộc nhóm (không phân biệt hoa thường), nhóm được dùng app chỉ đọc kèm số người', async () => {
    stubConfigApi();
    await openConfig();
    expect(await screen.findByText('1 người trong danh bạ thuộc nhóm này')).toBeInTheDocument();
    const groups = screen.getByRole('list', { name: 'Nhóm PMH ID được dùng app' });
    expect(within(groups).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['vpp-users · 3', 'cong-trinh · 1']);
    expect(screen.queryByRole('textbox', { name: 'Nhóm PMH ID được dùng app' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Mở Danh bạ' })).toHaveAttribute('href', '/admin/users');
  });

  it('nhóm mới có 0 người và người đang đăng nhập không thuộc → cảnh báo tự mất quyền nêu tên', async () => {
    stubConfigApi();
    await openConfig();
    await retype(group(), 'nhom-moi');
    expect(await screen.findByText('0 người trong danh bạ thuộc nhóm này')).toBeInTheDocument();
    expect(
      screen.getByText('Nhóm này chưa có người trong danh bạ. Sau khi lưu, Nguyễn Văn An sẽ mất quyền vào trang quản lý từ lần bấm kế tiếp.'),
    ).toBeInTheDocument();
    await retype(group(), 'VPP-ADMIN');
    expect(screen.queryByText(/sẽ mất quyền vào trang quản lý/)).toBeNull();
  });

  it('nhóm mới có người nhưng không có người đang đăng nhập → vẫn cảnh báo tự mất quyền; nhóm có mình → không', async () => {
    stubConfigApi();
    await openConfig();
    await retype(group(), 'cong-trinh');
    expect(await screen.findByText('1 người trong danh bạ thuộc nhóm này')).toBeInTheDocument();
    expect(
      screen.getByText('Bạn không thuộc nhóm này. Sau khi lưu, Nguyễn Văn An sẽ mất quyền vào trang quản lý từ lần bấm kế tiếp.'),
    ).toBeInTheDocument();
    await retype(group(), 'vpp-users');
    expect(await screen.findByText('3 người trong danh bạ thuộc nhóm này')).toBeInTheDocument();
    expect(screen.queryByText(/sẽ mất quyền vào trang quản lý/)).toBeNull();
  });

  it('SA (không phụ thuộc nhóm) không thấy cảnh báo tự mất quyền', async () => {
    stubConfigApi();
    await openConfig(makeMe('sa', { sub: 'sa-local' }));
    await retype(group(), 'nhom-moi');
    expect(await screen.findByText('0 người trong danh bạ thuộc nhóm này')).toBeInTheDocument();
    expect(screen.queryByText(/sẽ mất quyền vào trang quản lý/)).toBeNull();
  });

  it('không tải được danh bạ → nhắc "Không kiểm được số người trong nhóm — kiểm kỹ trước khi lưu.", không cảnh báo tự mất quyền', async () => {
    stubConfigApi(undefined, (url) => (url.startsWith('/api/admin/users?') ? jsonResponse(500, { code: 'INTERNAL' }) : undefined));
    await openConfig();
    await retype(group(), 'nhom-moi');
    expect(await screen.findByText('Không kiểm được số người trong nhóm — kiểm kỹ trước khi lưu.')).toBeInTheDocument();
    expect(screen.queryByText(/người trong danh bạ thuộc nhóm này/)).toBeNull();
    expect(screen.queryByText(/sẽ mất quyền vào trang quản lý/)).toBeNull();
  });

  it('Lưu hỏi xác nhận nguy hiểm "Đổi nhóm Hành chính?"; Hủy thì không gửi, đồng ý mới gửi admin_group', async () => {
    const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...body }));
    await openConfig();
    await retype(group(), 'nhom-moi');
    await saveAccess();
    let dialog = await screen.findByRole('dialog', { name: 'Đổi nhóm Hành chính?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));
    expect(putBodies(fetchMock)).toHaveLength(0);
    await saveAccess();
    dialog = await screen.findByRole('dialog', { name: 'Đổi nhóm Hành chính?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Đổi nhóm' }));
    await vi.waitFor(() => expect(putBodies(fetchMock)).toEqual([{ admin_group: 'nhom-moi' }]));
  });

  it('CONFIG_INVALID {field: admin_group} → lỗi gắn ô nhóm Hành chính', async () => {
    stubConfigApi(() => configInvalid('admin_group'));
    await openConfig();
    await retype(group(), 'nhom-moi');
    await saveAccess();
    await userEvent.click(await screen.findByRole('button', { name: 'Đổi nhóm' }));
    await vi.waitFor(() => expect(group()).toHaveAttribute('aria-invalid', 'true'));
    expect(group()).toHaveAccessibleDescription('Nhập tên nhóm PMH ID (không để trống, tối đa 200 ký tự).');
    expect(group()).toHaveAttribute('maxLength', '200');
  });
});

describe('Cấu hình · khối Liên hệ & thông báo', () => {
  it('ô liên hệ maxLength 500, đếm "500/500" khi đủ', async () => {
    stubConfigApi();
    await openConfig();
    expect(contact()).toHaveAttribute('maxLength', '500');
    await userEvent.clear(contact());
    await userEvent.click(contact());
    await userEvent.paste('a'.repeat(500));
    expect(within(block('Liên hệ & thông báo')).getByText('500/500')).toBeInTheDocument();
  });

  it('công tắc báo sắp hết + số món sắp hết; lưu chỉ gửi khóa đã đổi của khối, toast "Đã lưu Liên hệ & thông báo"', async () => {
    const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...body }));
    await openConfig();
    expect(await screen.findByText('Hiện có 2 món sắp hết.')).toBeInTheDocument();
    const toggle = screen.getByRole('switch', { name: 'Báo Hành chính khi món sắp hết' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole('button', { name: 'Lưu liên hệ' }));
    await vi.waitFor(() => expect(putBodies(fetchMock)).toEqual([{ low_stock_notify: false }]));
    expect(await screen.findByText('Đã lưu Liên hệ & thông báo')).toBeInTheDocument();
  });

  it('CONFIG_INVALID {field: admin_contact} → lỗi gắn ô liên hệ', async () => {
    stubConfigApi(() => configInvalid('admin_contact'));
    await openConfig();
    await retype(contact(), 'chị Hoa');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu liên hệ' }));
    await vi.waitFor(() => expect(contact()).toHaveAttribute('aria-invalid', 'true'));
    expect(contact()).toHaveAccessibleDescription('Tối đa 500 ký tự.');
  });
});

describe('Cấu hình · Thay đổi gần đây', () => {
  it('hiện 3 dòng mới nhất từ audit config.updated (giờ · người) và liên kết "Xem trong Nhật ký"', async () => {
    const fetchMock = stubConfigApi();
    await openConfig();
    const recent = screen.getByRole('region', { name: 'Thay đổi gần đây' });
    expect(await within(recent).findByText('09:05 31/10 · Nguyễn Văn An')).toBeInTheDocument();
    expect(within(recent).getByRole('link', { name: 'Xem trong Nhật ký' })).toHaveAttribute('href', '/admin/audit?action=config.updated');
    expect(fetchMock.mock.calls.map((c) => String(c[0]))).toContain('/api/admin/audit?action=config.updated&limit=3');
  });

  it('mỗi dòng nói đã đổi gì: chỉ khóa thật sự khác giữa trước/sau, nhãn tiếng Việt; không có trước/sau thì theo mã đối tượng', async () => {
    stubConfigApi();
    await openConfig();
    const recent = screen.getByRole('region', { name: 'Thay đổi gần đây' });
    expect(await within(recent).findByText('Đã đổi: Liên hệ Hành chính')).toBeInTheDocument();
    expect(within(recent).getByText('Đã đổi: Ngày hạn đăng ký')).toBeInTheDocument();
  });

  it('lưu xong → tải lại "Thay đổi gần đây"', async () => {
    const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...body }));
    await openConfig();
    await screen.findByText('09:05 31/10 · Nguyễn Văn An');
    const auditCalls = () => fetchMock.mock.calls.filter((c) => String(c[0]).startsWith('/api/admin/audit?')).length;
    const before = auditCalls();
    await retype(contact(), 'chị Hoa');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu liên hệ' }));
    await vi.waitFor(() => expect(auditCalls()).toBe(before + 1));
  });
});
