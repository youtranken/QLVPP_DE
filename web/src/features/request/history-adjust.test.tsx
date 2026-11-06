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

describe('Lịch sử — điều chỉnh của Hành chính', () => {
  it('dòng giảm nhiều lần: "Hành chính giảm 5 → 4 …" rồi "4 → 3 …" theo thời gian, kèm giờ VN', async () => {
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
    const notes = await screen.findAllByText(/^Hành chính giảm/);
    expect(notes.map((n) => n.textContent)).toEqual([
      'Hành chính giảm 5 → 4 cái: Vượt định mức · 08:00 13/12',
      'Hành chính giảm 4 → 3 cái: Vượt định mức · 09:10 13/12',
    ]);
  });

  it('dòng bị bỏ: tên + "Hành chính bỏ món này khỏi phiếu (3 cái): …"; ghi chú <script> hiện nguyên chữ, xuống dòng thành dấu cách', async () => {
    past({
      lines: [lineView({ id: 'l-1', item_id: PEN.id, item: facts(PEN), qty: 2 })],
      removed_lines: [removed({ reason_code: 'other', reason_note: `${SCRIPT}\ndòng 2` })],
    });
    renderApp(makeMe('member'), '/history/2026-10');
    const text = await screen.findByText(/^Hành chính bỏ món này khỏi phiếu/);
    expect(text).toHaveTextContent(`Hành chính bỏ món này khỏi phiếu (3 cái): ${SCRIPT} dòng 2`);
    expect(within(text.closest('li')!).getByText('Kéo cắt')).toBeInTheDocument();
    expect(document.querySelector('script:not([src])')).toBeNull();
  });

  it('phiếu bị bỏ toàn bộ: "Hành chính đã bỏ toàn bộ: <các lý do khác nhau nối \'; \'>"', async () => {
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
    expect(await screen.findByText('Hành chính đã bỏ toàn bộ: Trùng với phiếu khác; Vượt định mức')).toBeInTheDocument();
    expect(screen.queryByText('Không có phiếu tháng này')).toBeNull();
  });

  it('tiếng Anh: dòng bị bỏ dùng name_en, lý do theo ngôn ngữ', async () => {
    await i18n.changeLanguage('en');
    past({ lines: [], removed_all: false, removed_lines: [removed({})] });
    renderApp(makeMe('member'), '/history/2026-10');
    expect(await screen.findByText('Admin removed this item (3 piece): Duplicate of another request')).toBeInTheDocument();
    expect(screen.getByText('Scissors')).toBeInTheDocument();
  });
});
