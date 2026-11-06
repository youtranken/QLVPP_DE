import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, userEvent, waitFor, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import i18n from '@/lib/i18n';
import type { SendStateDto } from '@/features/send-adm/send-adm.api';
import { PEN_KEY, TAPE_KEY, reportFixture, snapshotDataFixture } from './reports-fixtures';
import { errorResponse, postsOf, stubReports, UNSENT } from './reports-test-stub';

const PART1 = 'Phần 1 · Tổng hợp theo món';
// 22:12 05/11 giờ VN
const SENT_AT = '2026-11-05T15:12:00Z';

function openPage(path = '/admin/reports') {
  mockViewport(1280);
  renderApp(makeMe('admin'), path);
}

const part1 = () => screen.findByRole('region', { name: PART1 });
const rowOf = async (name: string) => within(await part1()).findByRole('row', { name: new RegExp(name) });
const headers = async () => within(await part1()).getAllByRole('columnheader').map((h) => h.textContent);
const cellsOf = async (name: string) => within(await rowOf(name)).getAllByRole('cell').map((c) => c.textContent);

const sentState = (data = snapshotDataFixture({ created_at: SENT_AT })): SendStateDto => ({
  ...UNSENT,
  state: 'sent',
  sent: { id: data.id, kind: 'print', created_at: data.created_at, items_count: 2, units_total: 19, replaces: null, data },
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await i18n.changeLanguage('vi');
});

describe('Báo cáo chỉ đọc', () => {
  it('đúng một h1; không ô nhập nào; không nút "In trình ký"/"Xuất Excel"; không POST', async () => {
    const f = stubReports();
    openPage();
    await rowOf('Bút bi xanh');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryAllByRole('textbox')).toEqual([]);
    expect(screen.queryAllByRole('spinbutton')).toEqual([]);
    expect(screen.queryByRole('button', { name: /^In trình ký/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Xuất Excel/ })).toBeNull();
    expect(postsOf(f)).toEqual([]);
  });

  it('tên cột trùng Gửi ADM: Đăng ký · Nợ tháng trước · Tủ hiện có (tham khảo) · Tổng cần · Đề nghị', async () => {
    stubReports();
    openPage();
    await rowOf('Bút bi xanh');
    expect(await headers()).toEqual(['Món', 'ĐVT', 'Đăng ký', 'Nợ tháng trước', 'Tủ hiện có (tham khảo)', expect.stringMatching(/^Tổng cần/), 'Đề nghị', 'Số người']);
  });

  it('chưa gửi → Đề nghị = số gộp (đăng ký 12 + nợ 3 = 15, không trừ tủ 5), ghi "Gợi ý, chưa gửi"', async () => {
    stubReports();
    openPage();
    expect(await cellsOf('Bút bi xanh')).toEqual([expect.stringMatching(/Bút bi xanh/), 'cây', '12', '3', '5', '15', '15', '']);
    expect(within(await part1()).getByText('Gợi ý, chưa gửi')).toBeInTheDocument();
    expect(within(await part1()).queryByText(/Theo bản đã gửi/)).toBeNull();
  });

  it('đã gửi → Đề nghị theo order_qty của bản (14, khác gợi ý 15), ghi "Theo bản đã gửi 22:12 05/11"; có cột Đã về, Đã giao', async () => {
    const report = reportFixture({ progress: { [PEN_KEY]: { registered: 12, delivered: 4, received: 10 }, [TAPE_KEY]: { registered: 4, delivered: 0, received: 0 } } });
    stubReports({ reports: { '2026-10': report }, sendState: { '2026-10': sentState() } });
    openPage();
    expect(await within(await part1()).findByText('Theo bản đã gửi 22:12 05/11')).toBeInTheDocument();
    expect(within(await part1()).queryByText('Gợi ý, chưa gửi')).toBeNull();
    expect(await headers()).toEqual(['Món', 'ĐVT', 'Đăng ký', 'Nợ tháng trước', 'Tủ hiện có (tham khảo)', expect.stringMatching(/^Tổng cần/), 'Đề nghị', 'Đã về', 'Đã giao', 'Số người']);
    expect(await cellsOf('Bút bi xanh')).toEqual([expect.stringMatching(/Bút bi xanh/), 'cây', '12', '3', '5', '15', '14', '10', '4', '']);
  });

  it('kỳ đã giao hết (báo cáo sống rỗng) → Phần 1 vẫn có hàng của bản đã gửi + Đã về, Đã giao sống', async () => {
    const live = reportFixture({ byItem: [], custom: [], progress: { [PEN_KEY]: { registered: 15, delivered: 15, received: 14 } } });
    stubReports({ reports: { '2026-10': live }, sendState: { '2026-10': sentState() } });
    openPage();
    const cells = await cellsOf('Bút bi xanh');
    expect(cells.slice(6, 9)).toEqual(['14', '14', '15']);
    expect(await rowOf('Băng keo 2 mặt')).toBeInTheDocument();
    expect(within(await part1()).queryByText('Tháng này chưa có món nào được đăng ký.')).toBeNull();
  });

  it('kỳ khóa gần nhất → liên kết "Sửa số đề nghị ở Gửi ADM →" tới Gửi ADM; kỳ khóa cũ hơn (Gửi ADM không mở được) → không có', async () => {
    stubReports();
    openPage();
    const link = await within(await part1()).findByRole('link', { name: 'Sửa số đề nghị ở Gửi ADM →' });
    expect(link).toHaveAttribute('href', '/admin/send-adm');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-09'));
    await rowOf('Bút bi xanh');
    expect(within(await part1()).queryByRole('link', { name: /Gửi ADM/ })).toBeNull();
  });

  it('kỳ đang mở → không gọi send-state, ghi "Gợi ý, chưa gửi", không liên kết Gửi ADM; cảnh báo tạm tính', async () => {
    const f = stubReports();
    openPage('/admin/reports?ym=2026-11');
    expect(await within(await part1()).findByText('Gợi ý, chưa gửi')).toBeInTheDocument();
    expect(screen.getByText('Kỳ tháng 11 đang mở — số liệu tạm tính theo phiếu đã lưu.')).toBeInTheDocument();
    expect(within(await part1()).queryByRole('link', { name: /Gửi ADM/ })).toBeNull();
    expect(f.mock.calls.some((c) => String(c[0]).includes('send-state'))).toBe(false);
  });

  it('kỳ đã khóa → không có cảnh báo tạm tính', async () => {
    stubReports();
    openPage();
    await rowOf('Bút bi xanh');
    expect(screen.queryByText(/số liệu tạm tính/)).toBeNull();
  });

  it('send-state lỗi 500 → "Thử lại", bấm thì tải lại', async () => {
    let fail = true;
    const f = stubReports();
    const base = f.getMockImplementation()!;
    f.mockImplementation(async (url: string, init?: RequestInit) => (url.endsWith('/send-state') && fail ? errorResponse(500, 'INTERNAL') : base(url, init)));
    openPage();
    const retry = await screen.findByRole('button', { name: 'Thử lại' }, { timeout: 4000 });
    fail = false;
    await userEvent.click(retry);
    expect(await rowOf('Bút bi xanh')).toBeInTheDocument();
  });

  it('còn món chờ xem → cảnh báo "Còn 1 món … chưa được tính vào báo cáo này." + liên kết', async () => {
    stubReports({ reports: { '2026-10': reportFixture({ pending_custom_count: 1 }) } });
    openPage();
    expect(await screen.findByText('Còn 1 món ngoài danh mục chưa xem — chưa được tính vào báo cáo này.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem món chờ' })).toHaveAttribute('href', '/admin/review?ym=2026-10');
  });

  it('en: "From the order sent 22:12 05/11" và "Edit order numbers in Send to ADM →"', async () => {
    await i18n.changeLanguage('en');
    stubReports({ sendState: { '2026-10': sentState() } });
    openPage();
    const p1 = await screen.findByRole('region', { name: 'Part 1 · Summary by item' });
    expect(await within(p1).findByText('From the order sent 22:12 05/11')).toBeInTheDocument();
    expect(within(p1).getByRole('link', { name: 'Edit order numbers in Send to ADM →' })).toBeInTheDocument();
  });
});

describe('Báo cáo — đổi tháng không hỏi', () => {
  it('bấm "Tháng trước" → sang 09/2026 ngay, không hộp thoại', async () => {
    stubReports();
    openPage();
    await rowOf('Bút bi xanh');
    await userEvent.click(screen.getByRole('button', { name: 'Tháng trước' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('?ym=2026-09'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
