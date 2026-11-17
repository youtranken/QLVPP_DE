import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { PERIOD } from '@/test/request-api-stub';
import { MeContext } from '@/lib/me';
import { registrationView } from './registration-fixtures';
import { OrderHistoryDialog } from './order-history-dialog';

afterEach(() => vi.unstubAllGlobals());

const item = (ym: string, qty: number, delivered: number, cancelled = 0) => ({
  period_ym: ym,
  request_id: `rq-${ym}`,
  line_count: 2,
  total_qty: qty,
  delivered_qty: delivered,
  cancelled_qty: cancelled,
  remaining_qty: qty - delivered - cancelled,
  owed_line_count: 0,
  removed_all: false,
  custom: { pending: 0, accepted: 0, converted: 0, rejected: 0 },
  catalog: { line_count: 2, qty, delivered_qty: delivered, remaining_qty: qty - delivered - cancelled, owed_line_count: 0 },
});

function stub() {
  const f = vi.fn(async (url: string) => {
    if (url === '/api/periods/current') return jsonResponse(200, PERIOD);
    const y = /^\/api\/admin\/users\/u-a\/requests\?year=(\d{4})$/.exec(url);
    if (y) return jsonResponse(200, { sub: 'u-a', full_name: 'Nhân viên A', year: Number(y[1]), items: y[1] === '2026' ? [item('2026-10', 6, 6), item('2026-08', 4, 1)] : [item('2025-12', 3, 0)] });
    const r = /^\/api\/admin\/periods\/(\d{4}-\d{2})\/registrations\/(rq-[\d-]+)$/.exec(url);
    if (r) {
      const v = registrationView('q-a');
      const lines = [lineView({ id: 'l1', item_id: 'i-pen', item: { ...v.lines[0]!.item!, name: 'Bút bi xanh' }, qty: 5, adjustments: [{ before: 10, after: 5, reason_code: 'over_quota', reason_note: null, at: '2026-10-12T03:00:00Z' }] })];
      // dòng bị bỏ hẳn không còn trong lines, server trả ở removed_lines
      const removed_lines = [{ name: 'Kẹp giấy', name_en: null, unit: 'hop', before: 2, reason_code: 'adm_out_of_stock', reason_note: null, at: '2026-10-12T03:00:00Z' }];
      return jsonResponse(200, { ...v, id: r[2], period_ym: r[1], lines, removed_lines });
    }
    return jsonResponse(200, {});
  });
  vi.stubGlobal('fetch', f);
  return f;
}

function show() {
  renderWithI18n(
    <MeContext.Provider value={makeMe('admin')}>
      <MemoryRouter>
        <OrderHistoryDialog sub="u-a" name="Nhân viên A" onClose={() => {}} />
      </MemoryRouter>
    </MeContext.Provider>,
  );
}

describe('OrderHistoryDialog — lịch sử đặt hàng một nhân viên (G3)', () => {
  it('tab chọn sẵn kỳ mới nhất có phiếu (T10); chấm theo trạng thái: T10 đã nhận đủ, T8 đã giao một phần, T9 không đặt', async () => {
    stub();
    show();
    const dialog = await screen.findByRole('dialog', { name: 'Lịch sử đặt hàng · Nhân viên A' });
    const tabs = await within(dialog).findByRole('tablist', { name: 'Tháng trong năm 2026' });
    await waitFor(() => expect(within(tabs).getByRole('tab', { name: /^T10/ })).toHaveAttribute('aria-selected', 'true'));
    expect(within(tabs).getByRole('tab', { name: 'T10, Đã nhận đủ' })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: 'T8, Đã giao 1/4' })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: 'T9, Không đặt' })).toBeInTheDocument();
    expect(await within(dialog).findByText('Bút bi xanh')).toBeInTheDocument();
    expect(within(dialog).getByText('Adm D&E giảm 10 → 5 · Số lượng quá nhiều')).toBeInTheDocument();
    const lines = within(dialog).getByRole('list', { name: /món/i });
    const removed = within(lines).getByText('Kẹp giấy').closest('li')!;
    expect(removed).toHaveTextContent(/0 hộp/);
    expect(within(removed as HTMLElement).getByText(/^Adm D&E bỏ khỏi phiếu · /)).toBeInTheDocument();
  });

  it('bấm tháng không đặt → "Không đặt tháng này", không gọi phiếu', async () => {
    const f = stub();
    show();
    const dialog = await screen.findByRole('dialog', { name: 'Lịch sử đặt hàng · Nhân viên A' });
    await userEvent.click(await within(dialog).findByRole('tab', { name: 'T9, Không đặt' }));
    expect(within(dialog).getByText('Không đặt tháng này')).toBeInTheDocument();
    expect(f.mock.calls.some(([u]) => String(u).includes('registrations/rq-2026-09'))).toBe(false);
  });

  it('‹ lùi năm → gọi year=2025 và chọn T12; › về năm hiện tại, không tiến quá năm của kỳ đang mở', async () => {
    const f = stub();
    show();
    const dialog = await screen.findByRole('dialog', { name: 'Lịch sử đặt hàng · Nhân viên A' });
    expect(await within(dialog).findByRole('button', { name: 'Năm sau' })).toBeDisabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Năm trước' }));
    await waitFor(() => expect(f.mock.calls.some(([u]) => u === '/api/admin/users/u-a/requests?year=2025')).toBe(true));
    await waitFor(() => expect(within(dialog).getByRole('tab', { name: /^T12/ })).toHaveAttribute('aria-selected', 'true'));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Năm sau' }));
    expect(await within(dialog).findByRole('tablist', { name: 'Tháng trong năm 2026' })).toBeInTheDocument();
  });
});
