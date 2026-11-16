import { MemoryRouter } from 'react-router-dom';
import { navigateTo } from '@/lib/navigate';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ToastProvider } from '@/ui/toast-provider';
import { BulkDeliverDialog } from './bulk-deliver-dialog';
import { bulkPlan } from './bulk-plan';
import { A, B, PEOPLE } from './people-fixtures';

// 401 → tự đăng nhập lại (rời SPA): jsdom không điều hướng được tài liệu khác, thay bằng mock để kiểm lời gọi
vi.mock('@/lib/navigate', () => ({ navigateTo: vi.fn() }));

const URL = '/api/admin/deliveries/bulk';
const plan = bulkPlan([A, B], PEOPLE);

// Trả lời chậm một nhịp: hai cú bấm sát nhau đều rơi vào lúc yêu cầu đầu còn bay
function stub(reply: (body: unknown) => Response) {
  const f = vi.fn((url: string, init?: RequestInit) =>
    String(url) === URL ? new Promise<Response>((r) => setTimeout(() => r(reply(JSON.parse(String(init?.body)))), 30)) : Promise.resolve(jsonResponse(200, {})),
  );
  vi.stubGlobal('fetch', f);
  return f;
}
const posts = (f: ReturnType<typeof stub>) => f.mock.calls.filter(([u]) => String(u) === URL);

function open() {
  const props = { onClose: vi.fn(), onDone: vi.fn() };
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <ToastProvider>
          <BulkDeliverDialog plan={plan} people={PEOPLE} {...props} />
        </ToastProvider>
      </MemoryRouter>
    </MeContext.Provider>,
  );
  return props;
}
const allOk = (body: unknown) => jsonResponse(200, { results: (body as { requests: { request_id: string }[] }).requests.map((r) => ({ request_id: r.request_id, ok: true, delivered_units: 1, request_complete: false })) });

afterEach(() => vi.unstubAllGlobals());

describe('BulkDeliverDialog', () => {
  it('liệt kê từng người, chưa gửi gì khi mở; Quay lại gọi onClose', async () => {
    const f = stub(allOk);
    const props = open();
    const dlg = await screen.findByRole('dialog', { name: 'Giao 2 phiếu?' });
    expect(within(dlg).getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(within(dlg).getByText('Phần thiếu 6 chờ hàng về')).toBeInTheDocument();
    expect(posts(f)).toHaveLength(0);
    await userEvent.click(within(dlg).getAllByRole('button', { name: 'Đóng' }).at(-1)!);
    expect(props.onClose).toHaveBeenCalled();
  });

  it('Xác nhận → một POST, toast, onDone; bấm đúp chỉ một POST', async () => {
    const f = stub(allOk);
    const props = open();
    await userEvent.dblClick(await screen.findByRole('button', { name: 'Xác nhận giao' }));
    await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
    expect(posts(f)).toHaveLength(1);
    expect(await screen.findByText('Đã giao 2 phiếu')).toBeInTheDocument();
  });

  it('có phiếu lỗi → chế độ kết quả; Đóng gọi onDone (bỏ chọn) chứ không phải onClose', async () => {
    stub(() =>
      jsonResponse(200, {
        results: [
          { request_id: 'r-a', ok: true, delivered_units: 3, request_complete: true },
          { request_id: 'r-b0', ok: false, code: 'STOCK_INSUFFICIENT', available: 1 },
          { request_id: 'r-b', ok: false, code: 'STALE_UPDATE' },
        ],
      }),
    );
    const props = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận giao' }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('Phiếu vừa đổi — tải lại');
    expect(props.onDone).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    expect(props.onDone).toHaveBeenCalledTimes(1);
    expect(props.onClose).not.toHaveBeenCalled();
  });

  it('401 → "Phiên đăng nhập đã hết", hộp ở lại', async () => {
    stub(() => jsonResponse(401, { code: 'UNAUTHENTICATED' }));
    const props = open();
    await userEvent.click(await screen.findByRole('button', { name: 'Xác nhận giao' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Phiên đăng nhập đã hết');
    expect(props.onDone).not.toHaveBeenCalled();
    expect(navigateTo).toHaveBeenCalledTimes(1);
  });
});
