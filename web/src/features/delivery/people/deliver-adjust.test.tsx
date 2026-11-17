import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { ToastProvider } from '@/ui/toast-provider';
import { putCalls, stubAdjust } from '@/features/summary/adjust-dialog-fixtures';
import { DELIVERY_PEOPLE_KEY, type DeliveryPerson } from './delivery-people.api';
import { DeliverDialog } from './deliver-dialog';
import { person, pLine } from './people-fixtures';

afterEach(() => vi.unstubAllGlobals());

const BEFORE = person({ request_id: 'r-1', lines: [pLine({ line_id: 'l-pen', request_id: 'r-1', qty: 10, delivered_qty: 3, remaining_qty: 7, stock_qty: 20 })] });
const AFTER = person({ request_id: 'r-1', lines: [pLine({ line_id: 'l-pen', request_id: 'r-1', qty: 5, delivered_qty: 3, remaining_qty: 2, stock_qty: 20 })] });

const ui = (p: DeliveryPerson) => (
  <MeContext.Provider value={makeMe('admin')}>
    <MemoryRouter>
      <ToastProvider>
        <ConfirmProvider>
          <DeliverDialog person={p} people={[p]} onDone={vi.fn()} onClose={vi.fn()} onOpenPerson={vi.fn()} />
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>
  </MeContext.Provider>
);
// Danh sách người lấy từ query thật (khóa DELIVERY_PEOPLE_KEY) để lần nạp sau khi lưu đi đúng đường của app
const source = { current: BEFORE };
let client: QueryClient | null = null;
function LivePeople() {
  client = useQueryClient();
  const q = useQuery({ queryKey: [...DELIVERY_PEOPLE_KEY, 'test'], queryFn: () => source.current });
  return q.data ? <DeliverDialog person={q.data} people={[q.data]} onDone={vi.fn()} onClose={vi.fn()} onOpenPerson={vi.fn()} /> : null;
}
const live = () => (
  <MeContext.Provider value={makeMe('admin')}>
    <MemoryRouter>
      <ToastProvider>
        <ConfirmProvider>
          <LivePeople />
        </ConfirmProvider>
      </ToastProvider>
    </MemoryRouter>
  </MeContext.Provider>
);
const deliver = () => screen.getByRole('dialog', { name: 'Giao cho Nguyễn Văn An?' });
// Ô "Còn chờ" của dòng (cột số thứ hai, sau tên món)
const waitingQty = () => within(within(deliver()).getByRole('row', { name: /Bút bi xanh/ })).getAllByRole('cell')[1]!.textContent;

describe('DeliverDialog — "Từ chối / giảm dòng…" (G4)', () => {
  it('mở đúng hộp Điều chỉnh phiếu của phiếu đang giao; hộp Giao ẩn trong lúc đó (không đè lên), đóng Điều chỉnh thì hiện lại', async () => {
    stubAdjust();
    renderWithI18n(ui(BEFORE));
    await userEvent.click(within(deliver()).getByRole('button', { name: 'Từ chối / giảm dòng…' }));
    expect(await screen.findByRole('dialog', { name: 'Điều chỉnh phiếu Nguyễn Văn An' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Giao cho Nguyễn Văn An?' })).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByRole('dialog', { name: 'Giao cho Nguyễn Văn An?' })).toBeInTheDocument();
  });

  it('người chỉ còn nợ tháng trước (không có phiếu tháng đang giao) → không có nút', async () => {
    stubAdjust();
    renderWithI18n(ui(person({ request_id: null, lines: [pLine({ is_debt: true, period_ym: '2026-09' })] })));
    expect(within(deliver()).queryByRole('button', { name: 'Từ chối / giảm dòng…' })).toBeNull();
  });

  it('lưu điều chỉnh xong → hộp Giao lấy lại số còn chờ mới (7 → 2)', async () => {
    const f = stubAdjust();
    source.current = BEFORE;
    renderWithI18n(live());
    await screen.findByRole('dialog', { name: 'Giao cho Nguyễn Văn An?' });
    expect(waitingQty()).toBe('7');
    await userEvent.click(within(deliver()).getByRole('button', { name: 'Từ chối / giảm dòng…' }));
    const adjust = await screen.findByRole('dialog', { name: 'Điều chỉnh phiếu Nguyễn Văn An' });
    await userEvent.click(await within(adjust).findByRole('checkbox', { name: 'Chọn Bút bi xanh' }));
    const reduce = within(adjust).getByRole('spinbutton', { name: 'Giảm còn: Bút bi xanh' });
    await userEvent.clear(reduce);
    await userEvent.type(reduce, '5');
    await userEvent.click(within(within(adjust).getByRole('radiogroup', { name: 'Lý do' })).getByRole('radio', { name: 'Hết hàng' }));
    // server đã giảm: lần nạp lại sau khi lưu trả số mới
    source.current = AFTER;
    await userEvent.click(within(adjust).getByRole('button', { name: /^Lưu 1 thay đổi$/ }));
    await waitFor(() => expect(putCalls(f)).toHaveLength(1));
    await waitFor(() => expect(waitingQty()).toBe('2'));
  });

  it('mở Điều chỉnh rồi hủy, danh sách nạp lại sau đó → hộp Giao giữ số đang hiện (chỉ chụp lại sau khi lưu)', async () => {
    stubAdjust();
    const { rerender } = renderWithI18n(ui(BEFORE));
    await userEvent.click(within(deliver()).getByRole('button', { name: 'Từ chối / giảm dòng…' }));
    await screen.findByRole('dialog', { name: 'Điều chỉnh phiếu Nguyễn Văn An' });
    await userEvent.keyboard('{Escape}');
    await screen.findByRole('dialog', { name: 'Giao cho Nguyễn Văn An?' });
    rerender(ui(AFTER));
    await new Promise((r) => setTimeout(r, 50));
    expect(waitingQty()).toBe('7');
  });

  it('lưu điều chỉnh mà lần nạp lại trả y dữ liệu cũ → lần nạp sau đó (người khác giao) không thay số đang hiện', async () => {
    const f = stubAdjust();
    source.current = BEFORE;
    renderWithI18n(live());
    await screen.findByRole('dialog', { name: 'Giao cho Nguyễn Văn An?' });
    await userEvent.click(within(deliver()).getByRole('button', { name: 'Từ chối / giảm dòng…' }));
    const adjust = await screen.findByRole('dialog', { name: 'Điều chỉnh phiếu Nguyễn Văn An' });
    await userEvent.click(await within(adjust).findByRole('checkbox', { name: 'Chọn Bút bi xanh' }));
    const reduce = within(adjust).getByRole('spinbutton', { name: 'Giảm còn: Bút bi xanh' });
    await userEvent.clear(reduce);
    await userEvent.type(reduce, '5');
    await userEvent.click(within(within(adjust).getByRole('radiogroup', { name: 'Lý do' })).getByRole('radio', { name: 'Hết hàng' }));
    await userEvent.click(within(adjust).getByRole('button', { name: /^Lưu 1 thay đổi$/ }));
    await waitFor(() => expect(putCalls(f)).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Điều chỉnh phiếu Nguyễn Văn An' })).toBeNull());
    await new Promise((r) => setTimeout(r, 50));
    expect(waitingQty()).toBe('7');
    source.current = AFTER;
    await client!.refetchQueries({ queryKey: [...DELIVERY_PEOPLE_KEY, 'test'] });
    await new Promise((r) => setTimeout(r, 50));
    expect(waitingQty()).toBe('7');
  });
});
