import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { MeContext } from '@/lib/me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import { adminItem, CATEGORIES, PEN } from './catalog-fixtures';
import { indexCategories, toRows } from './catalog-rows';
import { ItemActiveButton } from './item-active-button';

const UNITS = [{ code: 'cay', name: 'cây', name_en: 'pcs', sort_order: 1, active: true }];
const rowOf = (item: typeof PEN) => toRows([item], indexCategories(CATEGORIES))[0];

function stub(reply: (url: string, init: RequestInit) => Response | undefined = () => undefined) {
  const f = vi.fn(async (url: string, init: RequestInit = {}) => reply(url, init) ?? (url === '/api/units' ? jsonResponse(200, UNITS) : jsonResponse(200, {})));
  vi.stubGlobal('fetch', f);
  return f;
}
const patches = (f: ReturnType<typeof stub>) => f.mock.calls.filter((c) => (c[1] as RequestInit | undefined)?.method === 'PATCH');
const bodies = (f: ReturnType<typeof stub>) => patches(f).map((c) => JSON.parse(String((c[1] as RequestInit).body)) as unknown);

function renderButton(item = PEN, groupActive = true) {
  renderWithI18n(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MeContext.Provider value={makeMe('admin')}>
        <MemoryRouter>
          <ToastProvider>
            <ConfirmProvider>
              <ItemActiveButton row={rowOf(item)} name={item.name} groupActive={groupActive} />
            </ConfirmProvider>
          </ToastProvider>
        </MemoryRouter>
      </MeContext.Provider>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

// Nút Tạm ngưng / Dùng lại còn ở dòng bảng Sản phẩm (thẻ lưới đã bỏ)
describe('Tạm ngưng / Dùng lại ở dòng bảng', () => {
  it('món đang dùng: "Tạm ngưng" viền đỏ (btn--danger-line, không đỏ đặc); bấm → hỏi "Tạm ngưng Bút bi xanh?" → xác nhận → PATCH {active:false} → toast thường, không "Hoàn tác"', async () => {
    const f = stub();
    renderButton(PEN);
    const stop = screen.getByRole('button', { name: 'Tạm ngưng Bút bi xanh' });
    expect(stop).toHaveTextContent('Tạm ngưng');
    expect(stop).toHaveClass('btn--danger-line');
    expect(stop).not.toHaveClass('btn--danger');
    await userEvent.click(stop);
    const ask = await screen.findByRole('dialog', { name: 'Tạm ngưng Bút bi xanh?' });
    expect(within(ask).getByText('Nhân viên vẫn thấy món nhưng không đặt thêm được. Phiếu đã lưu giữ nguyên.')).toBeInTheDocument();
    expect(patches(f)).toHaveLength(0);
    await userEvent.click(within(ask).getByRole('button', { name: 'Tạm ngưng' }));
    await waitFor(() => expect(bodies(f)).toEqual([{ active: false }]));
    expect(await screen.findByText('Đã tạm ngưng Bút bi xanh')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hoàn tác' })).toBeNull();
  });

  it('món tạm ngưng riêng: "Dùng lại" → hỏi "Dùng lại Bút bi xanh?"; Hủy không gửi; xác nhận → PATCH {active:true} + toast', async () => {
    const f = stub();
    renderButton(adminItem({ ...PEN, active: false, usable: false, inactive_reason: 'item' }));
    const back = screen.getByRole('button', { name: 'Dùng lại Bút bi xanh' });
    expect(back).toHaveTextContent('Dùng lại');
    expect(back).not.toHaveClass('btn--danger-line');
    await userEvent.click(back);
    let ask = await screen.findByRole('dialog', { name: 'Dùng lại Bút bi xanh?' });
    expect(within(ask).getByText('Nhân viên đặt được món này trở lại từ kỳ đang mở.')).toBeInTheDocument();
    await userEvent.click(within(ask).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(patches(f)).toHaveLength(0);
    await userEvent.click(back);
    ask = await screen.findByRole('dialog', { name: 'Dùng lại Bút bi xanh?' });
    await userEvent.click(within(ask).getByRole('button', { name: 'Dùng lại' }));
    await waitFor(() => expect(bodies(f)).toEqual([{ active: true }]));
    expect(await screen.findByText('Đã dùng lại Bút bi xanh')).toBeInTheDocument();
  });

  it('món trong nhóm tạm ngưng: "Dùng lại" vô hiệu kèm gợi ý hiện rõ "Bật lại nhóm để đổi từng món"', () => {
    stub();
    renderButton(adminItem({ ...PEN, category_id: 'c-old', usable: false, inactive_reason: 'group' }), false);
    const btn = screen.getByRole('button', { name: 'Dùng lại Bút bi xanh' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription('Bật lại nhóm để đổi từng món');
    expect(screen.getByText('Bật lại nhóm để đổi từng món')).not.toHaveClass('sr-only');
  });

  it('W24: còn hàng NCC đang về → hỏi kèm khối cam; Hủy → không PATCH', async () => {
    const f = stub((url) => (url.endsWith('/pending-arrival') ? jsonResponse(200, { remaining: 3, unit: 'cay', snapshot_at: '2026-11-03T02:15:00.000Z' }) : undefined));
    renderButton(PEN);
    await userEvent.click(screen.getByRole('button', { name: 'Tạm ngưng Bút bi xanh' }));
    const ask = await screen.findByRole('dialog', { name: 'Tạm ngưng Bút bi xanh?' });
    expect(within(ask).getByRole('note')).toHaveTextContent(/đang chờ NCC giao 3/);
    await userEvent.click(within(ask).getByRole('button', { name: 'Hủy' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Tạm ngưng Bút bi xanh?' })).toBeNull());
    expect(patches(f)).toHaveLength(0);
  });

  it('lỗi tải hàng đang về → vẫn hỏi (hộp thường, không khối cam); Tạm ngưng → PATCH', async () => {
    const f = stub((url) => (url.endsWith('/pending-arrival') ? jsonResponse(500, { code: 'X' }) : undefined));
    renderButton(PEN);
    await userEvent.click(screen.getByRole('button', { name: 'Tạm ngưng Bút bi xanh' }));
    const ask = await screen.findByRole('dialog', { name: 'Tạm ngưng Bút bi xanh?' });
    expect(within(ask).queryByRole('note')).toBeNull();
    await userEvent.click(within(ask).getByRole('button', { name: 'Tạm ngưng' }));
    await waitFor(() => expect(bodies(f)).toEqual([{ active: false }]));
  });
});
