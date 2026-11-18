import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within, pickOption } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { audit400, auditUrls, lastAudit, openAudit, pickRange, rangeBox, stubApi } from './audit-test-fixtures';

afterEach(() => vi.useRealTimers());

describe('Nhật ký — thanh lọc lọc ngay (AD-51…53)', () => {
  it('AD-51: không nút "Lọc"; mỗi ô đổi là gọi api ngay — người, rồi hành động, rồi khoảng ngày — và ghi vào URL', async () => {
    const fetchMock = stubApi();
    await openAudit();
    expect(screen.queryByRole('button', { name: 'Lọc' })).toBeNull();
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm người thực hiện' }), 'Bình');
    await userEvent.click(await screen.findByRole('button', { name: /Lê Thị Bình/ }));
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('actor')).toBe('u-binh'));
    await pickOption(screen.getByLabelText('Hành động'), 'Sửa cấu hình');
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('action')).toBe('config.updated'));
    await pickRange('2026-10-01', '2026-10-28');
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('to')).toBe('2026-10-28'));
    const last = lastAudit(fetchMock);
    expect([last.get('action'), last.get('from'), last.get('to')]).toEqual(['config.updated', '2026-10-01', '2026-10-28']);
    expect(screen.getByTestId('location-search')).toHaveTextContent('actor=u-binh&action=config.updated&from=2026-10-01&to=2026-10-28');
    // Một nút "Xóa lọc" cho việc bỏ lọc (ở thanh lọc), không hàng "Đang lọc …" thứ hai
    expect(screen.queryByText(/Đang lọc:/)).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Xóa lọc' })).toHaveLength(1);
  });

  it('Danh bạ dẫn tới ?actor=<sub>: gọi api với actor đó ngay khi vào và hiện tên người', async () => {
    const fetchMock = stubApi();
    await openAudit('/admin/audit?actor=u-binh');
    expect(lastAudit(fetchMock).get('actor')).toBe('u-binh');
    expect(await within(screen.getByRole('group', { name: 'Người thực hiện' })).findByText('Lê Thị Bình')).toBeInTheDocument();
  });

  it('AD-53: nút "Chỉ việc tự động" lọc actor=system ngay; "Xóa lọc" bỏ mọi khóa khỏi URL', async () => {
    const fetchMock = stubApi();
    await openAudit();
    expect(screen.queryByRole('button', { name: 'Hệ thống (tự động)' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Chỉ việc tự động' }));
    expect(screen.getByRole('button', { name: 'Chỉ việc tự động' })).toHaveAttribute('aria-pressed', 'true');
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('actor')).toBe('system'));
    await userEvent.click(screen.getAllByRole('button', { name: 'Xóa lọc' })[0]);
    await vi.waitFor(() => expect(lastAudit(fetchMock).has('actor')).toBe(false));
    expect(screen.getByTestId('location-search')).not.toHaveTextContent('actor=');
  });

  it('AD-52: "Đăng nhập bị từ chối" là một mục của ô Hành động (auth.login_denied_idp), chọn là lọc ngay', async () => {
    const fetchMock = stubApi();
    await openAudit();
    await pickOption(screen.getByLabelText('Hành động'), 'Tài khoản D&E từ chối đăng nhập');
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('action')).toBe('auth.login_denied_idp'));
    expect(screen.queryByRole('group', { name: 'Nhanh:' })).toBeNull();
  });

  it('URL có "đến" sớm hơn "từ" 1 ngày → lỗi gắn ô khoảng ngày ngay, không gọi api; chọn lại một ngày (biên đến = từ) → gọi api', async () => {
    const fetchMock = stubApi();
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/audit?from=2026-10-20&to=2026-10-19');
    await vi.waitFor(() => expect(rangeBox()).toHaveAccessibleDescription('Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.'));
    expect(auditUrls(fetchMock)).toHaveLength(0);
    await pickRange('2026-10-20', '2026-10-20');
    expect(rangeBox()).not.toHaveAccessibleDescription();
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('to')).toBe('2026-10-20'));
    expect(lastAudit(fetchMock).get('from')).toBe('2026-10-20');
  });

  it('khoảng ngày là một ô mở lịch, không có ô gõ ngày hay input date; ?from=2026-10-01 hiện "Từ 01/10/2026"', async () => {
    stubApi();
    await openAudit('/admin/audit?from=2026-10-01');
    expect(document.querySelector('input[type="date"], input[placeholder="dd/mm/yyyy"]')).toBeNull();
    expect(rangeBox()).toHaveTextContent('Từ 01/10/2026');
  });

  it('ô tìm người thực hiện dùng gợi ý ngắn "Tên hoặc email" (câu mặc định bị cắt khi cả thanh lọc nằm một hàng)', async () => {
    stubApi();
    await openAudit('/admin/audit');
    const form = screen.getByRole('form', { name: 'Lọc nhật ký' });
    expect(within(form).getByPlaceholderText('Tên hoặc email')).toBeInTheDocument();
    expect(within(form).queryByPlaceholderText('Gõ tên hoặc email để tìm')).toBeNull();
  });

  it('AD-52: không còn hàng "Nhanh:"; "Hôm nay" là lựa chọn trong ô Khoảng ngày — lúc 23:30 UTC gửi from = to = ngày kế tiếp theo giờ VN', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T23:30:00.000Z'));
    const fetchMock = stubApi();
    await openAudit();
    expect(screen.queryByRole('button', { name: 'Hôm nay' })).toBeNull();
    await userEvent.click(rangeBox());
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Khoảng ngày' })).getByRole('button', { name: 'Hôm nay' }));
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('from')).toBe('2026-10-29'));
    expect(lastAudit(fetchMock).get('to')).toBe('2026-10-29');
    expect(rangeBox()).toHaveTextContent('29/10/2026 – 29/10/2026');
    await userEvent.click(rangeBox());
    expect(within(screen.getByRole('dialog', { name: 'Khoảng ngày' })).getByRole('button', { name: 'Hôm nay' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('AD-52: ô Khoảng ngày có "7 ngày qua" (22–28/10) và "Tháng 10/2026" (cả tháng)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-28T05:00:00.000Z'));
    const fetchMock = stubApi();
    await openAudit();
    await userEvent.click(rangeBox());
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Khoảng ngày' })).getByRole('button', { name: '7 ngày qua' }));
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('from')).toBe('2026-10-22'));
    await userEvent.click(rangeBox());
    await userEvent.click(within(screen.getByRole('dialog', { name: 'Khoảng ngày' })).getByRole('button', { name: 'Tháng 10/2026' }));
    await vi.waitFor(() => expect(lastAudit(fetchMock).get('from')).toBe('2026-10-01'));
    expect(lastAudit(fetchMock).get('to')).toBe('2026-10-31');
  });

  it('api trả VALIDATION fields [to] → lỗi gắn ô khoảng ngày, không hiện lỗi tải chung', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.startsWith('/api/admin/audit') ? audit400(['to']) : jsonResponse(200, { items: [], next_cursor: null }))));
    mockViewport(1280);
    renderApp(makeMe('admin'), '/admin/audit?to=2026-02-30');
    await vi.waitFor(() => expect(rangeBox()).toHaveAccessibleDescription('Ngày không hợp lệ.'));
    expect(screen.queryByText('Không tải được dữ liệu — thử lại.')).toBeNull();
  });
});
