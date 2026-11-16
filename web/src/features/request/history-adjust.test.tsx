import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { lineView } from '@/test/fixtures-request';
import { PEN, facts, stubRequestApi, view } from '@/test/request-api-stub';
import type { LineAdjustment, RemovedLine, RequestView } from './request.api';

afterEach(() => {
  vi.unstubAllGlobals();
  void i18n.changeLanguage('vi');
});

const SCRIPT = '<script>alert(1)</script>';
// 02:10Z = 09:10 giờ VN
const adj = (before: number, after: number, at: string, reason_code: LineAdjustment['reason_code'] = 'over_quota', reason_note: string | null = null): LineAdjustment => ({
  before,
  after,
  reason_code,
  reason_note,
  at,
});
const removed = (over: Partial<RemovedLine>): RemovedLine => ({
  name: 'Kéo cắt',
  name_en: 'Scissors',
  unit: 'cai',
  before: 3,
  reason_code: 'duplicate',
  reason_note: null,
  at: '2026-12-13T02:10:00.000Z',
  ...over,
});
const past = (over: Partial<RequestView>) =>
  stubRequestApi({ others: { '2026-10': view({ period_ym: '2026-10', is_open: false, ...over }) } });

describe('Lịch sử — điều chỉnh của Adm D&E', () => {
  it('dòng giảm nhiều lần: "… 5 thành 4 …" rồi "… 4 thành 3 …" theo thời gian, kèm ngày giờ VN', async () => {
    const pen = { ...facts(PEN), unit: 'cai' };
    past({
      lines: [
        lineView({
          id: 'l-1',
          item_id: PEN.id,
          item: pen,
          qty: 3,
          adjustments: [adj(5, 4, '2026-12-13T01:00:00.000Z'), adj(4, 3, '2026-12-13T02:10:00.000Z')],
        }),
      ],
    });
    renderApp(makeMe('member'), '/history/2026-10');
    const box = (await screen.findByRole('heading', { name: 'Điều chỉnh của Adm D&E' })).closest('section')!;
    expect(within(box).getAllByRole('listitem').map((n) => n.textContent)).toEqual([
      `13/12 · 08:00 · ${PEN.name} 5 thành 4 · Lý do: Vượt định mức`,
      `13/12 · 09:10 · ${PEN.name} 4 thành 3 · Lý do: Vượt định mức`,
    ]);
    // Đăng ký lấy số gốc của lần giảm đầu
    expect(within(screen.getByRole('rowheader', { name: PEN.name }).closest('tr')!).getByText('5')).toBeInTheDocument();
  });

  it('dòng bị bỏ: hàng "Không giao" + khối điều chỉnh; ghi chú <script> hiện nguyên chữ, xuống dòng thành dấu cách', async () => {
    past({
      lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })],
      removed_lines: [removed({ reason_code: 'other', reason_note: `${SCRIPT}\ndòng 2` })],
    });
    renderApp(makeMe('member'), '/history/2026-10');
    const row = (await screen.findByRole('rowheader', { name: 'Kéo cắt' })).closest('tr')!;
    expect(within(row).getByText('Không giao')).toBeInTheDocument();
    expect(within(row).getByText(`Adm D&E bỏ món · ${SCRIPT} dòng 2`)).toBeInTheDocument();
    expect(screen.getByText(`13/12 · 09:10 · Kéo cắt 3 thành 0 · Lý do: ${SCRIPT} dòng 2`)).toBeInTheDocument();
    expect(document.querySelector('script:not([src])')).toBeNull();
  });

  it('phiếu bị bỏ toàn bộ: "Adm D&E đã bỏ toàn bộ: <các lý do khác nhau nối \'; \'>"', async () => {
    past({
      lines: [],
      removed_all: true,
      removed_lines: [
        removed({ name: 'Kéo cắt', reason_code: 'duplicate' }),
        removed({ name: 'Bút bi', reason_code: 'over_quota' }),
        removed({ name: 'Ghim', reason_code: 'duplicate' }),
      ],
    });
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByText('Adm D&E đã bỏ toàn bộ: Trùng với phiếu khác; Vượt định mức')).toBeInTheDocument();
    expect(screen.queryByText('Không có phiếu tháng này')).toBeNull();
  });

  it('tiếng Anh: dòng bị bỏ dùng name_en, lý do theo ngôn ngữ', async () => {
    await i18n.changeLanguage('en');
    past({ lines: [], removed_all: false, removed_lines: [removed({})] });
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByRole('rowheader', { name: 'Scissors' })).toBeInTheDocument();
    expect(screen.getByText('D&E Admin removed · Duplicate of another request')).toBeInTheDocument();
    expect(screen.getByText(/Scissors 3 to 0 · Reason: Duplicate of another request/)).toBeInTheDocument();
  });
});
