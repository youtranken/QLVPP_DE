import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n as render, screen } from '@/test/test-utils';
import { StockFilterTabs } from '@/features/stock/stock-filter-tabs';
import { AuditQuick } from '@/features/admin/audit-quick';
import { MonthChips } from '@/features/month/month-chips-bar';
import { GroupChips } from './group-chips';
import { fadeEdges } from './use-scroll-fade';

// Rà soát 13/11 Gu #11: hàng chip/tab cuộn ngang ở 360/390 (Kỳ tháng, Nhận hàng, Tủ/Kho, Món ngoài danh mục,
// Sản phẩm, chip nhanh Nhật ký) cắt thẳng qua chữ, không có dấu còn mục khuất.

const box = (scrollWidth: number, clientWidth: number, scrollLeft: number) => ({ scrollWidth, clientWidth, scrollLeft }) as HTMLElement;

describe('fadeEdges', () => {
  it('không cuộn được → null; đầu hàng → end; giữa → start end; cuối → start', () => {
    expect(fadeEdges(box(300, 300, 0))).toBeNull();
    expect(fadeEdges(box(301, 300, 0))).toBeNull();
    expect(fadeEdges(box(500, 300, 0))).toBe('end');
    expect(fadeEdges(box(500, 300, 100))).toBe('start end');
    expect(fadeEdges(box(500, 300, 200))).toBe('start');
  });
});

describe('các hàng chip dùng chung mờ mép', () => {
  // jsdom không dàn trang: giả lập khung hẹp hơn nội dung (360px)
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(560);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(328);
  });
  afterEach(() => vi.restoreAllMocks());

  it('Tủ/Kho: chip lọc có data-fade="end" khi còn chip khuất bên phải', () => {
    render(<StockFilterTabs stats={{ all: 5, incoming: 1, low: 2, none: 0 } as never} filter={null} onFilter={() => {}} onClear={() => {}} />);
    expect(screen.getByRole('group')).toHaveAttribute('data-fade', 'end');
  });

  it('Nhật ký: chip nhanh', () => {
    render(<AuditQuick now={new Date('2026-11-13T03:00:00Z')} applied={{ actor: '', action: '', from: '', to: '' }} onPatch={() => {}} />);
    expect(screen.getByRole('group')).toHaveAttribute('data-fade', 'end');
  });

  it('Kỳ tháng: chip trạng thái', () => {
    render(<MonthChips rows={[]} chip="all" q="" onChip={() => {}} onQ={() => {}} />);
    expect(screen.getAllByRole('group').find((g) => g.className.includes('flt-chips'))).toHaveAttribute('data-fade', 'end');
  });

  it('Nhận hàng: GroupChips fade (tự là khung cuộn); không bật thì không đụng', () => {
    const props = { groups: [{ id: 'g1', label: 'Bút' }], counts: new Map([['g1', 1]]), value: 'all', onChange: () => {}, allLabel: 'Tất cả', total: 1 };
    render(
      <>
        <GroupChips {...props} label="A" fade />
        <GroupChips {...props} label="B" />
      </>,
    );
    expect(screen.getByRole('group', { name: 'A' })).toHaveAttribute('data-fade', 'end');
    expect(screen.getByRole('group', { name: 'B' })).not.toHaveAttribute('data-fade');
  });

  it('Món ngoài danh mục: hàng tab là ScrollFade', () => {
    expect(readFileSync(resolve(process.cwd(), 'src/features/review/review-page.tsx'), 'utf8')).toMatch(/<ScrollFade className="toolbar rv-tabs">/);
  });
});

describe('CSS mờ mép: một chỗ chung', () => {
  const SRC = resolve(process.cwd(), 'src');
  const files = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? files(join(d, n)) : n.endsWith('.css') ? [join(d, n)] : []));

  it('luật [data-fade] ở css/m1/filter.css, mỗi mép độc lập, bỏ mờ khi có mục focus phím', () => {
    const css = readFileSync(join(SRC, 'css/m1/filter.css'), 'utf8');
    expect(css).toMatch(/\[data-shell\] \[data-fade\]\s*\{[^}]*mask-image:\s*linear-gradient\(to right, transparent, #000 var\(--fade-s\), #000 calc\(100% - var\(--fade-e\)\), transparent\)/);
    expect(css).toMatch(/\[data-fade~='start'\]\s*\{\s*--fade-s:\s*32px/);
    expect(css).toMatch(/\[data-fade~='end'\]\s*\{\s*--fade-e:\s*32px/);
    expect(css).toMatch(/\[data-fade\]:has\(:focus-visible\)\s*\{[^}]*mask-image:\s*none/);
  });

  it('không file CSS nào khác tự mờ mép hàng cuộn (data-more cũ đã bỏ)', () => {
    const others = files(SRC)
      .filter((f) => !f.endsWith(join('css', 'm1', 'filter.css')))
      .filter((f) => /mask-image:\s*linear-gradient|\[data-more\]/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f));
    expect(others).toEqual([]);
  });
});
