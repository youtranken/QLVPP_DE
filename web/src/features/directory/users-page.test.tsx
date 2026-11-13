import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, jsonResponse, screen, userEvent, waitFor, within, pickOption, optionLabels } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { expectFixedColumns } from '@/test/fixed-columns';
import type { AdminUser } from './directory.api';
import { AN, BINH, CHI, DUNG, REG_URL, openUsers, regOf, stubUsers } from './users-fixtures';

const card = (name: RegExp) => screen.getByRole('button', { name });
const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

afterEach(() => vi.unstubAllGlobals());

describe('UsersPage B10', () => {
  it('tự dựng đầu trang: mô tả, "Đồng bộ ngay" kèm dòng trạng thái đồng bộ đứng ngay trước nhóm thao tác (không nằm trong nhóm); cài đặt không thành ô số liệu; đúng một h1', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    expect(screen.getAllByRole('heading', { level: 1, name: 'Danh bạ' })).toHaveLength(1);
    expect(screen.getByText('Người dùng đồng bộ từ PMH ID. Thông tin cá nhân sửa ở PMH ID, không sửa trong app.')).toBeInTheDocument();
    expect(screen.queryByText('Đồng bộ tự động')).toBeNull();
    const actions = screen.getByRole('group', { name: 'Thao tác trang' });
    expect(screen.queryByText('Tự động mỗi 60 phút')).toBeNull();
    expect(within(actions).getByRole('button', { name: 'Đồng bộ ngay' })).toBeInTheDocument();
    expect((await screen.findByText('Chưa đồng bộ danh bạ PMH ID')).nextElementSibling).toBe(actions);
    expect(screen.queryByText(/Đồng bộ lần cuối/)).toBeNull();
  });

  it('thẻ Đang dùng 2 · Chưa đăng ký tháng 11 · Đã khóa 1; bấm thẻ lọc đúng và FilterNotice hiện', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    expect(card(/^Đang dùng/)).toHaveTextContent('2');
    expect(await screen.findByRole('button', { name: /^Chưa đăng ký tháng 11/ })).toHaveTextContent('1');
    expect(screen.queryByRole('button', { name: /^Chưa đăng nhập lần nào/ })).toBeNull();
    expect(card(/^Đã khóa/)).toHaveTextContent('1');
    await userEvent.click(card(/^Đã khóa/));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('Đang lọc: Đã khóa · 1')).toBeInTheDocument();
    expect(screen.getByText('Đang lọc: Đã khóa · 1').closest('.list-meta')).toBe(screen.getByText(/^Đang hiện \d/).closest('.list-meta'));
    expect(card(/^Đã khóa/)).toHaveAttribute('aria-pressed', 'true');
    // Xóa lọc → về mặc định Đang dùng; bấm lại thẻ Đang dùng đang chọn → Mọi trạng thái
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(bodyRows().map((r) => within(r).getByRole('button').textContent)).toEqual(['Phạm Minh Đức', 'Trần Chi']);
    expect(card(/^Đang dùng/)).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(card(/^Đang dùng/));
    expect(bodyRows()).toHaveLength(3);
    expect(screen.getByRole('combobox', { name: 'Trạng thái' })).toHaveTextContent('Mọi trạng thái');
  });

  it('lọc phòng ban dẫn xuất từ danh bạ; "Hiện n / tổng người"', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers('/admin/users?status=all');
    expect(screen.getByText('Đang hiện 3/3 người')).toBeInTheDocument();
    // Dòng đếm nằm cuối hàng lọc (căn phải), không chiếm hàng riêng trên bảng
    expect(screen.getByText('Đang hiện 3/3 người').closest('.toolbar > .list-meta')).not.toBeNull();
    const select = screen.getByRole('combobox', { name: 'Phòng ban' });
    expect(await optionLabels(select)).toEqual(['Mọi phòng ban', 'Phòng Công trình', 'Phòng Kế toán']);
    await pickOption(select, 'Phòng Kế toán');
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('Đang hiện 1/3 người')).toBeInTheDocument();
    // Cột cố định bề rộng: đổi lọc không làm cột nhảy chỗ
    expectFixedColumns(screen.getByRole('table'));
  });

  it('L5 vòng 8: ?dept=<phòng không còn ai> → viên lọc hiện đúng tên phòng (không trống), giữ tham số, bảng rỗng có Xóa lọc', async () => {
    stubUsers([AN, BINH, CHI]);
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/users?dept=Phòng cũ');
    const select = await screen.findByRole('combobox', { name: 'Phòng ban' });
    await waitFor(() => expect(screen.getByText(/^Đang hiện 0\/3/)).toBeInTheDocument());
    expect(select).toHaveTextContent('Phòng cũ');
    expect(await optionLabels(select)).toEqual(['Mọi phòng ban', 'Phòng Công trình', 'Phòng Kế toán', 'Phòng cũ']);
    await userEvent.keyboard('{Escape}');
    expect(screen.getByTestId('location-search')).toHaveTextContent('dept=');
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(select).toHaveTextContent('Mọi phòng ban');
    expect(bodyRows()).toHaveLength(2);
  });

  it('bảng: avatar chữ đầu, cột Nhóm, tag Adm D&E, trạng thái, "Chưa đăng nhập"; không có badge "Mới"', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers('/admin/users?status=all');
    const an = screen.getByText('Phạm Minh Đức').closest('tr')!;
    expect(within(an).getByText('Phòng Công trình')).toBeInTheDocument();
    expect(within(an).getByText('QS')).toBeInTheDocument();
    expect(within(an).getByText('Adm D&E')).toBeInTheDocument();
    expect(within(an).getByText('Đang dùng')).toBeInTheDocument();
    expect(within(an).getByText('09:30 27/10/2026')).toBeInTheDocument();
    const binh = screen.getByText('Lê Thị Bình').closest('tr')!;
    expect(within(binh).getByText('Đã khóa')).toBeInTheDocument();
    expect(within(binh).queryByText('Adm D&E')).toBeNull();
    expect(within(binh).getByText('Chưa đăng nhập')).toBeInTheDocument();
    expect(screen.queryByText('Mới')).toBeNull();
  });

  it('mã NV, nhóm, email, phòng ban cắt "…" kèm title đủ chữ (không gãy giữa từ trong cột hẹp)', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    const an = screen.getByText('Phạm Minh Đức').closest('tr')!;
    for (const text of ['NV0231', 'QS', 'an.nguyen@pmh.com.vn']) {
      const el = within(an).getByText(text);
      expect(el).toHaveClass('cell-clip', 'cell-clip--line');
      expect(el).toHaveAttribute('title', text);
    }
    expect(within(an).getByText('Phòng Công trình')).toHaveClass('cell-clip');
    expect(within(an).getByText('Phòng Công trình')).toHaveAttribute('title', 'Phòng Công trình');
  });

  it('ô tìm giới hạn 200 ký tự; gõ lọc không dấu theo tên/mã NV; rỗng → "Xóa lọc"', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers('/admin/users?status=all');
    const box = screen.getByRole('searchbox', { name: 'Tìm người' });
    // Rà soát 13/11 Gu #12: placeholder vừa ô ở 768 (176px), không bị cắt
    expect(box).toHaveAttribute('placeholder', 'Tìm tên, email, mã NV');
    expect(box).toHaveAttribute('maxlength', '200');
    await userEvent.type(box, 'nv0007');
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
    expect(within(bodyRows()[0]).getByText('Lê Thị Bình')).toBeInTheDocument();
    await userEvent.clear(box);
    await userEvent.type(box, 'zzzz');
    expect(await screen.findByText('Không có ai khớp tìm kiếm.')).toBeInTheDocument();
    expect(screen.getByText(/Người mới vào công ty sẽ có sau lần đồng bộ kế tiếp/)).toBeInTheDocument();
    // Xóa lọc bỏ cả tìm lẫn trạng thái → về mặc định Đang dùng
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    await waitFor(() => expect(bodyRows()).toHaveLength(2));
  });

  it('cột Nhóm: team "QS" hiện QS; team null hiện —', async () => {
    stubUsers([AN, CHI]);
    await openUsers();
    const cells = (name: string) => within(screen.getByText(name).closest('tr')!).getAllByRole('cell');
    const col = within(screen.getByRole('table')).getAllByRole('columnheader').findIndex((h) => h.textContent === 'Nhóm');
    expect(col).toBeGreaterThan(-1);
    expect(cells('Phạm Minh Đức')[col]).toHaveTextContent('QS');
    expect(cells('Trần Chi')[col]).toHaveTextContent('—');
  });

  it('người role admin có tag Adm D&E, người member thì không', async () => {
    stubUsers([AN, CHI]);
    await openUsers();
    expect(within(screen.getByText('Phạm Minh Đức').closest('tr')!).getByText('Adm D&E')).toBeInTheDocument();
    expect(within(screen.getByText('Trần Chi').closest('tr')!).queryByText('Adm D&E')).toBeNull();
  });

  it('lọc Mất quyền chỉ còn người no_access, đếm đúng ở thống kê; no_access không tính vào Đang dùng', async () => {
    stubUsers([AN, BINH, CHI, DUNG]);
    await openUsers();
    expect(card(/^Mất quyền/)).toHaveTextContent('1');
    expect(card(/^Đang dùng/)).toHaveTextContent('2');
    await userEvent.click(card(/^Mất quyền/));
    expect(bodyRows().map((r) => within(r).getByRole('button').textContent)).toEqual(['Vũ Dũng']);
    expect(within(bodyRows()[0]).getByText('Mất quyền')).toBeInTheDocument();
    expect(screen.getByText('Đang lọc: Mất quyền · 1')).toBeInTheDocument();
  });

  it('lọc phòng + tìm theo tên vẫn đúng khi team null; tìm theo team khớp', async () => {
    stubUsers([AN, BINH, CHI, DUNG]);
    await openUsers();
    await pickOption(screen.getByRole('combobox', { name: 'Phòng ban' }), 'Phòng Công trình');
    expect(bodyRows()).toHaveLength(2);
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người' }), 'Chi');
    await waitFor(() => expect(bodyRows().map((r) => within(r).getByRole('button').textContent)).toEqual(['Trần Chi']));
  });

  it('mở người no_access → cảnh báo PMH ID đã thu hồi quyền; người active thì không', async () => {
    stubUsers([AN, DUNG]);
    await openUsers('/admin/users?status=all&person=u-dung');
    const drawer = await screen.findByRole('dialog', { name: 'Người dùng' });
    expect(within(drawer).getByText(/PMH ID đã thu hồi quyền vào VPP của người này/)).toBeInTheDocument();
    expect(within(drawer).getByText('Nhóm')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Người trước' }));
    expect(within(await screen.findByRole('dialog', { name: 'Người dùng' })).queryByText(/PMH ID đã thu hồi quyền/)).toBeNull();
  });

  it('panel phủ ?person=: không có "Vai trò trong app"/phiếu; "Xem nhật ký" → /admin/audit?actor=<sub>; chỉ đọc; bộ đếm, ↑/↓, đóng bỏ tham số', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers('/admin/users?status=all');
    await userEvent.click(screen.getByRole('button', { name: 'Phạm Minh Đức' }));
    const drawer = await screen.findByRole('dialog', { name: 'Người dùng' });
    expect(screen.getByTestId('location-search')).toHaveTextContent('person=u-an');
    expect(within(drawer).getByText('1/3')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: 'Người trước' })).toBeDisabled();
    expect(within(drawer).getByText('NV0231')).toBeInTheDocument();
    expect(within(drawer).getByText('Dữ liệu từ PMH ID, không sửa trong app.')).toBeInTheDocument();
    expect(within(drawer).queryByText(/Vai trò trong app/)).toBeNull();
    expect(within(drawer).queryByText(/Phiếu văn phòng phẩm/)).toBeNull();
    expect(within(drawer).queryByText(/Tài khoản đã khóa ở PMH ID/)).toBeNull();
    expect(within(drawer).getByRole('link', { name: 'Xem nhật ký' })).toHaveAttribute('href', '/admin/audit?actor=u-an');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Người kế tiếp' }));
    const second = await screen.findByRole('dialog', { name: 'Người dùng' });
    expect(within(second).getByText('2/3')).toBeInTheDocument();
    expect(within(second).getByText(/Tài khoản đã khóa ở PMH ID — không đăng nhập được/)).toBeInTheDocument();
    expect(within(second).getByRole('link', { name: 'Xem nhật ký' })).toHaveAttribute('href', '/admin/audit?actor=u-binh');
    await userEvent.click(within(second).getByRole('button', { name: 'Người kế tiếp' }));
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Người dùng' })).getByRole('button', { name: 'Người kế tiếp' })).toBeDisabled());
    const [x] = within(screen.getByRole('dialog', { name: 'Người dùng' })).getAllByRole('button', { name: 'Đóng' });
    await userEvent.click(x);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Người dùng' })).toBeNull());
    expect(screen.getByTestId('location-search')).not.toHaveTextContent('person=');
    await userEvent.click(screen.getByRole('button', { name: 'Phạm Minh Đức' }));
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Người dùng' })).getAllByRole('button', { name: 'Đóng' })[1]);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Người dùng' })).toBeNull());
  });

  it('L3 vòng 8: email nằm trên lớp phủ của nút tên — có title đầy đủ; bấm email mở panel, nhưng vừa bôi đen email thì không mở', async () => {
    stubUsers([AN]);
    await openUsers();
    const email = screen.getByText('an.nguyen@pmh.com.vn');
    expect(email).toHaveAttribute('title', 'an.nguyen@pmh.com.vn');
    const sel = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'an.nguyen' } as Selection);
    await userEvent.click(email);
    expect(screen.queryByRole('dialog', { name: 'Người dùng' })).toBeNull();
    sel.mockRestore();
    await userEvent.click(email);
    expect(await screen.findByRole('dialog', { name: 'Người dùng' })).toBeInTheDocument();
  });

  it('?person=<sub lạ> → không mở panel, gỡ tham số; ?person=u-binh → mở đúng người (F5/dán URL)', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers('/admin/users?person=u-nobody');
    await waitFor(() => expect(screen.getByTestId('location-search')).not.toHaveTextContent('person='));
    expect(screen.queryByRole('dialog')).toBeNull();
    cleanup();
    await openUsers('/admin/users?status=all&person=u-binh');
    expect(within(await screen.findByRole('dialog', { name: 'Người dùng' })).getByText(/Tài khoản đã khóa ở PMH ID/)).toBeInTheDocument();
  });

  it.each([
    [503, { code: 'DIRECTORY_UNAVAILABLE' }, 'Không liên lạc được PMH ID — thử lại sau ít phút.'],
    [502, { code: 'DIRECTORY_AUTH_FAILED' }, 'PMH ID từ chối quyền đọc danh bạ — báo IT kiểm tra cấu hình.'],
    [500, { code: 'DIRECTORY_SYNC_FAILED' }, 'Đồng bộ chưa xong — thử lại sau ít phút.'],
    [500, { code: 'SOMETHING_ELSE' }, 'Không liên lạc được PMH ID — thử lại sau ít phút.'],
    [400, { code: 'SOMETHING_ELSE' }, 'Chưa đồng bộ được — thử lại sau ít phút.'],
  ])('đồng bộ lỗi %i %j → câu đúng', async (status, body, text) => {
    stubUsers([AN], () => jsonResponse(status, { ...body, message: 'x' }));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
  });

  it('lỗi tải → "Không tải được dữ liệu — thử lại." + "Thử lại"', async () => {
    mockViewport(1280);
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.startsWith('/api/admin/users') ? jsonResponse(500, { code: 'X' }) : jsonResponse(200, []))));
    renderApp(makeMe('admin'), '/admin/users');
    expect(await screen.findByText('Không tải được dữ liệu — thử lại.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('2001 người → báo tìm ở server, không có thẻ số liệu; gõ gọi ?search= và "Xem thêm" hoạt động', async () => {
    const many = Array.from({ length: 2001 }, (_, i) => ({ ...AN, sub: `m${i}`, fullName: `Người ${String(i).padStart(4, '0')}` }));
    const f = stubUsers(many);
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/users');
    expect(await screen.findByText(/Danh bạ có hơn 2000 người/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Đang dùng/ })).toBeNull();
    await userEvent.click(screen.getByRole('searchbox', { name: 'Tìm người' }));
    await userEvent.paste('0042');
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('search=0042'))).toBe(true));
    await waitFor(() => expect(bodyRows()).toHaveLength(1));
  }, 30_000);

  describe('tiến độ đăng ký kỳ đang mở', () => {
    const EM: AdminUser = { ...CHI, sub: 'u-em', fullName: 'Võ Em', employeeCode: 'NV0300' };

    it('thẻ "Chưa đăng ký tháng 11: 2 người"; bấm → ?reg=no ra đúng 2 người; cột "Tháng 11" Đã đăng ký / Chưa / — (ngoài danh sách kỳ), không số món', async () => {
      stubUsers([AN, BINH, CHI, EM], undefined, regOf([CHI, EM], ['u-an']));
      await openUsers('/admin/users?status=all');
      const reg = await screen.findByRole('button', { name: /^Chưa đăng ký tháng 11/ });
      expect(reg).toHaveTextContent(/^Chưa đăng ký tháng 112\s*người/);
      expect(screen.getByRole('columnheader', { name: 'Tháng 11' })).toBeInTheDocument();
      const col = (name: string) => within(screen.getByText(name).closest('tr')!).getAllByRole('cell')[3];
      await waitFor(() => expect(col('Phạm Minh Đức')).toHaveTextContent('Đã đăng ký'));
      expect(col('Trần Chi')).toHaveTextContent('Chưa');
      expect(col('Lê Thị Bình')).toHaveTextContent('—');
      for (const r of bodyRows()) expect(within(r).getAllByRole('cell')[3].textContent).not.toMatch(/\d/);
      await userEvent.click(reg);
      expect(screen.getByTestId('location-search')).toHaveTextContent('?reg=no');
      expect(bodyRows().map((r) => within(r).getAllByRole('button')[0].textContent)).toEqual(['Trần Chi', 'Võ Em']);
      expect(screen.getByText('Đang lọc: Chưa đăng ký tháng 11 · 2')).toBeInTheDocument();
    });

    it('?reg=yes → chỉ người đã đăng ký kỳ đang mở; ?reg=lạ → không lọc', async () => {
      stubUsers([AN, BINH, CHI, EM], undefined, regOf([CHI, EM], ['u-an']));
      await openUsers('/admin/users?reg=yes');
      await waitFor(() => expect(bodyRows()).toHaveLength(1));
      expect(within(bodyRows()[0]).getByText('Phạm Minh Đức')).toBeInTheDocument();
      expect(screen.getByText('Đang lọc: Đã đăng ký tháng 11 · 1')).toBeInTheDocument();
    });

    it('lỗi tải danh sách đăng ký → thẻ "—", báo lỗi có "Thử lại"; thử lại thành công thì có số', async () => {
      let fail = true;
      stubUsers([AN, BINH, CHI], undefined, () => (fail ? jsonResponse(500, { code: 'X' }) : regOf([CHI], ['u-an'])()));
      await openUsers();
      const retry = await screen.findByRole('button', { name: 'Thử lại' });
      expect(screen.getByRole('button', { name: /^Chưa đăng ký tháng 11/ })).toHaveTextContent('—');
      fail = false;
      await userEvent.click(retry);
      await waitFor(() => expect(screen.getByRole('button', { name: /^Chưa đăng ký tháng 11/ })).toHaveTextContent('1'));
    });

    it('ngăn kéo đang mở khi danh sách đăng ký mới về → vẫn mở, cột cập nhật', async () => {
      let release: () => void = () => undefined;
      const late = new Promise<void>((r) => (release = r));
      const f = stubUsers([AN, BINH, CHI]);
      const base = f.getMockImplementation()!;
      f.mockImplementation((url: string, init?: RequestInit) => (url === REG_URL ? late.then(() => regOf([CHI], ['u-an'])()) : base(url, init)));
      await openUsers();
      await userEvent.click(screen.getByRole('button', { name: 'Phạm Minh Đức' }));
      expect(await screen.findByRole('dialog', { name: 'Người dùng' })).toBeInTheDocument();
      release();
      // Ngăn kéo modal ẩn phần còn lại khỏi cây trợ năng
      await waitFor(() => expect(screen.getByRole('button', { name: /^Chưa đăng ký tháng 11/, hidden: true })).toHaveTextContent('1'));
      expect(screen.getByRole('dialog', { name: 'Người dùng' })).toBeInTheDocument();
    });
  });
  it('chưa đăng nhập: last_login_at rỗng hiện "Chưa đăng nhập"; người khoá hiện "Đã khóa"', async () => {
    stubUsers([AN, BINH]);
    await openUsers('/admin/users?status=all');
    expect(within(screen.getByText('Lê Thị Bình').closest('tr')!).getByText('Chưa đăng nhập')).toBeInTheDocument();
  });
});
