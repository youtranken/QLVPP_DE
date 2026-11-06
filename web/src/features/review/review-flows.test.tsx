import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { PERIOD } from '@/test/request-api-stub';
import type { AdminItem, Category } from '@/features/catalog/catalog.api';
import { reviewResult, reviewRow } from './review-fixtures';

const ROWS = [
  reviewRow(),
  reviewRow({ line_id: 'l-2', custom_name: 'Bìa còng', image_file_id: null, full_name: 'Võ Thị Lan' }),
];
const CATEGORIES: Category[] = [{ id: 'c-1', name: 'Văn phòng', name_en: null, sort_order: 0, active: true }];
const ITEM = {
  id: 'i-2', code: null, name: 'Băng keo trong', name_en: null, unit: 'cuon', pack_note: null, category_id: 'c-1',
  image_file_id: 'f-x', admin_only: false, max_qty: 20, stock_qty: 0, restock_level: null, stock_state: 'out',
  active: true, usable: true, inactive_reason: null, sort_order: 0, missing_image: false,
} satisfies AdminItem;

function stub(review: (id: string) => Response, reviewed: () => boolean = () => false) {
  const fetchMock = vi.fn((url: string) => {
    if (url === '/api/periods/current') return Promise.resolve(jsonResponse(200, PERIOD));
    if (url.startsWith('/api/admin/review')) return Promise.resolve(jsonResponse(200, { items: url.includes('status=pending') ? (reviewed() ? ROWS.slice(1) : ROWS) : url.includes('status=accepted') && reviewed() ? [ROWS[0]] : [] }));
    const m = /^\/api\/admin\/lines\/(.+)\/review$/.exec(url);
    if (m) return Promise.resolve(review(m[1]!));
    if (url === '/api/admin/items') return Promise.resolve(jsonResponse(200, [ITEM]));
    if (url.startsWith('/api/item-categories')) return Promise.resolve(jsonResponse(200, CATEGORIES));
    return Promise.resolve(jsonResponse(200, []));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const posts = (f: ReturnType<typeof stub>) => f.mock.calls.filter((c) => /\/review$/.test(String(c[0])) && !String(c[0]).startsWith('/api/admin/review'));
const card = (name: string) => screen.findByRole('article', { name });

async function open(name: string, action: RegExp) {
  const a = await card(name);
  await userEvent.click(within(a).getByRole('button', { name: action }));
  return a;
}

afterEach(() => vi.unstubAllGlobals());

describe('ReviewPage — xử lý dòng', () => {
  it('Từ chối: server REASON_REQUIRED → lỗi gắn ô lý do, hộp vẫn mở', async () => {
    mockViewport(1280);
    stub(() => jsonResponse(400, { code: 'REASON_REQUIRED' }));
    renderApp(makeMe('admin'), '/admin/review');
    await open('Băng keo 2 mặt', /^Không mua —/);
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Lý do từ chối/), 'abc');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Không mua' }));
    await waitFor(() => expect(within(dialog).getByLabelText(/^Lý do từ chối/)).toHaveAttribute('aria-invalid', 'true'));
    expect(within(dialog).getByText('Nhập lý do từ chối (ít nhất 3 ký tự).')).toBeInTheDocument();
  });

  it('Từ chối thành công: thẻ ở lại với badge "Đã từ chối", câu lý do, "vừa xong" và toast', async () => {
    mockViewport(1280);
    stub(() => jsonResponse(200, reviewResult('rejected', { review_note: 'Kho còn' })));
    renderApp(makeMe('admin'), '/admin/review');
    const a = await open('Băng keo 2 mặt', /^Không mua —/);
    const dialog = screen.getByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Lý do từ chối/), 'Kho còn');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Không mua' }));
    expect(await within(a).findByText('Đã từ chối')).toBeInTheDocument();
    expect(within(a).getByText('Lý do: Kho còn')).toBeInTheDocument();
    expect(within(a).getByText('vừa xong')).toBeInTheDocument();
    expect(within(a).queryByRole('button', { name: /^Mua lần này/ })).toBeNull();
    expect(screen.getByText('Đã từ chối Băng keo 2 mặt')).toBeInTheDocument();
  });

  it('Chấp nhận: hộp nêu số lượng, tháng, người; bấm đúp "Chấp nhận" chỉ gửi 1 POST; badge "Đã chấp nhận"', async () => {
    mockViewport(1280);
    const fetchMock = stub(() => jsonResponse(200, reviewResult('accepted')));
    renderApp(makeMe('admin'), '/admin/review');
    const a = await open('Băng keo 2 mặt', /^Mua lần này —/);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent('Hành chính sẽ mua 2 cái cho phiếu tháng 11 của Phạm Văn Đức.');
    await userEvent.dblClick(within(dialog).getByRole('button', { name: 'Mua lần này' }));
    expect(await within(a).findByText('Đã chấp nhận')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(1);
    expect(screen.getByText('Đã chấp nhận Băng keo 2 mặt')).toBeInTheDocument();
  });

  it('LINE_ALREADY_REVIEWED → khối ngay trong hộp thoại (hộp vẫn mở); đóng hộp → danh sách tải lại, thẻ biến mất, báo trang', async () => {
    mockViewport(1280);
    let taken = false;
    const fetchMock = stub(() => {
      taken = true;
      return jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' });
    }, () => taken);
    renderApp(makeMe('admin'), '/admin/review');
    await open('Băng keo 2 mặt', /^Mua lần này —/);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mua lần này' }));
    expect(await within(dialog).findByText('Dòng này vừa được xử lý ở nơi khác.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Quay lại' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Băng keo 2 mặt' })).toBeNull());
    expect(screen.getByText('Dòng này vừa được xử lý — danh sách đã được làm mới.')).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/admin/review?status=pending').length).toBeGreaterThanOrEqual(2);
  });

  it('Từ chối: nhãn bắt buộc *, gợi ý đúng câu, nút "Quay lại" và nút Từ chối đặc (danger solid)', async () => {
    mockViewport(1280);
    stub(() => jsonResponse(500, {}));
    renderApp(makeMe('admin'), '/admin/review');
    await open('Băng keo 2 mặt', /^Không mua —/);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText(/^Lý do từ chối/)).toHaveAttribute('aria-required', 'true');
    expect(dialog).toHaveTextContent('Lý do từ chối *');
    expect(within(dialog).getByText('Ít nhất 3 ký tự. Viết cho người đăng ký đọc.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Quay lại' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Không mua' })).toHaveClass('btn--danger', 'btn--solid');
  });

  it('Chấp nhận: hộp có nút "Quay lại"', async () => {
    mockViewport(1280);
    stub(() => jsonResponse(500, {}));
    renderApp(makeMe('admin'), '/admin/review');
    await open('Băng keo 2 mặt', /^Mua lần này —/);
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Quay lại' })).toBeInTheDocument();
  });

  it('xử lý xong thẻ Chờ xem: đếm tab giảm 1, đếm tab Đã chấp nhận tăng, huy hiệu sidebar tải lại', async () => {
    mockViewport(1280);
    let accepted = false;
    const fetchMock = stub(() => {
      accepted = true;
      return jsonResponse(200, reviewResult('accepted'));
    }, () => accepted);
    renderApp(makeMe('admin'), '/admin/review');
    expect(await screen.findByRole('radio', { name: /^Chờ xem,\s*2$/ })).toBeInTheDocument();
    const before = fetchMock.mock.calls.filter((c) => c[0] === '/api/admin/review?status=pending').length;
    const a = await open('Băng keo 2 mặt', /^Mua lần này —/);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mua lần này' }));
    await within(a).findByText('Đã chấp nhận', { selector: '.tag' });
    expect(await screen.findByRole('radio', { name: /^Chờ xem,\s*1$/ })).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/admin/review?status=pending').length).toBeGreaterThan(before));
    expect(await screen.findByRole('radio', { name: /^Đã chấp nhận,\s*1$/ })).toBeInTheDocument();
  });
});

describe('ReviewPage — Thêm vào danh mục', () => {
  async function openConvert(name = 'Băng keo 2 mặt') {
    await open(name, /^Mua và thêm vào danh mục —/);
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('radio', { name: 'Văn phòng' });
    return dialog;
  }
  const submit = (d: HTMLElement) => userEvent.click(within(d).getByRole('button', { name: 'Mua và thêm vào danh mục' }));

  it('dòng không ảnh: ô "Ảnh món *" bắt buộc; bấm Thêm mà chưa tải → lỗi ở ô ảnh, không gửi', async () => {
    mockViewport(1280);
    const fetchMock = stub(() => jsonResponse(200, reviewResult('converted')));
    renderApp(makeMe('admin'), '/admin/review');
    const dialog = await openConvert('Bìa còng');
    expect(within(dialog).getByRole('group', { name: 'Ảnh món' })).toHaveTextContent('Ảnh món *');
    expect(within(dialog).queryByText(/Dùng ảnh nhân viên đã gửi/)).toBeNull();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Văn phòng' }));
    await submit(dialog);
    expect(within(dialog).getByText('Món phải có ảnh — chọn hoặc chụp một ảnh.')).toBeInTheDocument();
    expect(posts(fetchMock)).toHaveLength(0);
  });

  it('dòng có ảnh: chú thích dùng ảnh nhân viên đã gửi; server IMAGE_REQUIRED → lỗi ở ô ảnh', async () => {
    mockViewport(1280);
    stub(() => jsonResponse(400, { code: 'IMAGE_REQUIRED' }));
    renderApp(makeMe('admin'), '/admin/review');
    const dialog = await openConvert();
    expect(within(dialog).getByText('Dùng ảnh nhân viên đã gửi làm ảnh món; đổi được ở Danh mục.')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Văn phòng' }));
    await submit(dialog);
    expect(await within(dialog).findByText('Món phải có ảnh — chọn hoặc chụp một ảnh.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Dùng ảnh nhân viên đã gửi/)).toBeNull();
  });

  it.each([
    ['item.name', 'Tên món'],
    ['item.max_qty', 'Tối đa mỗi tháng'],
  ])('VALIDATION {fields:[%s]} → lỗi gắn đúng ô "%s"', async (field, label) => {
    mockViewport(1280);
    stub(() => jsonResponse(400, { code: 'VALIDATION', fields: [field] }));
    renderApp(makeMe('admin'), '/admin/review');
    const dialog = await openConvert();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Văn phòng' }));
    await submit(dialog);
    await waitFor(() => expect(within(dialog).getByLabelText(new RegExp(`^${label}`))).toHaveAttribute('aria-invalid', 'true'));
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('món có sẵn khác ĐVT → cảnh báo đúng câu; thành công → thẻ "Đã thêm vào danh mục" + toast', async () => {
    mockViewport(1280);
    stub(() => jsonResponse(200, reviewResult('converted', { item_id: 'i-2' }, { unit_mismatch: true })));
    renderApp(makeMe('admin'), '/admin/review');
    const dialog = await openConvert();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Món có sẵn' }));
    await userEvent.click(within(dialog).getByRole('button', { name: /Băng keo trong/ }));
    expect(
      within(dialog).getByText('Nhân viên đặt theo «cái», Băng keo trong tính theo «cuộn». Số lượng giữ nguyên 2 — kiểm tra lại với Phạm Văn Đức.'),
    ).toBeInTheDocument();
    await submit(dialog);
    const a = await card('Băng keo 2 mặt');
    expect(await within(a).findByText('Đã thêm vào danh mục')).toBeInTheDocument();
    expect(screen.getByText(/^Đã gắn Băng keo 2 mặt vào Băng keo trong/)).toBeInTheDocument();
  });

  it('hộp 520: nhãn * ở Tên món, Đơn vị tính, Tối đa mỗi tháng, Nhóm; Nhóm là chip có chấm tông nhóm', async () => {
    mockViewport(1280);
    stub(() => jsonResponse(200, reviewResult('converted')));
    renderApp(makeMe('admin'), '/admin/review');
    const dialog = await openConvert();
    for (const label of ['Tên món', 'Đơn vị tính', 'Tối đa mỗi tháng']) {
      expect(within(dialog).getByLabelText(new RegExp(`^${label}`))).toHaveAttribute('aria-required', 'true');
    }
    const group = within(dialog).getByRole('radiogroup', { name: 'Nhóm' });
    expect(group).toHaveAttribute('aria-required', 'true');
    expect(dialog).toHaveTextContent('Nhóm *');
    const chip = within(group).getByRole('radio', { name: 'Văn phòng' });
    expect(chip).toHaveAttribute('aria-checked', 'false');
    expect(chip.querySelector('[data-tone]')).toHaveAttribute('data-tone', 'g1');
    await userEvent.click(chip);
    expect(chip).toHaveAttribute('aria-checked', 'true');
  });

  it('món có sẵn: ô tìm lọc danh sách; mỗi dòng có "tính theo {ĐVT} · {nhóm}"', async () => {
    mockViewport(1280);
    stub(() => jsonResponse(200, reviewResult('converted')));
    renderApp(makeMe('admin'), '/admin/review');
    const dialog = await openConvert();
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Món có sẵn' }));
    const row = within(dialog).getByRole('button', { name: /Băng keo trong/ });
    expect(row).toHaveTextContent('tính theo cuộn · Văn phòng');
    await userEvent.type(within(dialog).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'zzz');
    expect(within(dialog).queryByRole('button', { name: /Băng keo trong/ })).toBeNull();
    expect(within(dialog).getByText('Không có món khớp')).toBeInTheDocument();
  });
});
