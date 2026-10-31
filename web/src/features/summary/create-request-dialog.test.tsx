import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import type { DirectoryUser } from '@/features/directory/directory.api';
import { CreateRequestDialog } from './create-request-dialog';
import { ADMIN_ITEMS } from './adjust-fixtures';

const USERS: DirectoryUser[] = [
  { sub: 'u-lan', fullName: 'Võ Thị Lan', email: 'lan@pmh.com.vn', department: 'Tổ Thiết kế', status: 'active' },
  { sub: 'u-old', fullName: 'Người Đã Nghỉ', email: 'old@pmh.com.vn', department: null, status: 'locked' },
];

function stub(post: () => Response) {
  const fetchMock = vi.fn((url: string) => {
    if (url.startsWith('/api/admin/users?')) return Promise.resolve(jsonResponse(200, { items: USERS, next_cursor: null }));
    if (url === '/api/admin/items') return Promise.resolve(jsonResponse(200, ADMIN_ITEMS));
    if (url === '/api/admin/requests') return Promise.resolve(post());
    return Promise.resolve(jsonResponse(404, {}));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderDialog(initialUser: DirectoryUser | null = null) {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const onOpenExisting = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ConfirmProvider>
        <CreateRequestDialog ym="2026-11" initialUser={initialUser} onClose={onClose} onCreated={onCreated} onOpenExisting={onOpenExisting} />
      </ConfirmProvider>
    </MeContext.Provider>,
  );
  const dialog = await screen.findByRole('dialog', { name: 'Tạo phiếu hộ — tháng 11/2026' });
  return { dialog, onClose, onCreated, onOpenExisting };
}

async function fill(dialog: HTMLElement) {
  await userEvent.click(await within(dialog).findByRole('button', { name: /Võ Thị Lan/ }));
  await userEvent.click(within(dialog).getByRole('button', { name: '+ Thêm món vào phiếu' }));
  await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'giấy');
  // Tạo hộ theo luật member: món chỉ Hành chính không có trong danh sách
  expect(within(dialog).queryByRole('button', { name: /Giấy A4/ })).toBeNull();
  await userEvent.click(within(dialog).getByRole('button', { name: /Giấy note vàng/ }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm Số lượng Giấy note vàng' }));
}

afterEach(() => vi.unstubAllGlobals());

describe('CreateRequestDialog — tạo phiếu hộ', () => {
  it('ô Người đăng ký tìm với exclude_admin=true (Hành chính không hiện để chọn)', async () => {
    const fetchMock = stub(() => jsonResponse(201, { request: { id: 'r-new' } }));
    await renderDialog();
    await waitFor(() =>
      expect((fetchMock.mock.calls as unknown as [string][]).some(([u]) => u.startsWith('/api/admin/users?') && u.includes('exclude_admin=true'))).toBe(true),
    );
  });

  it('chưa chọn người/món → Tạo phiếu vô hiệu; người đã khóa không chọn được; gửi {user_sub, lines}', async () => {
    const fetchMock = stub(() => jsonResponse(201, { request: { id: 'r-new' } }));
    const { dialog, onCreated } = await renderDialog();
    const submit = within(dialog).getByRole('button', { name: 'Tạo phiếu' });
    expect(submit).toBeDisabled();
    expect(await within(dialog).findByRole('button', { name: /Người Đã Nghỉ/ })).toBeDisabled();
    await fill(dialog);
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/admin/requests') as unknown as [string, RequestInit];
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(String(call[1].body))).toEqual({ user_sub: 'u-lan', lines: [{ item_id: 'i-note', qty: 2 }] });
  });

  it('mở từ hàng "chưa đăng ký" (initialUser) → người đã chọn sẵn, chỉ cần thêm món rồi gửi đúng user_sub', async () => {
    const fetchMock = stub(() => jsonResponse(201, { request: { id: 'r-new' } }));
    const { dialog, onCreated } = await renderDialog(USERS[0]);
    expect(within(dialog).getByText(/Võ Thị Lan/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    await userEvent.click(await within(dialog).findByRole('button', { name: /Giấy note vàng/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo phiếu' }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const call = fetchMock.mock.calls.find((c) => c[0] === '/api/admin/requests') as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual({ user_sub: 'u-lan', lines: [{ item_id: 'i-note', qty: 1 }] });
  });

  it('REQUEST_EXISTS → "Người này đã có phiếu — mở Điều chỉnh" + nút mở ngăn của đúng người', async () => {
    const fetchMock = stub(() => jsonResponse(409, { code: 'REQUEST_EXISTS', request_id: 'r-lan' }));
    const { dialog, onOpenExisting, onCreated } = await renderDialog();
    await fill(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo phiếu' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Người này đã có phiếu — mở Điều chỉnh');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mở Điều chỉnh' }));
    expect(onOpenExisting).toHaveBeenCalledWith('r-lan');
    expect(onCreated).not.toHaveBeenCalled();
    // id có sẵn trong lỗi: không phải tìm lại qua danh sách người
    expect(fetchMock.mock.calls.some((c) => String(c[0]).includes('/requests?'))).toBe(false);
  });

  it('USER_INACTIVE → lỗi tại ô người đăng ký', async () => {
    stub(() => jsonResponse(400, { code: 'USER_INACTIVE' }));
    const { dialog } = await renderDialog();
    await fill(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo phiếu' }));
    expect(await within(dialog).findByText('Người này không còn hoạt động — chọn người khác.')).toBeInTheDocument();
  });

  it('USER_IS_ADMIN → lỗi tại ô người đăng ký, không ở đầu form', async () => {
    stub(() => jsonResponse(400, { code: 'USER_IS_ADMIN' }));
    const { dialog } = await renderDialog();
    await fill(dialog);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Tạo phiếu' }));
    expect(await within(dialog).findByText('Người này là Hành chính — Hành chính không đăng ký VPP.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Không tạo được phiếu — thử lại.')).toBeNull();
  });

  it('Enter trong ô tìm món không tạo phiếu sớm', async () => {
    const fetchMock = stub(() => jsonResponse(201, { request: { id: 'r-new' } }));
    const { dialog, onCreated } = await renderDialog();
    await fill(dialog);
    await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'zzz{Enter}');
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/admin/requests')).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
  });
});
