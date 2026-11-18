import { describe, expect, it } from 'vitest';
import { QUICK_GROUP_MAX, QUICK_MIN_CHARS, QUICK_PERIOD_BACK, periodEntries, quickSearchIndex, type QuickEntry, type QuickSources } from '@/shell/quick-search-index';

const entry = (id: string, label: string, extra: Partial<QuickEntry> = {}): QuickEntry => ({ id, label, terms: [label], to: `/x/${id}`, ...extra });

const pens = (n: number) => Array.from({ length: n }, (_, i) => entry(`pen-${i + 1}`, `Bút bi số ${i + 1}`));

const sources = (over: Partial<QuickSources> = {}): QuickSources => ({
  items: [entry('i1', 'Bút bi Thiên Long 027', { terms: ['Bút bi Thiên Long 027', 'Ballpoint pen', 'BB027'] }), entry('i2', 'Giấy A4')],
  people: [entry('u1', 'Bùi Văn Tâm', { terms: ['Bùi Văn Tâm', 'tam.bv@pmh.vn'] }), entry('u2', 'Trúc Uyên')],
  pages: [entry('stock', 'Tủ / Kho'), entry('users', 'Danh bạ')],
  periods: [],
  shortcuts: [],
  ...over,
});

const keys = (q: string, s = sources()) => quickSearchIndex(q, s).map((g) => g.key);
const ids = (q: string, s = sources()) => quickSearchIndex(q, s).flatMap((g) => g.entries.map((e) => e.id));

describe('quickSearchIndex (TC-17)', () => {
  it('tìm không dấu: "but bi" khớp "Bút bi Thiên Long 027"', () => {
    expect(ids('but bi')).toEqual(['i1']);
  });

  it('khớp cả tên tiếng Anh, mã món và email người', () => {
    expect(ids('ballpoint')).toEqual(['i1']);
    expect(ids('bb027')).toEqual(['i1']);
    expect(ids('tam.bv')).toEqual(['u1']);
  });

  it('nhóm theo thứ tự MÓN → NGƯỜI → ĐI TỚI, nhóm rỗng không hiện', () => {
    const s = sources({ people: [entry('u9', 'Kho Thị Mai')], pages: [entry('stock', 'Tủ / Kho')] });
    expect(keys('kho', s)).toEqual(['people', 'pages']);
    expect(keys('bu', sources({ pages: [entry('p', 'Bù hàng')] }))).toEqual(['items', 'people', 'pages']);
  });

  it('biên độ dài: 1 ký tự không tìm, 2 ký tự có tìm', () => {
    expect(QUICK_MIN_CHARS).toBe(2);
    expect(quickSearchIndex('b', sources())).toEqual([]);
    expect(quickSearchIndex(' b ', sources())).toEqual([]);
    expect(ids('bu')).toContain('i1');
  });

  it('biên số mục: 5 món khớp hiện đủ 5, 6 món khớp chỉ hiện 5 đầu', () => {
    expect(QUICK_GROUP_MAX).toBe(5);
    expect(ids('but bi', sources({ items: pens(5) }))).toEqual(['pen-1', 'pen-2', 'pen-3', 'pen-4', 'pen-5']);
    expect(ids('but bi', sources({ items: pens(6) }))).toEqual(['pen-1', 'pen-2', 'pen-3', 'pen-4', 'pen-5']);
  });

  it('nhóm NGƯỜI và ĐI TỚI cũng cắt ở 5', () => {
    const people = Array.from({ length: 6 }, (_, i) => entry(`u${i}`, `Nguyễn An ${i}`));
    const pages = Array.from({ length: 6 }, (_, i) => entry(`p${i}`, `Trang An ${i}`));
    const groups = quickSearchIndex('an', sources({ items: [], people, pages }));
    expect(groups.map((g) => g.entries.length)).toEqual([5, 5]);
  });

  it('lối tắt lọc chỉ hiện khi nhóm nó dựa vào có kết quả, mang chữ đang gõ', () => {
    const s = sources({
      pages: [],
      shortcuts: [{ when: 'items', make: (q) => entry('stock-filter', `Tủ / Kho › lọc "${q}"`, { to: `/admin/stock?q=${q}` }) }],
    });
    const goTo = quickSearchIndex('but bi', s).find((g) => g.key === 'pages');
    expect(goTo?.entries).toEqual([expect.objectContaining({ id: 'stock-filter', label: 'Tủ / Kho › lọc "but bi"', to: '/admin/stock?q=but bi' })]);
    expect(keys('giay xanh', s)).toEqual([]);
  });

  it('kỳ: kỳ đang mở và đúng 12 tháng trước (13 kỳ), mới nhất trước, mục → /admin/month?ym=YYYY-MM', () => {
    expect(QUICK_PERIOD_BACK).toBe(12);
    const list = periodEntries('2026-11', (m, y) => `Kỳ tháng ${m}/${y}`);
    expect(list).toHaveLength(13);
    expect(list[0]).toMatchObject({ label: 'Kỳ tháng 11/2026', to: '/admin/month?ym=2026-11' });
    expect(list[12]).toMatchObject({ label: 'Kỳ tháng 11/2025', to: '/admin/month?ym=2025-11' });
    expect(list.map((e) => e.to)).not.toContain('/admin/month?ym=2025-10');
  });

  it('kỳ: tìm không dấu "thang 11", "11/2026", "2026-11" đều ra Kỳ tháng 11/2026 trong nhóm KỲ', () => {
    const s = sources({ items: [], people: [], pages: [], periods: periodEntries('2026-11', (m, y) => `Kỳ tháng ${m}/${y}`) });
    for (const q of ['thang 11', '11/2026', '2026-11', 'Tháng 11/2026']) {
      const g = quickSearchIndex(q, s).find((x) => x.key === 'periods');
      expect(g?.entries[0], q).toMatchObject({ label: 'Kỳ tháng 11/2026', to: '/admin/month?ym=2026-11' });
    }
    expect(ids('11/2026', s)).toEqual(['period-2026-11']);
    expect(ids('2026-10', s)).toEqual(['period-2026-10']);
  });

  it('kỳ: nhóm KỲ nằm giữa NGƯỜI và ĐI TỚI, cắt ở 5 kỳ mới nhất', () => {
    const s = sources({ people: [entry('u', 'Kỳ Duyên 2026')], pages: [entry('p', 'Báo cáo 2026')], periods: periodEntries('2026-11', (m, y) => `Period ${m}/${y}`) });
    expect(keys('2026', s)).toEqual(['people', 'periods', 'pages']);
    expect(quickSearchIndex('2026', s).find((g) => g.key === 'periods')?.entries.map((e) => e.label)).toEqual([
      'Period 11/2026',
      'Period 10/2026',
      'Period 9/2026',
      'Period 8/2026',
      'Period 7/2026',
    ]);
  });
});
