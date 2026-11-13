import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { AN, ERR_AT, NEVER, OK_AT, openUsers, stubUsers } from './users-fixtures';

// Màn Người dùng — "Đồng bộ ngay" (kết quả, lỗi, CSRF) và dòng trạng thái danh bạ PMH ID
afterEach(() => vi.unstubAllGlobals());

describe('UsersPage — đồng bộ PMH ID', () => {
  it('kết quả đồng bộ no_access 2 → dòng "2 người không còn quyền vào VPP."; reconcile ok thì không có cảnh báo', async () => {
    stubUsers([AN], () => jsonResponse(200, { created: 0, updated: 1, no_access: 2, reconcile: 'ok' }));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    const notice = (await screen.findByText(/2 người không còn quyền vào VPP\./)).closest('[role="status"]')!;
    expect(notice).toHaveTextContent('Đã đồng bộ từ PMH ID: 0 người mới, 1 cập nhật.');
    expect(notice).not.toHaveTextContent('Chưa đối chiếu được');
  });

  it('no_access 0 → không có dòng không còn quyền; reconcile aborted → cảnh báo chưa đối chiếu được', async () => {
    stubUsers([AN], () => jsonResponse(200, { created: 0, updated: 0, no_access: 0, reconcile: 'aborted' }));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    const notice = (await screen.findByText(/Chưa đối chiếu được người vắng khỏi danh bạ PMH ID/)).closest('[role="status"]')!;
    expect(notice).not.toHaveTextContent('không còn quyền vào VPP');
  });

  it('đồng bộ ok → khối ok "Đã đồng bộ từ PMH ID: 2 người mới, 3 cập nhật." có nút đóng; gửi CSRF', async () => {
    const f = stubUsers([AN], () => jsonResponse(200, { created: 2, updated: 3, no_access: 0, reconcile: 'ok' }));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    const ok = await screen.findByText('Đã đồng bộ từ PMH ID: 2 người mới, 3 cập nhật.');
    expect(ok.closest('[role="status"]')).not.toBeNull();
    const [, init] = f.mock.calls.find(([u]) => u === '/api/admin/directory/sync') as [string, RequestInit];
    expect((init.headers as Record<string, string>)['X-CSRF-Token']).toBe('csrf-1');
    await userEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(screen.queryByText(/Đã đồng bộ từ PMH ID/)).toBeNull();
  });

  it('đồng bộ SSO_UNAVAILABLE → khối danger + "Thử lại", bảng vẫn còn; thử lại thành công thì khối lỗi mất', async () => {
    let fail = true;
    stubUsers([AN], () => (fail ? jsonResponse(503, { code: 'SSO_UNAVAILABLE', message: 'x' }) : jsonResponse(200, { created: 1, updated: 0 })));
    await openUsers();
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Không liên lạc được PMH ID — thử lại sau ít phút.');
    expect(screen.getByText('Phạm Minh Đức')).toBeInTheDocument();
    fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Đã đồng bộ từ PMH ID: 1 người mới, 0 cập nhật.')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('dòng trạng thái: cập nhật lúc 14:05 09/11 (giờ VN)', async () => {
    stubUsers([AN], undefined, undefined, () => ({ last_at: OK_AT, last_total: 5, last_error: null }));
    await openUsers();
    expect(await screen.findByText('Danh bạ PMH ID cập nhật lúc 14:05 09/11')).toBeInTheDocument();
  });

  it('dòng trạng thái: lỗi mới hơn → "Không đọc được … lúc 15:05 09/11, đang hiện bản 14:05 09/11" + lý do theo mã (kể cả giới hạn tần suất)', async () => {
    stubUsers([AN], undefined, undefined, () => ({ last_at: OK_AT, last_total: 5, last_error: { at: ERR_AT, code: 'DIRECTORY_RATE_LIMITED', message: 'x' } }));
    await openUsers();
    expect(await screen.findByText(/^Không đọc được danh bạ PMH ID lúc 15:05 09\/11, đang hiện bản 14:05 09\/11\. PMH ID đang giới hạn tần suất/)).toBeInTheDocument();
  });

  it('dòng trạng thái: lỗi cũ hơn lần thành công thì chỉ hiện bản cập nhật; chưa từng đồng bộ mà lỗi → không có "đang hiện bản"', async () => {
    stubUsers([AN], undefined, undefined, () => ({ last_at: ERR_AT, last_total: 5, last_error: { at: OK_AT, code: 'DIRECTORY_UNAVAILABLE', message: 'x' } }));
    await openUsers();
    expect(await screen.findByText('Danh bạ PMH ID cập nhật lúc 15:05 09/11')).toBeInTheDocument();
    cleanup();
    stubUsers([AN], undefined, undefined, () => ({ last_at: null, last_total: null, last_error: { at: ERR_AT, code: 'MA_LA', message: 'x' } }));
    await openUsers();
    expect(await screen.findByText(/^Không đọc được danh bạ PMH ID lúc 15:05 09\/11\. Chưa đồng bộ được/)).toBeInTheDocument();
    expect(screen.queryByText(/đang hiện bản/)).toBeNull();
  });

  it('bấm Đồng bộ ngay xong (thành công hay lỗi) thì tải lại dòng trạng thái', async () => {
    let n = 0;
    const f = stubUsers([AN], () => jsonResponse(502, { code: 'DIRECTORY_UNAVAILABLE', message: 'x' }), undefined, () => (++n > 1 ? { last_at: null, last_total: null, last_error: { at: ERR_AT, code: 'DIRECTORY_UNAVAILABLE', message: 'x' } } : NEVER));
    await openUsers();
    await screen.findByText('Chưa đồng bộ danh bạ PMH ID');
    await userEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    expect(await screen.findByText(/^Không đọc được danh bạ PMH ID lúc 15:05 09\/11/)).toBeInTheDocument();
    expect(f.mock.calls.filter(([u]) => u === '/api/admin/directory/status')).toHaveLength(2);
  });
});
