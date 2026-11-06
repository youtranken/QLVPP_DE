import { describe, it, expect, vi } from 'vitest';
import { apiFetch, apiFetchBlob, ApiError, makeQueryClient } from '@/lib/api-client';
import { handleSessionExpired } from '@/lib/session-relogin';
import { jsonResponse } from '@/test/test-utils';

vi.mock('@/lib/session-relogin', () => ({ handleSessionExpired: vi.fn() }));

describe('apiFetch', () => {
  it('trả JSON khi ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { a: 1 })));
    await expect(apiFetch<{ a: number }>('/x')).resolves.toEqual({ a: 1 });
  });

  it('ném ApiError kèm status + body khi !ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(409, { message: 'trùng' })),
    );
    const err = (await apiFetch('/x').catch((e) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(409);
    expect(err.body).toEqual({ message: 'trùng' });
  });

  it('401 → ném ApiError(401), redirect xử lý tập trung', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(401, {})));
    await expect(apiFetch('/x')).rejects.toMatchObject({ status: 401 });
    expect(handleSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('gắn Content-Type + X-CSRF-Token khi có body/csrf', async () => {
    const fn = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal('fetch', fn);
    await apiFetch('/x', {
      method: 'POST',
      body: JSON.stringify({ a: 1 }),
      csrfToken: 'tok',
    });
    const init = fn.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['X-CSRF-Token']).toBe('tok');
  });
});

describe('apiFetch — FormData', () => {
  it('body FormData không bị gắn Content-Type JSON (trình duyệt tự đặt boundary)', async () => {
    const fn = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    vi.stubGlobal('fetch', fn);
    await apiFetch('/api/files', { method: 'POST', body: new FormData(), csrfToken: 'tok' });
    const init = fn.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers['Content-Type']).toBeUndefined();
    expect(init.headers['X-CSRF-Token']).toBe('tok');
  });
});

const fileResponse = (status: number, headers: Record<string, string> = {}, body = 'xlsx-bytes') => new Response(body, { status, headers });

describe('apiFetchBlob — tải tệp qua cùng luật lỗi với apiFetch', () => {
  it('ok → blob + tên tệp từ Content-Disposition', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fileResponse(200, { 'Content-Disposition': 'attachment; filename="vpp-bao-cao-2026-10.xlsx"' })));
    const file = await apiFetchBlob('/x');
    expect(file.fileName).toBe('vpp-bao-cao-2026-10.xlsx');
    expect(await file.blob.text()).toBe('xlsx-bytes');
  });

  it("filename*=UTF-8'' được giải mã; không có Content-Disposition → fileName null", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fileResponse(200, { 'Content-Disposition': "attachment; filename*=UTF-8''b%C3%A1o%20c%C3%A1o.xlsx" })));
    expect((await apiFetchBlob('/x')).fileName).toBe('báo cáo.xlsx');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fileResponse(200)));
    expect((await apiFetchBlob('/x')).fileName).toBeNull();
  });

  it('tên tệp có "/" hoặc ".." bị bỏ (chỉ nhận tên phẳng)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fileResponse(200, { 'Content-Disposition': 'attachment; filename="../x.xlsx"' })));
    expect((await apiFetchBlob('/x')).fileName).toBeNull();
  });

  it('401 → handleSessionExpired + ApiError(401)', async () => {
    vi.mocked(handleSessionExpired).mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fileResponse(401, {}, '{}')));
    await expect(apiFetchBlob('/x')).rejects.toMatchObject({ status: 401 });
    expect(handleSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('404 → ApiError kèm body JSON (code), không trả blob', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fileResponse(404, { 'Content-Type': 'application/json' }, '{"code":"SNAPSHOT_NOT_FOUND"}')));
    await expect(apiFetchBlob('/x')).rejects.toMatchObject({ status: 404, body: { code: 'SNAPSHOT_NOT_FOUND' } });
  });

  it('query mặc định: 409 (vd PERIOD_NOT_LOCKED) không thử lại → hiện lỗi ngay; lỗi khác thử lại 1 lần', () => {
    const retry = makeQueryClient().getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean;
    expect(retry(0, new ApiError(409, { code: 'PERIOD_NOT_LOCKED' }))).toBe(false);
    expect(retry(0, new ApiError(500, null))).toBe(true);
    expect(retry(1, new ApiError(500, null))).toBe(false);
  });
});
