import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { PERIOD } from '@/test/request-api-stub';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import type { DirectoryUser } from '@/features/directory/directory.api';
import { CreateRequestDialog } from './create-request-dialog';
import { ADMIN_ITEMS } from './adjust-fixtures';

const USERS: DirectoryUser[] = [
  { sub: 'u-lan', fullName: 'Võ Thị Lan', email: 'lan@pmh.com.vn', department: 'Tổ Thiết kế', status: 'active' },
  { sub: 'u-duc', fullName: 'Phạm Văn Đức', email: 'duc@pmh.com.vn', department: 'Tổ Thiết kế', status: 'active' },
  { sub: 'u-old', fullName: 'Người Đã Nghỉ', email: 'old@pmh.com.vn', department: null, status: 'locked' },
];

function stub(post: () => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url.startsWith('/api/admin/users?')) return jsonResponse(200, { items: USERS, next_cursor: null });
    if (url === '/api/admin/items') return jsonResponse(200, ADMIN_ITEMS);
    if (url === '/api/admin/requests') return post();
    if (url === '/api/periods/current') return jsonResponse(200, PERIOD);
    if (url === '/api/admin/periods/2026-11/unregistered') {
      return jsonResponse(200, { items: [{ sub: 'u-lan', full_name: 'Võ Thị Lan', email: null, department: 'Tổ Thiết kế' }] });
    }
    return jsonResponse(404, {});
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const created = () => jsonResponse(201, { request: { id: 'r-new' } });

async function renderDialog({ initialUser = null, lockedOn }: { initialUser?: DirectoryUser | null; lockedOn?: string | null } = {}) {
  const onClose = vi.fn();
  const onCreated = vi.fn();
  const onOpenExisting = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ToastProvider>
        <ConfirmProvider>
          <CreateRequestDialog
            ym={lockedOn !== undefined ? '2026-10' : '2026-11'}
            lockedOn={lockedOn}
            initialUser={initialUser}
            onClose={onClose}
            onCreated={onCreated}
            onOpenExisting={onOpenExisting}
          />
        </ConfirmProvider>
      </ToastProvider>
    </MeContext.Provider>,
  );
  const dialog = await screen.findByRole('dialog', { name: lockedOn !== undefined ? 'Tạo phiếu hộ — Tháng 10/2026' : 'Tạo phiếu hộ — Tháng 11/2026' });
  return { dialog, onClose, onCreated, onOpenExisting };
}

const submit = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Tạo phiếu' });

async function pickUser(dialog: HTMLElement) {
  await userEvent.click(await within(dialog).findByRole('button', { name: /Võ Thị Lan/ }));
}

async function addNote(dialog: HTMLElement) {
  await userEvent.click(within(dialog).getByRole('button', { name: '+ Thêm món vào phiếu' }));
  await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'giấy');
  // Tạo hộ theo luật member: món chỉ Hành chính không có trong danh sách
  expect(within(dialog).queryByRole('button', { name: /Giấy A4/ })).toBeNull();
  await userEvent.click(within(dialog).getByRole('button', { name: /Giấy note vàng/ }));
  await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm Giấy note vàng' }));
}

async function fill(dialog: HTMLElement) {
  await pickUser(dialog);
  await addNote(dialog);
}

afterEach(() => vi.unstubAllGlobals());

describe('CreateRequestDialog — tạo phiếu hộ', () => {
  it('mô tả, ô "Người đăng ký *" tìm với exclude_admin=true; kết quả kèm "Chưa đăng ký"/"Đã có phiếu"', async () => {
    const f = stub(created);
    const { dialog } = await renderDialog();
    expect(within(dialog).getByText('Đăng ký thay người không tự lưu được phiếu (đi công trường, nghỉ phép).')).toBeInTheDocument();
    expect(within(dialog).getByRole('group', { name: 'Người đăng ký' })).toHaveTextContent('Người đăng ký *');
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).startsWith('/api/admin/users?') && String(u).includes('exclude_admin=true'))).toBe(true));
    expect(await within(dialog).findByRole('button', { name: /Võ Thị Lan/ })).toHaveTextContent('Chưa đăng ký');
    expect(within(dialog).getByRole('button', { name: /Phạm Văn Đức/ })).toHaveTextContent('Đã có phiếu');
    expect(within(dialog).getByRole('button', { name: /Người Đã Nghỉ/ })).toBeDisabled();
  });

  it('gửi thiếu người → "Cần thêm: người đăng ký." ở ô người; thiếu món → "Cần thêm: ít nhất một món."; không POST', async () => {
    const f = stub(created);
    const { dialog } = await renderDialog();
    expect(submit(dialog)).toBeEnabled();
    await userEvent.click(submit(dialog));
    const person = within(dialog).getByRole('searchbox', { name: 'Tìm người đăng ký' });
    expect(person).toHaveAccessibleDescription('Cần thêm: người đăng ký.');
    expect(person).toHaveFocus();
    await pickUser(dialog);
    await userEvent.click(submit(dialog));
    expect(within(dialog).getByText('Cần thêm: ít nhất một món.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '+ Thêm món vào phiếu' })).toHaveFocus();
    expect(f.mock.calls.some((c) => c[0] === '/api/admin/requests')).toBe(false);
  });

  it('chọn người + món → gợi ý luật kỳ có tên và hạn; gửi {user_sub, lines}; toast "Đã tạo phiếu cho …"', async () => {
    const f = stub(created);
    const { dialog, onCreated } = await renderDialog();
    await fill(dialog);
    expect(within(dialog).getByText('Theo luật kỳ: không vượt tối đa/tháng của từng món; Võ Thị Lan vẫn tự sửa được đến hết 10/11.')).toBeInTheDocument();
    await userEvent.click(submit(dialog));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(await screen.findByText('Đã tạo phiếu cho Võ Thị Lan')).toBeInTheDocument();
    const call = f.mock.calls.find((c) => c[0] === '/api/admin/requests') as unknown as [string, RequestInit];
    expect(call[1].method).toBe('POST');
    expect(JSON.parse(String(call[1].body))).toEqual({ user_sub: 'u-lan', lines: [{ item_id: 'i-note', qty: 2 }] });
  });

  it('mở từ hàng "chưa đăng ký" (initialUser) → người chọn sẵn, chỉ cần thêm món', async () => {
    const f = stub(created);
    const { dialog, onCreated } = await renderDialog({ initialUser: USERS[0] });
    expect(within(dialog).getByText(/Võ Thị Lan/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    await userEvent.click(await within(dialog).findByRole('button', { name: /Giấy note vàng/ }));
    await userEvent.click(submit(dialog));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    const call = f.mock.calls.find((c) => c[0] === '/api/admin/requests') as unknown as [string, RequestInit];
    expect(JSON.parse(String(call[1].body))).toEqual({ user_sub: 'u-lan', lines: [{ item_id: 'i-note', qty: 1 }] });
  });

  it('stepper món: min 1 (Bớt vô hiệu ở 1), max theo max_qty (Kẹp giấy 10: Thêm vô hiệu ở 10)', async () => {
    stub(created);
    const { dialog } = await renderDialog();
    await userEvent.click(within(dialog).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'kẹp');
    await userEvent.click(within(dialog).getByRole('button', { name: /Kẹp giấy 33 mm/ }));
    expect(within(dialog).getByRole('button', { name: 'Bớt Kẹp giấy 33 mm' })).toBeDisabled();
    const qty = within(dialog).getByRole('spinbutton', { name: 'Kẹp giấy 33 mm' });
    await userEvent.clear(qty);
    await userEvent.type(qty, '9');
    expect(within(dialog).getByRole('button', { name: 'Thêm Kẹp giấy 33 mm' })).toBeEnabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Thêm Kẹp giấy 33 mm' }));
    expect(qty).toHaveValue(10);
    expect(within(dialog).getByRole('button', { name: 'Thêm Kẹp giấy 33 mm' })).toBeDisabled();
  });

  it('REQUEST_EXISTS → khối "{tên} đã có phiếu tháng 11 — …" + "Mở Điều chỉnh" mở đúng request_id', async () => {
    const f = stub(() => jsonResponse(409, { code: 'REQUEST_EXISTS', request_id: 'r-lan' }));
    const { dialog, onOpenExisting, onCreated } = await renderDialog();
    await fill(dialog);
    await userEvent.click(submit(dialog));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Võ Thị Lan đã có phiếu tháng 11 — sửa phiếu đó thay vì tạo phiếu mới.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mở Điều chỉnh' }));
    expect(onOpenExisting).toHaveBeenCalledWith('r-lan');
    expect(onCreated).not.toHaveBeenCalled();
    expect(f.mock.calls.some((c) => String(c[0]).includes('/requests?'))).toBe(false);
  });

  it.each([
    ['USER_IS_ADMIN', 'Người này là Hành chính — Hành chính không đăng ký VPP.'],
    ['USER_INACTIVE', 'Người này không còn hoạt động — chọn người khác.'],
  ])('%s → lỗi tại ô người đăng ký, không ở đầu form', async (code, text) => {
    stub(() => jsonResponse(400, { code }));
    const { dialog } = await renderDialog();
    await fill(dialog);
    await userEvent.click(submit(dialog));
    const person = within(dialog).getByRole('group', { name: 'Người đăng ký' });
    expect(await within(person).findByText(text)).toBeInTheDocument();
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('QTY_EXCEEDS_MAX {line_index} → lỗi ở dòng món', async () => {
    stub(() => jsonResponse(400, { code: 'QTY_EXCEEDS_MAX', line_index: 0, max: 20 }));
    const { dialog } = await renderDialog();
    await fill(dialog);
    await userEvent.click(submit(dialog));
    expect(await within(within(dialog).getByText('Giấy note vàng').closest('li')!).findByText('Tối đa 20/tháng.')).toBeInTheDocument();
  });

  it('PERIOD_LOCKED → khối đầu hộp thoại', async () => {
    stub(() => jsonResponse(409, { code: 'PERIOD_LOCKED' }));
    const { dialog } = await renderDialog();
    await fill(dialog);
    await userEvent.click(submit(dialog));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Kỳ vừa khóa — tải lại trang để tạo phiếu ở kỳ mới.');
  });

  it('kỳ đang xem đã khóa → cảnh báo "Kỳ tháng 10 đã khóa lúc 00:00 ngày 11/10 — …" và "Tạo phiếu" vô hiệu', async () => {
    stub(created);
    const { dialog } = await renderDialog({ lockedOn: '11/10' });
    expect(
      within(dialog).getByText('Kỳ tháng 10 đã khóa lúc 00:00 ngày 11/10 — không tạo phiếu mới được. Dùng Điều chỉnh phiếu hoặc Xuất lẻ ở Kho.'),
    ).toBeInTheDocument();
    expect(submit(dialog)).toBeDisabled();
  });

  it('kỳ khóa nhưng thiếu hạn (deadline null) → câu cảnh báo bỏ mệnh đề giờ khóa, không có "ngày " trống', async () => {
    stub(created);
    const { dialog } = await renderDialog({ lockedOn: null });
    expect(within(dialog).getByText('Kỳ tháng 10 đã khóa — không tạo phiếu mới được. Dùng Điều chỉnh phiếu hoặc Xuất lẻ ở Kho.')).toBeInTheDocument();
    expect(submit(dialog)).toBeDisabled();
  });

  it('bấm đúp "Tạo phiếu" → POST đúng 1 lần, nút "Đang tạo…" vô hiệu', async () => {
    let release: (r: Response) => void = () => {};
    const f = stub(() => new Promise<Response>((r) => (release = r)));
    const { dialog } = await renderDialog();
    await fill(dialog);
    await userEvent.dblClick(submit(dialog));
    expect(await within(dialog).findByRole('button', { name: 'Đang tạo…' })).toBeDisabled();
    release(created());
    await waitFor(() => expect(f.mock.calls.filter((c) => c[0] === '/api/admin/requests')).toHaveLength(1));
  });

  it('Enter trong ô tìm món không tạo phiếu sớm', async () => {
    const f = stub(created);
    const { dialog, onCreated } = await renderDialog();
    await fill(dialog);
    await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'zzz{Enter}');
    expect(f.mock.calls.some((c) => c[0] === '/api/admin/requests')).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
  });
});
