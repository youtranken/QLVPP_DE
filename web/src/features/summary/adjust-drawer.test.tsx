import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { reviewResult } from '@/features/review/review-fixtures';
import { AdjustDrawer } from './adjust-drawer';
import { ADMIN_ITEMS, adminRequest } from './adjust-fixtures';
import type { AdminRequestView } from './summary.api';

type Put = (body: Record<string, unknown>) => Response;

function stub({
  views = [adminRequest()],
  put = () => jsonResponse(200, { request: adminRequest() }),
  review = () => jsonResponse(200, reviewResult('accepted', { id: 'l-tape' })),
}: {
  views?: AdminRequestView[];
  put?: Put;
  review?: () => Response;
} = {}) {
  let loads = 0;
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url === '/api/admin/requests/r-1') return Promise.resolve(jsonResponse(200, views[Math.min(loads++, views.length - 1)]));
    if (url === '/api/admin/requests/r-1/lines') return Promise.resolve(put(JSON.parse(String(init?.body))));
    if (url === '/api/admin/items') return Promise.resolve(jsonResponse(200, ADMIN_ITEMS));
    if (url === '/api/admin/lines/l-tape/review') return Promise.resolve(review());
    return Promise.resolve(jsonResponse(200, []));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const putBody = (f: ReturnType<typeof stub>) => {
  const call = f.mock.calls.find((c) => c[0] === '/api/admin/requests/r-1/lines') as unknown as [string, RequestInit];
  return JSON.parse(String(call[1].body));
};

async function renderDrawer() {
  const onClose = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <ConfirmProvider>
        <AdjustDrawer requestId="r-1" onClose={onClose} />
      </ConfirmProvider>
    </MeContext.Provider>,
  );
  const drawer = await screen.findByRole('dialog', { name: 'Phiếu của Nguyễn Văn An' });
  // Giới hạn số lượng lấy từ danh mục Hành chính: chờ tải xong mới bấm được +
  await waitFor(() => expect(within(drawer).getByRole('button', { name: 'Thêm Số lượng Giấy note vàng' })).toBeEnabled());
  return { drawer, onClose };
}

const row = (drawer: HTMLElement, name: string) => within(drawer).getByText(name).closest('li')!;
const save = (drawer: HTMLElement) => within(drawer).getByRole('button', { name: 'Lưu điều chỉnh' });
const reasonBox = (drawer: HTMLElement) => within(drawer).getByLabelText('Lý do điều chỉnh');

afterEach(() => vi.unstubAllGlobals());

describe('AdjustDrawer — ngăn điều chỉnh phiếu', () => {
  it('kỳ đã khóa: tiêu đề + nhãn "Đã khóa"; Lưu vô hiệu khi chưa sửa và khi lý do trống/ngắn', async () => {
    stub();
    const { drawer } = await renderDrawer();
    expect(within(drawer).getByText('Đã khóa')).toBeInTheDocument();
    expect(within(drawer).getByText(/Tháng 10\/2026 · Tổ Giám sát · lưu lần cuối/)).toBeInTheDocument();
    expect(save(drawer)).toBeDisabled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Số lượng Giấy note vàng' }));
    const note = row(drawer, 'Giấy note vàng');
    expect(note).toHaveClass('is-changed');
    expect(within(note).getByText('3')).toHaveClass('aj-was');
    expect(save(drawer)).toBeDisabled();
    await userEvent.type(reasonBox(drawer), ' ab ');
    expect(save(drawer)).toBeDisabled();
    await userEvent.type(reasonBox(drawer), 'c');
    expect(save(drawer)).toBeEnabled();
  });

  it('stepper không xuống dưới số đã giao: cận dưới 3, chú thích "đã giao 3", không có nút ×', async () => {
    stub();
    const { drawer } = await renderDrawer();
    const pen = row(drawer, 'Bút bi xanh');
    const input = within(pen).getByRole('spinbutton', { name: 'Số lượng Bút bi xanh' });
    expect(input).toHaveAccessibleDescription('đã giao 3');
    await userEvent.clear(input);
    await userEvent.type(input, '1');
    await userEvent.tab();
    expect(input).toHaveValue(3);
    expect(within(pen).getByRole('button', { name: 'Bớt Số lượng Bút bi xanh' })).toBeDisabled();
    expect(within(pen).queryByRole('button', { name: /^Bỏ / })).toBeNull();
    expect(within(row(drawer, 'Giấy note vàng')).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' })).toBeInTheDocument();
  });

  it('Hủy sau khi sửa → hỏi "Bỏ thay đổi chưa lưu?"; Tiếp tục sửa giữ ngăn, Bỏ thay đổi đóng', async () => {
    stub();
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' }));
    expect(row(drawer, 'Giấy note vàng')).toHaveClass('is-removed');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Hủy' }));
    expect(await screen.findByText('Bỏ thay đổi chưa lưu?')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Tiếp tục sửa'));
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Hủy' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('409 STALE_UPDATE → tải lại dữ liệu ngăn, giữ lý do đã gõ, báo "Nhân viên vừa sửa phiếu này"', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[1] = { ...fresh.lines[1], qty: 4 };
    const fetchMock = stub({ views: [adminRequest(), fresh], put: () => jsonResponse(409, { code: 'STALE_UPDATE' }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Số lượng Giấy note vàng' }));
    await userEvent.type(reasonBox(drawer), 'An báo nhầm');
    await userEvent.click(save(drawer));
    expect(await within(drawer).findByRole('alert')).toHaveTextContent('Nhân viên vừa sửa phiếu này — dữ liệu đã được tải lại');
    await waitFor(() => expect(within(row(drawer, 'Giấy note vàng')).getByRole('spinbutton')).toHaveValue(4));
    expect(row(drawer, 'Giấy note vàng')).not.toHaveClass('is-changed');
    expect(reasonBox(drawer)).toHaveValue('An báo nhầm');
    expect(save(drawer)).toBeDisabled();
    expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/admin/requests/r-1')).toHaveLength(2);
  });

  it('thêm món chỉ Hành chính → body gửi đủ dòng cũ + {item_id, qty}, lý do, expected_updated_at; xong thì đóng', async () => {
    const fetchMock = stub();
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    await userEvent.type(within(drawer).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'a4');
    const pick = within(drawer).getByRole('button', { name: /Giấy A4 Double A/ });
    expect(pick).toHaveTextContent('Chỉ Hành chính');
    expect(within(drawer).queryByRole('button', { name: /Giấy cũ/ })).toBeNull();
    await userEvent.click(pick);
    expect(row(drawer, 'Giấy A4 Double A')).toHaveTextContent('Mới thêm');
    await userEvent.type(reasonBox(drawer), 'Bổ sung giấy in bản vẽ');
    await userEvent.click(save(drawer));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(putBody(fetchMock)).toEqual({
      lines: [
        { id: 'l-pen', qty: 10 },
        { id: 'l-note', qty: 3 },
        { id: 'l-tape', qty: 2 },
        { item_id: 'i-a4', qty: 1 },
      ],
      expected_updated_at: '2026-10-05T07:20:00.000Z',
      reason: 'Bổ sung giấy in bản vẽ',
    });
  });

  it('QTY_BELOW_DELIVERED {line_id} → lỗi tại đúng dòng, ngăn vẫn mở', async () => {
    stub({ put: () => jsonResponse(400, { code: 'QTY_BELOW_DELIVERED', line_id: 'l-pen', delivered: 3 }) });
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Số lượng Bút bi xanh' }));
    await userEvent.type(reasonBox(drawer), 'Sửa số');
    await userEvent.click(save(drawer));
    expect(await within(row(drawer, 'Bút bi xanh')).findByText('Không ít hơn số đã giao (3).')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('dòng ngoài DM có ReviewActions áp dụng ngay; lần Lưu sau dùng request_updated_at của review', async () => {
    const fetchMock = stub();
    const { drawer } = await renderDrawer();
    const tape = within(drawer).getByRole('group', { name: 'Xử lý Băng keo 2 mặt' });
    await userEvent.click(within(tape).getByRole('button', { name: 'Chấp nhận — Băng keo 2 mặt' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: /Chấp nhận “Băng keo 2 mặt”/ })).getByRole('button', { name: 'Chấp nhận' }));
    expect(await within(drawer).findByText('Đã chấp nhận')).toBeInTheDocument();
    expect(save(drawer)).toBeDisabled();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Số lượng Giấy note vàng' }));
    await userEvent.type(reasonBox(drawer), 'Sửa số');
    await userEvent.click(save(drawer));
    await waitFor(() => expect(putBody(fetchMock).expected_updated_at).toBe('2026-11-05T08:00:00.000Z'));
  });

  it('kỳ đang mở: lý do không bắt buộc; bỏ dòng → body không còn dòng đó', async () => {
    const fetchMock = stub({ views: [adminRequest({ is_open: true, period_ym: '2026-11' })] });
    const { drawer } = await renderDrawer();
    expect(within(drawer).getByText('Đang mở')).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Bỏ Giấy note vàng khỏi phiếu' }));
    expect(save(drawer)).toBeEnabled();
    await userEvent.click(save(drawer));
    await waitFor(() =>
      expect(putBody(fetchMock)).toEqual({
        lines: [
          { id: 'l-pen', qty: 10 },
          { id: 'l-tape', qty: 2 },
        ],
        expected_updated_at: '2026-10-05T07:20:00.000Z',
      }),
    );
  });

  it('Enter trong ô tìm món không lưu ngăn: khớp món → thêm món đầu, không khớp → không làm gì', async () => {
    const fetchMock = stub({ views: [adminRequest({ is_open: true })] });
    const { drawer, onClose } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Số lượng Giấy note vàng' }));
    await userEvent.click(within(drawer).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    const search = within(drawer).getByRole('searchbox', { name: 'Tìm món trong danh mục' });
    await userEvent.type(search, 'zzz{Enter}');
    await userEvent.clear(search);
    await userEvent.type(search, 'a4{Enter}');
    expect(row(drawer, 'Giấy A4 Double A')).toHaveTextContent('Mới thêm');
    expect(fetchMock.mock.calls.some((c) => c[0] === '/api/admin/requests/r-1/lines')).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('món đã có trên dòng converted không được gợi ý lại trong "Thêm món" (tránh DUPLICATE_ITEM)', async () => {
    const view = adminRequest();
    view.lines[2] = { ...view.lines[2], item_id: 'i-clip', review_status: 'converted', custom_name: null, custom_unit: null };
    view.lines[2].item = { name: 'Kẹp giấy 33 mm', name_en: null, unit: 'hop', pack_note: null, image_file_id: null, active: true, admin_only: false };
    stub({ views: [view] });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: '+ Thêm món vào phiếu' }));
    await userEvent.type(within(drawer).getByRole('searchbox', { name: 'Tìm món trong danh mục' }), 'giấy');
    const results = within(drawer).getByRole('list', { name: 'Món tìm thấy' });
    expect(within(results).getByRole('button', { name: /Giấy A4 Double A/ })).toBeInTheDocument();
    expect(within(results).queryByRole('button', { name: /Kẹp giấy 33 mm/ })).toBeNull();
  });

  it('dòng ngoài DM đã bị từ chối → số lượng chỉ đọc, không có stepper', async () => {
    const view = adminRequest();
    view.lines[2] = { ...view.lines[2], review_status: 'rejected', review_note: 'Kho còn' };
    stub({ views: [view] });
    const { drawer } = await renderDrawer();
    const tape = row(drawer, 'Băng keo 2 mặt');
    expect(within(tape).getByText('Từ chối: Kho còn')).toBeInTheDocument();
    expect(within(tape).queryByRole('spinbutton')).toBeNull();
    expect(within(tape).queryByRole('button', { name: /Số lượng/ })).toBeNull();
  });

  it('review báo dòng đã xử lý → tải lại; dòng khác cũng đổi → bỏ nháp, báo STALE, giữ lý do', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[1] = { ...fresh.lines[1], qty: 4 };
    fresh.lines[2] = { ...fresh.lines[2], review_status: 'accepted' };
    stub({ views: [adminRequest(), fresh], review: () => jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Số lượng Bút bi xanh' }));
    await userEvent.type(reasonBox(drawer), 'An báo nhầm');
    await userEvent.click(within(drawer).getByRole('button', { name: 'Chấp nhận — Băng keo 2 mặt' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: /Chấp nhận “Băng keo 2 mặt”/ })).getByRole('button', { name: 'Chấp nhận' }));
    expect(await within(drawer).findByText('Nhân viên vừa sửa phiếu này — dữ liệu đã được tải lại')).toBeInTheDocument();
    await waitFor(() => expect(within(row(drawer, 'Giấy note vàng')).getByRole('spinbutton')).toHaveValue(4));
    expect(within(row(drawer, 'Bút bi xanh')).getByRole('spinbutton')).toHaveValue(10);
    expect(reasonBox(drawer)).toHaveValue('An báo nhầm');
  });

  it('review báo dòng đã xử lý nhưng chỉ dòng đó đổi → giữ nháp, không báo STALE', async () => {
    const fresh = adminRequest({ updated_at: '2026-10-06T01:00:00.000Z' });
    fresh.lines[2] = { ...fresh.lines[2], review_status: 'accepted' };
    const fetchMock = stub({ views: [adminRequest(), fresh], review: () => jsonResponse(409, { code: 'LINE_ALREADY_REVIEWED' }) });
    const { drawer } = await renderDrawer();
    await userEvent.click(within(drawer).getByRole('button', { name: 'Thêm Số lượng Bút bi xanh' }));
    await userEvent.click(within(drawer).getByRole('button', { name: 'Chấp nhận — Băng keo 2 mặt' }));
    await userEvent.click(within(screen.getByRole('dialog', { name: /Chấp nhận “Băng keo 2 mặt”/ })).getByRole('button', { name: 'Chấp nhận' }));
    await waitFor(() => expect(fetchMock.mock.calls.filter((c) => c[0] === '/api/admin/requests/r-1')).toHaveLength(2));
    await waitFor(() => expect(within(drawer).getByText('Đã chấp nhận')).toBeInTheDocument());
    expect(within(row(drawer, 'Bút bi xanh')).getByRole('spinbutton')).toHaveValue(11);
    expect(within(drawer).queryByText('Nhân viên vừa sửa phiếu này — dữ liệu đã được tải lại')).toBeNull();
  });
});

describe('AdjustDrawer — giới hạn số lượng dòng đã có', () => {
  it('món đã ngừng: chỉ giảm (Thêm vô hiệu, Bớt bấm được); SL vượt max_qty: chỉ giảm', async () => {
    const old = { name: 'Giấy cũ', name_en: null, unit: 'cai', pack_note: null, image_file_id: null, active: false, admin_only: false };
    const clip = { ...old, name: 'Kẹp giấy 33 mm', unit: 'hop', active: true };
    stub({
      views: [
        adminRequest({
          lines: [
            ...adminRequest().lines,
            lineView({ id: 'l-old', item_id: 'i-old', item: old, qty: 5 }),
            lineView({ id: 'l-clip', item_id: 'i-clip', item: clip, qty: 12 }),
          ],
        }),
      ],
    });
    const { drawer } = await renderDrawer();
    for (const name of ['Giấy cũ', 'Kẹp giấy 33 mm']) {
      expect(within(drawer).getByRole('button', { name: `Thêm Số lượng ${name}` })).toBeDisabled();
      expect(within(drawer).getByRole('button', { name: `Bớt Số lượng ${name}` })).toBeEnabled();
    }
  });
});

