import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { compressImage } from '@/lib/image-compress';
import { PAPER, PEN } from './catalog-fixtures';
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
  await userEvent.type(screen.getByLabelText(/^Tên món/), name);
  await userEvent.selectOptions(screen.getByLabelText(/^Đơn vị tính/), 'cây');
  await userEvent.upload(screen.getByLabelText(PICK), png());
  await screen.findByRole('img', { name: 'Ảnh món' });
}

const submitAdd = () => userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Thêm món' }));

describe('Ngăn kéo Thêm món', () => {
  it('là ngăn kéo tên "Thêm món"; gửi thiếu ảnh và tên → "Cần thêm: ảnh, tên.", ô ảnh aria-invalid, không gọi API', async () => {
    const f = stubDrawerApi();
    renderDrawer();
    expect(screen.getByRole('dialog', { name: 'Thêm món' })).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText(/^Đơn vị tính/), 'cây');
    await submitAdd();
    expect(screen.getByRole('alert')).toHaveTextContent('Cần thêm: ảnh, tên.');
    expect(screen.getByLabelText(PICK)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText(/^Tên món/)).toHaveAttribute('aria-invalid', 'true');
    expect(f).not.toHaveBeenCalledWith('/api/admin/items', expect.anything());
  });

  it('thiếu ĐVT → "Cần thêm: ĐVT." gắn ô Đơn vị tính', async () => {
    stubDrawerApi();
    renderDrawer();
    await userEvent.type(screen.getByLabelText(/^Tên món/), 'Bút chì');
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
    for (const label of [/^Tên món/, 'Tên tiếng Anh', 'Quy cách']) expect(screen.getByLabelText(label)).toHaveAttribute('maxLength', '120');
    await userEvent.type(screen.getByLabelText(/^Tên món/), 'a'.repeat(121));
    expect(screen.getByLabelText(/^Tên món/)).toHaveValue('a'.repeat(120));
  });

  it('server trả VALIDATION [name] (tên 121 ký tự) → lỗi ô Tên món', async () => {
    stubDrawerApi((url, init) =>
      url === '/api/admin/items' && init.method === 'POST' ? jsonResponse(400, { code: 'VALIDATION', message: 'x', fields: ['name'] }) : undefined,
    );
    renderDrawer();
    await fillNew();
    await submitAdd();
    await vi.waitFor(() => expect(screen.getByLabelText(/^Tên món/)).toHaveAccessibleDescription('Kiểm tra lại giá trị này.'));
  });

  it('tạo món: POST kèm ảnh, mã, nhóm chọn bằng chip (sẵn nhóm từ itemCat), tối đa mặc định 20, Chỉ Hành chính → toast, đóng', async () => {
    const f = stubDrawerApi((url, init) => (url === '/api/admin/items' && init.method === 'POST' ? jsonResponse(201, { ...PEN, id: 'i-new' }) : undefined));
    const { onClose } = renderDrawer({ categoryId: 'c-pen' });
    const group = screen.getByRole('radiogroup', { name: 'Nhóm' });
    expect(within(group).getByRole('radio', { name: 'Bút & viết' })).toHaveAttribute('aria-checked', 'true');
    expect(within(group).queryByRole('radio', { name: /Nhóm cũ/ })).toBeNull();
    await userEvent.click(within(group).getByRole('radio', { name: 'Giấy & sổ' }));
    await fillNew();
    await userEvent.type(screen.getByLabelText('Mã món'), ' VPP-099 ');
    await userEvent.type(screen.getByLabelText('Quy cách'), 'hộp 12 cây');
    expect(screen.getByLabelText(/^Tối đa mỗi tháng/)).toHaveValue(20);
    await userEvent.click(screen.getByRole('switch', { name: 'Chỉ Hành chính được đặt' }));
    await submitAdd();
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodyOf(f, '/api/admin/items', 'POST')).toMatchObject({
      code: 'VPP-099',
      name: 'Bút chì',
      unit: 'cay',
      pack_note: 'hộp 12 cây',
      category_id: 'c-paper',
      image_file_id: 'f-new',
      admin_only: true,
      max_qty: 20,
    });
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
  it('tiêu đề là tên món; PATCH chỉ trường đổi, nút "Lưu thay đổi", chân ghi "1 thay đổi chưa lưu"; lưu xong panel ở lại món đó', async () => {
    const f = stubDrawerApi((_url, init) => (init.method === 'PATCH' ? jsonResponse(200, PEN) : undefined));
    const { onClose } = renderDrawer({ item: PEN });
    expect(screen.getByRole('dialog', { name: 'Sửa món Bút bi xanh' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ảnh món' })).toHaveAttribute('src', '/api/files/f-2');
    const max = screen.getByLabelText(/^Tối đa mỗi tháng/);
    await userEvent.clear(max);
    await userEvent.type(max, '30');
    expect(screen.getByText('1 thay đổi chưa lưu')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByText('Đã lưu Bút bi xanh')).toBeInTheDocument();
    expect(bodyOf(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toEqual({ max_qty: 30 });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeEnabled();
  });

  it('sửa món: không có ô "Thứ tự hiển thị" và "Nhân viên sẽ thấy"; đổi nhóm → PATCH chỉ {category_id}, không sort_order', async () => {
    const f = stubDrawerApi((_url, init) => (init.method === 'PATCH' ? jsonResponse(200, PEN) : undefined));
    renderDrawer({ item: PEN });
    expect(screen.queryByLabelText('Thứ tự hiển thị')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Nhân viên sẽ thấy' })).toBeNull();
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Nhóm' })).getByRole('radio', { name: 'Giấy & sổ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
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
    await userEvent.type(max, '1000');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await vi.waitFor(() => expect(max).toHaveAccessibleDescription('Kiểm tra lại giá trị này.'));
  });

  it('CATEGORY_NOT_FOUND → câu lỗi gắn nhóm chip; ITEM_NOT_FOUND → khối đầu thân', async () => {
    let code = 'CATEGORY_NOT_FOUND';
    stubDrawerApi((_url, init) => (init.method === 'PATCH' ? jsonResponse(code === 'ITEM_NOT_FOUND' ? 404 : 400, { code, message: 'x' }) : undefined));
    renderDrawer({ item: PEN });
    await userEvent.click(screen.getByRole('radio', { name: 'Giấy & sổ' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await vi.waitFor(() =>
      expect(screen.getByRole('radiogroup', { name: 'Nhóm' })).toHaveAccessibleDescription('Nhóm này không còn — tải lại trang rồi chọn nhóm khác.'),
    );
    code = 'ITEM_NOT_FOUND';
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Món này không còn — tải lại trang.');
  });

  it('món nhập chưa có ảnh: đổi mã → PATCH chỉ {code}, không đòi ảnh (server chỉ chặn khi xóa ảnh)', async () => {
    const f = stubDrawerApi((_url, init) => (init.method === 'PATCH' ? jsonResponse(200, PAPER) : undefined));
    renderDrawer({ item: PAPER });
    await userEvent.type(screen.getByLabelText('Mã món'), '-B');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    await vi.waitFor(() => expect(callsTo(f, `/api/admin/items/${PAPER.id}`, 'PATCH')).toHaveLength(1));
    expect(bodyOf(f, `/api/admin/items/${PAPER.id}`, 'PATCH')).toEqual({ code: 'VPP-001-B' });
    expect(screen.queryByText(/^Cần thêm/)).toBeNull();
  });

  it('món đang có ảnh mà xóa ảnh → "Cần thêm: ảnh.", không gửi', async () => {
    const f = stubDrawerApi();
    renderDrawer({ item: PEN });
    await userEvent.click(screen.getByRole('button', { name: 'Xóa ảnh' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Cần thêm: ảnh.');
    expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toHaveLength(0);
  });

  it('bấm "Lưu thay đổi" hai lần liền → chỉ một PATCH', async () => {
    let release: (r: Response) => void = () => undefined;
    const f = stubDrawerApi((_url, init) => (init.method === 'PATCH' ? (new Promise<Response>((r) => (release = r)) as unknown as Response) : undefined));
    renderDrawer({ item: PEN });
    await userEvent.type(screen.getByLabelText('Quy cách'), ' mới');
    const save = screen.getByRole('button', { name: 'Lưu thay đổi' });
    save.click();
    save.click();
    await vi.waitFor(() => expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toHaveLength(1));
    release(jsonResponse(200, PEN));
    await vi.waitFor(() => expect(screen.getByText('Đã lưu Bút bi xanh')).toBeInTheDocument());
    expect(callsTo(f, `/api/admin/items/${PEN.id}`, 'PATCH')).toHaveLength(1);
  });
});

describe('Ngăn kéo món — chọn nhóm bằng phím', () => {
  it('chỉ nhóm đang chọn nằm trong Tab; →/↓ chọn nhóm kế và chuyển focus, không chuyển món', async () => {
    stubDrawerApi();
    const onStep = vi.fn();
    renderDrawer({ item: PEN, nav: { index: 0, total: 3, onStep } });
    const group = within(screen.getByRole('radiogroup', { name: 'Nhóm' }));
    const paper = group.getByRole('radio', { name: 'Giấy & sổ' });
    const pen = group.getByRole('radio', { name: 'Bút & viết' });
    expect(pen).toHaveAttribute('tabindex', '0');
    expect(paper).toHaveAttribute('tabindex', '-1');
    pen.focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(paper).toHaveAttribute('aria-checked', 'true');
    expect(paper).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(pen).toHaveAttribute('aria-checked', 'true');
    expect(pen).toHaveFocus();
    expect(onStep).not.toHaveBeenCalled();
  });
});
