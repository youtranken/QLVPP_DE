import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { MeContext } from '@/lib/me';
import { ToastProvider } from '@/ui/toast-provider';
import { reviewResult } from '@/features/review/review-fixtures';
import { ReviewBlock } from './review-block';

afterEach(() => vi.unstubAllGlobals());

const LINE = lineView({ id: 'l-shelf', custom_name: 'Kệ mica 3 tầng', custom_unit: 'cai', qty: 2, review_status: 'pending', image_file_id: 'f-1' });

function stub() {
  const f = vi.fn(async (url: string, _init?: RequestInit) => {
    if (url === '/api/admin/lines/l-shelf/review') return jsonResponse(200, reviewResult('accepted', { id: 'l-shelf' }));
    if (url.startsWith('/api/item-categories')) return jsonResponse(200, [{ id: 'c-1', name: 'Văn phòng', name_en: null, sort_order: 0, active: true }]);
    return jsonResponse(200, []);
  });
  vi.stubGlobal('fetch', f);
  return f;
}

const reviewPosts = (f: ReturnType<typeof stub>) =>
  f.mock.calls.filter(([u]) => u === '/api/admin/lines/l-shelf/review').map(([, init]) => JSON.parse(String(init?.body)));

function show() {
  const onDone = vi.fn();
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <ReviewBlock line={LINE} requestUpdatedAt="2026-11-05T03:00:00.000Z" onDone={onDone} />
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
  return onDone;
}

describe('ReviewBlock — duyệt món ngoài danh mục trong Xem phiếu (G8)', () => {
  it('không tick "Thêm luôn vào danh mục" → Chấp nhận gửi action accept kèm mốc phiếu', async () => {
    const f = stub();
    const onDone = show();
    expect(screen.getByRole('checkbox', { name: 'Thêm luôn vào danh mục' })).not.toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Chấp nhận Kệ mica 3 tầng' }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(reviewPosts(f)).toEqual([{ action: 'accept', expected_updated_at: '2026-11-05T03:00:00.000Z' }]);
  });

  it('tick → Chấp nhận mở hộp Sản phẩm mới có ô Nhóm, chưa gửi gì', async () => {
    const f = stub();
    show();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Thêm luôn vào danh mục' }));
    await userEvent.click(screen.getByRole('button', { name: 'Chấp nhận Kệ mica 3 tầng' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sản phẩm mới' });
    expect(within(dialog).getByRole('radiogroup', { name: 'Nhóm' })).toBeInTheDocument();
    expect(reviewPosts(f)).toEqual([]);
  });

  it('Từ chối: lý do 2 chữ → nút khóa, không gửi; 3 chữ → gửi reject kèm lý do', async () => {
    const f = stub();
    const onDone = show();
    await userEvent.click(screen.getByRole('button', { name: 'Từ chối Kệ mica 3 tầng' }));
    const dialog = await screen.findByRole('dialog');
    const box = within(dialog).getByRole('textbox');
    await userEvent.type(box, 'ab');
    const submit = within(dialog).getByRole('button', { name: /^Từ chối/ });
    expect(submit).toBeDisabled();
    await userEvent.type(box, 'c');
    await userEvent.click(submit);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(reviewPosts(f)).toEqual([{ action: 'reject', note: 'abc', expected_updated_at: '2026-11-05T03:00:00.000Z' }]);
  });
});
