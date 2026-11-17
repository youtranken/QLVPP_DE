import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within, pickOption, optionLabels } from '@/test/test-utils';
import { compressImage } from '@/lib/image-compress';
import { PAPER, PEN, adminItem } from './catalog-fixtures';
import { bodyOf, callsTo, png, renderDrawer, stubDrawerApi } from './item-drawer-fixtures';

vi.mock('@/lib/image-compress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/image-compress')>();
  return { ...actual, compressImage: vi.fn(actual.compressImage) };
});

const PICK = 'Chụp hoặc chọn ảnh';

beforeEach(() => {
  vi.mocked(compressImage).mockImplementation(async (file) => ({ blob: file, mime: 'image/png', width: 10, height: 10 }));
});
afterEach(() => vi.unstubAllGlobals());

async function fillNew(name = 'Bút chì') {
  await userEvent.type(screen.getByLabelText(/^Tên sản phẩm/), name);
  await pickOption(screen.getByLabelText(/^Đơn vị tính/), 'cây');
  await userEvent.upload(screen.getByLabelText(PICK), png());
  await screen.findByRole('img', { name: 'Ảnh món' });
}

const submitAdd = () => userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Thêm món' }));

describe('Ngăn kéo Thêm sản phẩm', () => {
  it('là ngăn kéo tên "Thêm sản phẩm"; gửi thiếu ảnh và tên → "Cần thêm: ảnh, tên.", ô ảnh aria-invalid, không gọi API', async () => {
    const f = stubDrawerApi();
    renderDrawer();
    expect(screen.getByRole('dialog', { name: 'Thêm sản phẩm' })).toBeInTheDocument();
    await pickOption(screen.getByLabelText(/^Đơn vị tính/), 'cây');
    await submitAdd();
    expect(screen.getByRole('alert')).toHaveTextContent('Cần thêm: ảnh, tên.');
    expect(screen.getByLabelText(PICK)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Tên sản phẩm/)).toHaveAttribute('aria-invalid', 'true');
    expect(f).not.toHaveBeenCalledWith('/api/admin/items', expect.anything());
  });

  it('thiếu ĐVT → "Cần thêm: ĐVT." gắn ô Đơn vị tính', async () => {
    stubDrawerApi();
    renderDrawer();
    await userEvent.type(screen.getByLabelText(/^Tên sản phẩm/), 'Bút chì');
    await userEvent.upload(screen.getByLabelText(PICK), png());
    await screen.findByRole('img', { name: 'Ảnh món' });
    await submitAdd();
    expect(screen.getByRole('alert')).toHaveTextContent('Cần thêm: ĐVT.');
    expect(screen.getByLabelText(/^Đơn vị tính/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('ô ảnh trống là khung "Chụp hoặc chọn ảnh" kèm gợi ý 5 MB; có ảnh → "Đổi ảnh" và "Xóa ảnh" (xóa về khung trống)', async () => {
    stubDrawerApi();
    renderDrawer();
    expect(screen.getByText('JPG/PNG tới 5 MB. Nhân viên chọn món bằng ảnh nên ảnh là bắt buộc.')).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText(PICK), png());
    expect(await screen.findByRole('img', { name: 'Ảnh món' })).toHaveAttribute('src', '/api/files/f-new');
    expect(screen.getByLabelText('Đổi ảnh')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa ảnh' }));
    expect(screen.queryByRole('img', { name: 'Ảnh món' })).toBeNull();
    expect(screen.getByLabelText(PICK)).toBeInTheDocument();
  });

  it('chọn ảnh HEIC → "Chọn ảnh JPG, PNG hoặc WebP" tại ô ảnh, không tải lên', async () => {
    const actual = await vi.importActual<typeof import('@/lib/image-compress')>('@/lib/image-compress');
    vi.mocked(compressImage).mockImplementation(actual.compressImage);
    const f = stubDrawerApi();
    renderDrawer();
    await userEvent.upload(screen.getByLabelText(PICK), new File([new Uint8Array([0])], 'IMG.HEIC', { type: 'image/heic' }));
    expect(await screen.findByText('Chọn ảnh JPG, PNG hoặc WebP')).toBeInTheDocument();
    expect(f).not.toHaveBeenCalledWith('/api/files', expect.anything());
  });

  it.each([
    ['FILE_TOO_LARGE', 413, 'Ảnh lớn hơn 5 MB — chọn ảnh nhỏ hơn.'],
    ['FILE_TYPE_INVALID', 400, 'Chọn ảnh JPG, PNG hoặc WebP'],
  ])('tải ảnh lỗi %s → câu lỗi ở ô ảnh, ô aria-invalid', async (code, status, text) => {
    stubDrawerApi((url) => (url === '/api/files' ? jsonResponse(status, { code, message: 'x' }) : undefined));
    renderDrawer();
    await userEvent.upload(screen.getByLabelText(PICK), png());
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(screen.getByLabelText(PICK)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(PICK)).toHaveAccessibleDescription(text);
  });

  it('server trả IMAGE_REQUIRED → câu lỗi ở ô ảnh', async () => {
    stubDrawerApi((url, init) => (url === '/api/admin/items' && init.method === 'POST' ? jsonResponse(400, { code: 'IMAGE_REQUIRED', message: 'x' }) : undefined));
    renderDrawer();
    await fillNew();
    await submitAdd();
    const name = await screen.findByText('Món phải có ảnh — chọn hoặc chụp một ảnh.');
    expect(name).toBeInTheDocument();
    expect(screen.getByLabelText('Đổi ảnh')).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    ['UNIT_REQUIRED', 'Chọn đơn vị tính.'],
    ['UNIT_INACTIVE', 'Đơn vị tính này đã ngừng — chọn đơn vị khác.'],
  ])('server trả %s → câu lỗi gắn ô Đơn vị tính', async (code, text) => {
    stubDrawerApi((url, init) => (url === '/api/admin/items' && init.method === 'POST' ? jsonResponse(400, { code, message: 'x' }) : undefined));
    renderDrawer();
    await fillNew();
    await submitAdd();
    const unit = screen.getByLabelText(/^Đơn vị tính/);
    await vi.waitFor(() => expect(unit).toHaveAccessibleDescription(text));
    expect(unit).toHaveAttribute('aria-invalid', 'true');
  });

  it('ITEM_CODE_EXISTS → "Mã này đã có món khác dùng." tại ô Mã món; VALIDATION [code] cũng về ô mã', async () => {
    let code = 'ITEM_CODE_EXISTS';
    stubDrawerApi((url, init) =>
      url === '/api/admin/items' && init.method === 'POST' ? jsonResponse(code === 'VALIDATION' ? 400 : 409, { code, message: 'x', fields: ['code'] }) : undefined,
    );
    renderDrawer();
    await fillNew();
    await userEvent.type(screen.getByLabelText('Mã món'), 'VPP-001');
    await submitAdd();
    const codeInput = screen.getByLabelText('Mã món');
    await vi.waitFor(() => expect(codeInput).toHaveAccessibleDescription('Mã này đã có món khác dùng.'));
    code = 'VALIDATION';
    await submitAdd();
    await vi.waitFor(() => expect(codeInput).toHaveAccessibleDescription('Kiểm tra lại giá trị này.'));
  });

  it('ô Mã món giới hạn 40 ký tự; tên, tên tiếng Anh, quy cách 120 ký tự (gõ 121 chỉ nhận 120)', async () => {
    stubDrawerApi();
    renderDrawer();
    expect(screen.getByLabelText('Mã món')).toHaveAttribute('maxLength', '40');
    for (const label of [/^Tên sản phẩm/, 'Tên tiếng Anh', 'Quy cách']) expect(screen.getByLabelText(label)).toHaveAttribute('maxLength', '120');
    await userEvent.type(screen.getByLabelText(/^Tên sản phẩm/), 'a'.repeat(121));
    expect(screen.getByLabelText(/^Tên sản phẩm/)).toHaveValue('a'.repeat(120));
  });

  it('server trả VALIDATION [name] (tên 121 ký tự) → lỗi ô Tên món', async () => {
    stubDrawerApi((url, init) =>
      url === '/api/admin/items' && init.method === 'POST' ? jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['name'] }) : undefined,
    );
    renderDrawer();
    await fillNew();
    await submitAdd();
    await vi.waitFor(() => expect(screen.getByLabelText(/^Tên sản phẩm/)).toHaveAccessibleDescription('Kiểm tra lại giá trị này.'));
  });

  it('tạo món: POST kèm ảnh, mã, nhóm chọn bằng ô chọn (sẵn nhóm từ itemCat), tối đa mặc định 20 → toast, đóng; G7: không còn công tắc "Chỉ Adm D&E đặt", POST không có admin_only', async () => {
    const f = stubDrawerApi((url, init) => (url === '/api/admin/items' && init.method === 'POST' ? jsonResponse(201, { ...PEN, id: 'i-new' }) : undefined));
    const { onClose } = renderDrawer({ categoryId: 'c-pen' });
    const group = screen.getByRole('combobox', { name: 'Nhóm' });
    expect(group).toHaveTextContent('Bút & viết');
    expect((await optionLabels(group)).some((l) => /Nhóm cũ/.test(l))).toBe(false);
    await pickOption(group, 'Giấy & sổ');
    await fillNew();
    await userEvent.type(screen.getByLabelText('Mã món'), ' VPP-099 ');
    await userEvent.type(screen.getByLabelText('Quy cách'), 'hộp 12 cây');
    expect(screen.getByLabelText(/^Tối đa mỗi tháng/)).toHaveValue(20);
    expect(screen.queryByRole('switch', { name: 'Chỉ Adm D&E đặt' })).toBeNull();
    await submitAdd();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodyOf(f, '/api/admin/items', 'POST')).toMatchObject({
      code: 'VPP-099',
      name: 'Bút chì',
      unit: 'cay',
      pack_note: 'hộp 12 cây',
      category_id: 'c-paper',
      image_file_id: 'f-new',
      max_qty: 20,
    });
    expect(bodyOf(f, '/api/admin/items', 'POST')).not.toHaveProperty('admin_only');
    expect(await screen.findByText('Đã thêm Bút chì')).toBeInTheDocument();
  });

  it('không có ô "Thứ tự hiển thị" và khối "Nhân viên sẽ thấy"; POST không có khóa sort_order (server xếp cuối nhóm)', async () => {
    const f = stubDrawerApi((url, init) => (url === '/api/admin/items' && init.method === 'POST' ? jsonResponse(201, { ...PEN, id: 'i-new' }) : undefined));
    renderDrawer();
    expect(screen.queryByLabelText('Thứ tự hiển thị')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Nhân viên sẽ thấy' })).toBeNull();
    await fillNew();
    await submitAdd();
    await vi.waitFor(() => expect(callsTo(f, '/api/admin/items', 'POST')).toHaveLength(1));
    expect(bodyOf(f, '/api/admin/items', 'POST')).not.toHaveProperty('sort_order');
  });
});

describe('Ngăn kéo Sửa món', () => {
  it('tiêu đề là tên món; PATCH chỉ trường đổi, nút "Lưu thay đổi", chân ghi "1 thay đổi chưa lưu"; lưu xong panel ở lại món đó, toast "Đã lưu" đọc được trong panel', async () => {
    const f = stubDrawerApi((_url, init) => (init.method === 'PATCH' ? jsonResponse(200, PEN) : undefined));
    const { onClose } = renderDrawer({ item: PEN });
    expect(screen.getByRole('dialog', { name: 'Sửa món Bút bi xanh' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ảnh món' })).toHaveAttribute('src', '/api/files/f-2');
    const max = screen.getByLabelText(/^Tối đa mỗi tháng/);
    await userEvent.clear(max);
    await userEvent.type(max, '30');
    expect(screen.getByText('1 thay đổi chưa lưu')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    // Toast nằm trong panel: toast chung ngoài hộp bị Radix ẩn khỏi trình đọc màn hình
    expect(await within(screen.getByRole('dialog', { name: 'Sửa món Bút bi xanh' })).findByRole('status')).toHaveTextContent('Đã lưu Bút bi xanh');
    expect(bodyOf(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toEqual({ max_qty: 30 });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Lưu' })).toBeEnabled();
  });

  it('Nhóm là ô chọn (combobox "Nhóm"), đổi nhóm → PATCH chỉ {category_id}, không sort_order', async () => {
    const f = stubDrawerApi((_url, init) => (init.method === 'PATCH' ? jsonResponse(200, PEN) : undefined));
    renderDrawer({ item: PEN });
    expect(screen.queryByLabelText('Thứ tự hiển thị')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Nhân viên sẽ thấy' })).toBeNull();
    await pickOption(screen.getByRole('combobox', { name: 'Nhóm' }), 'Giấy & sổ');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await vi.waitFor(() => expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toHaveLength(1));
    expect(bodyOf(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toEqual({ category_id: 'c-paper' });
  });

  it('VALIDATION [max_qty] → lỗi gắn ô Tối đa mỗi tháng; ô số có min 1, max 999', async () => {
    stubDrawerApi((_url, init) => (init.method === 'PATCH' ? jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['max_qty'] }) : undefined));
    renderDrawer({ item: PEN });
    const max = screen.getByLabelText(/^Tối đa mỗi tháng/);
    expect(max).toHaveAttribute('min', '1');
    expect(max).toHaveAttribute('max', '999');
    await userEvent.clear(max);
    // số hợp lệ ở trình duyệt mà server vẫn từ chối → lỗi server gắn đúng ô
    await userEvent.type(max, '500');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await vi.waitFor(() => expect(max).toHaveAccessibleDescription('Kiểm tra lại giá trị này.'));
  });

  it('Tối đa mỗi tháng 0 / 1000 / 2.5 → báo ngay tại ô "Nhập số nguyên từ 1 đến 999", Lưu khóa có lý do, không PATCH; 1 và 999 lưu được', async () => {
    const f = stubDrawerApi();
    renderDrawer({ item: PEN });
    const max = screen.getByLabelText(/^Tối đa mỗi tháng/);
    const save = screen.getByRole('button', { name: 'Lưu' });
    for (const bad of ['0', '1000', '2.5']) {
      await userEvent.clear(max);
      await userEvent.type(max, bad);
      expect(max).toHaveAttribute('aria-invalid', 'true');
      expect(max).toHaveAccessibleDescription('Nhập số nguyên từ 1 đến 999');
      expect(save).toBeDisabled();
      expect(save).toHaveAccessibleDescription('Sửa ô đang báo lỗi trước khi lưu');
    }
    expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toHaveLength(0);
    for (const ok of ['1', '999']) {
      await userEvent.clear(max);
      await userEvent.type(max, ok);
      expect(max).not.toHaveAttribute('aria-invalid');
      expect(save).toBeEnabled();
    }
    await userEvent.click(save);
    await vi.waitFor(() => expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toHaveLength(1));
    expect(bodyOf(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toEqual({ max_qty: 999 });
  });

  it('CATEGORY_NOT_FOUND → lỗi gắn ô Nhóm; ITEM_NOT_FOUND → khối đầu thân', async () => {
    let code = 'CATEGORY_NOT_FOUND';
    stubDrawerApi((_url, init) => (init.method === 'PATCH' ? jsonResponse(code === 'ITEM_NOT_FOUND' ? 404 : 400, { code, message: 'x' }) : undefined));
    renderDrawer({ item: PEN });
    await pickOption(screen.getByRole('combobox', { name: 'Nhóm' }), 'Giấy & sổ');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await vi.waitFor(() =>
      expect(screen.getByRole('combobox', { name: 'Nhóm' })).toHaveAccessibleDescription('Nhóm này không còn — tải lại trang rồi chọn nhóm khác.'),
    );
    code = 'ITEM_NOT_FOUND';
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Món này không còn — tải lại trang.');
  });

  it('món nhập chưa có ảnh: đổi mã → PATCH chỉ {code}, không đòi ảnh (server chỉ chặn khi xóa ảnh)', async () => {
    const f = stubDrawerApi((_url, init) => (init.method === 'PATCH' ? jsonResponse(200, PAPER) : undefined));
    renderDrawer({ item: PAPER });
    await userEvent.type(screen.getByLabelText('Mã món'), '-B');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    await vi.waitFor(() => expect(callsTo(f, `/api/admin/items/${PAPER.id}`, 'PATCH')).toHaveLength(1));
    expect(bodyOf(f, `/api/admin/items/${PAPER.id}`, 'PATCH')).toEqual({ code: 'VPP-001-B' });
    expect(screen.queryByText(/^Cần thêm/)).toBeNull();
  });

  it('món đang có ảnh mà xóa ảnh → "Cần thêm: ảnh.", không gửi', async () => {
    const f = stubDrawerApi();
    renderDrawer({ item: PEN });
    await userEvent.click(screen.getByRole('button', { name: 'Xóa ảnh' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Cần thêm: ảnh.');
    expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toHaveLength(0);
  });

  it('bấm "Lưu thay đổi" hai lần liền → chỉ một PATCH', async () => {
    let release: (r: Response) => void = () => undefined;
    const f = stubDrawerApi((_url, init) => (init.method === 'PATCH' ? (new Promise<Response>((r) => (release = r)) as unknown as Response) : undefined));
    renderDrawer({ item: PEN });
    await userEvent.type(screen.getByLabelText('Quy cách'), ' mới');
    const save = screen.getByRole('button', { name: 'Lưu' });
    save.click();
    save.click();
    await vi.waitFor(() => expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toHaveLength(1));
    release(jsonResponse(200, PEN));
    await vi.waitFor(() => expect(screen.getByText('Đã lưu Bút bi xanh')).toBeInTheDocument());
    expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toHaveLength(1);
  });
});

describe('Panel Sửa sản phẩm — đầu, hai khối, chân (Nhóm 1 · mục 9)', () => {
  const nav = { index: 0, total: 36, onStep: vi.fn() };

  it('đầu panel: ảnh, "VPP-010 · Bút & viết · 1/36", tên là tiêu đề hộp, "Đang dùng"; hai khối "Thông tin" và "Đặt hàng"', () => {
    stubDrawerApi();
    renderDrawer({ item: PEN, nav });
    const dialog = screen.getByRole('dialog', { name: 'Sửa món Bút bi xanh' });
    expect(within(dialog).getByText('VPP-010 · Bút & viết · 1/36')).toBeInTheDocument();
    expect(within(dialog).getByText('Đang dùng')).toBeInTheDocument();
    expect(dialog.querySelector('.ct-panel-head img')).not.toBeNull();
    expect(within(dialog).getByRole('heading', { level: 3, name: 'Thông tin' })).toBeInTheDocument();
    expect(within(dialog).getByRole('heading', { level: 3, name: 'Đặt hàng' })).toBeInTheDocument();
  });

  it('footer: "Tạm ngưng" (btn--quiet-danger) bên trái → hỏi xác nhận → PATCH {active:false} + toast thường (không Hoàn tác); "Xóa" cạnh đó; "Quay lại" và "Lưu" bên phải; thân không còn "Xóa món"', async () => {
    const f = stubDrawerApi((_url, init) => (init.method === 'PATCH' ? jsonResponse(200, PEN) : undefined));
    renderDrawer({ item: PEN, nav });
    expect(screen.queryByRole('button', { name: 'Xóa món' })).toBeNull();
    const pause = screen.getByRole('button', { name: 'Tạm ngưng Bút bi xanh' });
    expect(pause).toHaveClass('btn--quiet-danger');
    expect(pause.nextElementSibling).toBe(screen.getByRole('button', { name: 'Xóa' }));
    expect(screen.getByRole('button', { name: 'Xóa' })).toHaveClass('ct-delete');
    expect(screen.getByRole('button', { name: 'Hủy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu' })).toHaveClass('btn--primary');
    await userEvent.click(pause);
    const ask = await screen.findByRole('dialog', { name: 'Tạm ngưng Bút bi xanh?' });
    expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toHaveLength(0);
    await userEvent.click(within(ask).getByRole('button', { name: 'Tạm ngưng' }));
    await vi.waitFor(() => expect(bodyOf(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toEqual({ active: false }));
    expect(await screen.findByText('Đã tạm ngưng Bút bi xanh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hoàn tác' })).toBeNull();
  });

  it('món tạm ngưng: đầu panel "Tạm ngưng" (đỏ); footer "Dùng lại"', () => {
    stubDrawerApi();
    renderDrawer({ item: adminItem({ ...PEN, active: false, usable: false, inactive_reason: 'item' }), nav });
    const dialog = screen.getByRole('dialog', { name: 'Sửa món Bút bi xanh' });
    expect(within(dialog).getByText('Tạm ngưng', { selector: '.ct-panel-status' })).toHaveClass('is-paused');
    expect(within(dialog).getByRole('button', { name: 'Dùng lại Bút bi xanh' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Tạm ngưng Bút bi xanh' })).toBeNull();
  });

  it('thêm mới: tiêu đề "Thêm sản phẩm", không nút Tạm ngưng/Xóa', () => {
    stubDrawerApi();
    renderDrawer();
    expect(screen.getByRole('dialog', { name: 'Thêm sản phẩm' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Tạm ngưng/ })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Xóa' })).toBeNull();
  });

  it('Nhóm và Đơn vị tính cùng một hàng; Mã món và Quy cách cùng một hàng', () => {
    stubDrawerApi();
    renderDrawer({ item: PEN });
    const row = (label: RegExp) => screen.getByLabelText(label).closest('.ct-panel-row');
    expect(row(/^Nhóm/)).toBe(row(/^Đơn vị tính/));
    expect(row(/^Mã món/)).toBe(row(/^Quy cách/));
  });
});
