import { describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';

const CONFIG = {
  registration_last_day: 10,
  default_max_qty: 20,
  admin_group: 'vpp-admin',
  authorized_groups: ['vpp-users', 'cong-trinh'],
  low_stock_notify: true,
  signers: { preparer: 'Lê Thị Bình', head: '', approver: '' },
  admin_contact: 'chị Bình — Hành chính',
};

function stubApi(put: (body: Record<string, unknown>) => Response) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/admin/config' && init?.method === 'PUT') {
      return Promise.resolve(put(JSON.parse(init.body as string) as Record<string, unknown>));
    }
    if (url === '/api/admin/config') return Promise.resolve(jsonResponse(200, CONFIG));
    return Promise.resolve(jsonResponse(404, null));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const putCalls = (m: ReturnType<typeof stubApi>) =>
  m.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');

async function openConfig() {
  mockViewport(1280);
  renderApp(makeMe('admin'), '/admin/config');
  await screen.findByDisplayValue('vpp-admin');
}

describe('ConfigPage', () => {
  it('hiện giá trị hiện tại, chú thích "kỳ đang mở giữ hạn cũ" và nhóm được dùng app chỉ đọc', async () => {
    stubApi(() => jsonResponse(200, CONFIG));
    await openConfig();
    expect(screen.getByLabelText('Ngày hạn đăng ký hằng tháng')).toHaveValue(10);
    expect(screen.getByLabelText('Số lượng tối đa mặc định mỗi món')).toHaveValue(20);
    expect(screen.getByText('Chỉ áp dụng cho kỳ tạo sau; kỳ đang mở giữ hạn cũ')).toBeInTheDocument();
    expect(screen.getByLabelText('Người lập')).toHaveValue('Lê Thị Bình');
    expect(screen.getByLabelText('Tên và cách liên hệ Hành chính')).toHaveValue('chị Bình — Hành chính');
    const groups = screen.getByRole('list', { name: 'Nhóm PMH ID được dùng app' });
    expect(within(groups).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['vpp-users', 'cong-trinh']);
    expect(screen.queryByRole('textbox', { name: 'Nhóm PMH ID được dùng app' })).toBeNull();
  });

  it('nhập 29 vào ngày hạn → lỗi gắn ô ngay, không gửi lên server', async () => {
    const fetchMock = stubApi(() => jsonResponse(200, CONFIG));
    await openConfig();
    const day = screen.getByLabelText('Ngày hạn đăng ký hằng tháng');
    await userEvent.clear(day);
    await userEvent.type(day, '29');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
    expect(day).toHaveAttribute('aria-invalid', 'true');
    expect(day).toHaveAccessibleDescription('Nhập số từ 3 đến 28.');
    expect(putCalls(fetchMock)).toHaveLength(0);
  });

  it('server trả CONFIG_INVALID {field: admin_group} → lỗi gắn đúng ô nhóm Hành chính', async () => {
    stubApi(() =>
      jsonResponse(400, { code: 'CONFIG_INVALID', message: 'Giá trị cấu hình không hợp lệ: admin_group.', field: 'admin_group' }),
    );
    await openConfig();
    const group = screen.getByLabelText('Nhóm PMH ID của Hành chính');
    await userEvent.clear(group);
    await userEvent.type(group, 'nhom-moi');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu quyền Hành chính' }));
    await vi.waitFor(() => expect(group).toHaveAttribute('aria-invalid', 'true'));
    expect(group).toHaveAccessibleDescription('Nhập tên nhóm PMH ID (không để trống, tối đa 200 ký tự).');
    expect(screen.getByLabelText('Ngày hạn đăng ký hằng tháng')).not.toHaveAttribute('aria-invalid');
  });

  it('chỉ đổi người ký "Trưởng phòng" → body chỉ có {signers: {head}} kèm X-CSRF-Token, báo "Đã lưu"', async () => {
    const fetchMock = stubApi(() => jsonResponse(200, { ...CONFIG, signers: { ...CONFIG.signers, head: 'Trần Văn Cường' } }));
    await openConfig();
    await userEvent.type(screen.getByLabelText('Trưởng phòng'), 'Trần Văn Cường');
    const signers = screen.getByRole('form', { name: 'Người ký báo cáo' });
    await userEvent.click(within(signers).getByRole('button', { name: 'Lưu người ký' }));
    expect(await within(signers).findByRole('status')).toHaveTextContent('Đã lưu.');
    const [[, init]] = putCalls(fetchMock) as [[string, RequestInit]];
    expect(JSON.parse(init.body as string)).toEqual({ signers: { head: 'Trần Văn Cường' } });
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
    expect(within(signers).getByRole('button', { name: 'Lưu người ký' })).toBeDisabled();
  });

  it('chỉ đổi số tối đa mặc định → body chỉ có default_max_qty', async () => {
    const fetchMock = stubApi(() => jsonResponse(200, { ...CONFIG, default_max_qty: 25 }));
    await openConfig();
    const max = screen.getByLabelText('Số lượng tối đa mặc định mỗi món');
    await userEvent.clear(max);
    await userEvent.type(max, '25');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
    await vi.waitFor(() => expect(putCalls(fetchMock)).toHaveLength(1));
    const [[, init]] = putCalls(fetchMock) as [[string, RequestInit]];
    expect(JSON.parse(init.body as string)).toEqual({ default_max_qty: 25 });
  });

  it('chưa sửa gì → mọi nút Lưu bị vô hiệu, không gửi PUT', async () => {
    const fetchMock = stubApi(() => jsonResponse(200, CONFIG));
    await openConfig();
    for (const name of ['Lưu kỳ đăng ký', 'Lưu quyền Hành chính', 'Lưu người ký', 'Lưu liên hệ']) {
      const button = screen.getByRole('button', { name });
      expect(button).toBeDisabled();
      await userEvent.click(button);
    }
    expect(putCalls(fetchMock)).toHaveLength(0);
  });

  it('sửa lại ô đang báo lỗi → lỗi của ô đó biến mất', async () => {
    stubApi(() => jsonResponse(200, CONFIG));
    await openConfig();
    const day = screen.getByLabelText('Ngày hạn đăng ký hằng tháng');
    await userEvent.clear(day);
    await userEvent.type(day, '29');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
    expect(day).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(day, '{Backspace}');
    expect(day).not.toHaveAttribute('aria-invalid');
  });

  it('CONFIG_INVALID {field: signers.head} → lỗi gắn ô Trưởng phòng', async () => {
    stubApi(() => jsonResponse(400, { code: 'CONFIG_INVALID', field: 'signers.head' }));
    await openConfig();
    const head = screen.getByLabelText('Trưởng phòng');
    await userEvent.type(head, 'Trần Văn Cường');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu người ký' }));
    await vi.waitFor(() => expect(head).toHaveAttribute('aria-invalid', 'true'));
    expect(head).toHaveAccessibleDescription('Tên tối đa 200 ký tự.');
  });
});
