import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { CATEGORIES } from './catalog-fixtures';
import { indexCategories } from './catalog-rows';
import { CatalogFilterBar } from './catalog-filter-bar';

type Props = Parameters<typeof CatalogFilterBar>[0];
const index = indexCategories(CATEGORIES);
const bulk = (count: number): NonNullable<Props['bulk']> => ({
  count,
  pending: false,
  scope: { pause: count, resume: 0, locked: 0 },
  onReactivate: vi.fn(),
  onMax: vi.fn(),
  onMove: vi.fn(),
  onPause: vi.fn(),
  onClear: vi.fn(),
});

function show(over: Partial<Props> = {}) {
  const onToggle = vi.fn();
  renderWithI18n(
    <CatalogFilterBar
      q=""
      onSearch={vi.fn()}
      searchable={66}
      mode="table"
      onMode={vi.fn()}
      tab="all"
      tabCounts={{ all: 66, active: 65, inactive: 1, noImage: 8 }}
      onTab={vi.fn()}
      index={index}
      counts={new Map([['c-pen', 15], ['c-paper', 3]])}
      total={66}
      group={null}
      onGroup={vi.fn()}
      collapse={{ all: false, onToggle }}
      bulk={bulk(0)}
      {...over}
    />,
  );
  return { onToggle };
}

const css = () => readFileSync(resolve(process.cwd(), 'src/features/catalog/catalog-filter.m1.css'), 'utf8');
const rule = (selector: string) => css().split('\n').find((l) => l.startsWith(`[data-shell='admin'] ${selector} {`)) ?? '';

describe('Thanh lọc Sản phẩm (góp ý vòng 2, ảnh 6)', () => {
  it('đang tải (chưa có số): ô tìm ghi "Tìm sản phẩm", không "Tìm trong 0 sản phẩm" (rà soát 13/11 #6)', () => {
    show({ searchable: 0, total: 0, tabCounts: null });
    const search = screen.getByRole('searchbox', { name: 'Tìm sản phẩm' });
    expect(search).toHaveAttribute('placeholder', 'Tìm sản phẩm');
    expect(screen.queryByPlaceholderText(/\b0\b/)).toBeNull();
  });

  it('hàng 1: ô tìm → trạng thái (Tất cả/Đang dùng/Tạm ngưng/Chưa có ảnh kèm số); Lưới/Bảng tách xuống cuối hàng chip nhóm cho khỏi lẫn với tab trạng thái', () => {
    show();
    const search = screen.getByRole('searchbox', { name: 'Tìm trong 66 sản phẩm' });
    const status = screen.getByRole('group', { name: 'Trạng thái' });
    const view = screen.getByRole('group', { name: 'Chế độ xem' });
    const row = search.closest('.ct-filter__main');
    expect(row).not.toBeNull();
    expect(row!.contains(status)).toBe(true);
    expect(row!.contains(view)).toBe(false);
    expect(view.closest('.ct-filter__groups')).not.toBeNull();
    const chips = screen.getByRole('group', { name: 'Lọc theo nhóm' });
    expect(chips.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(search.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(status).getAllByRole('button').map((b) => b.textContent)).toEqual(['Tất cả 66', 'Đang dùng 65', 'Tạm ngưng 1', 'Chưa có ảnh 8']);
  });

  it('hàng 2: chip nhóm rồi "Thu tất cả" ở cuối hàng, là nút chữ nhỏ; bấm gọi onToggle', async () => {
    const { onToggle } = show();
    const chips = screen.getByRole('group', { name: 'Lọc theo nhóm' });
    const collapse = screen.getByRole('button', { name: 'Thu tất cả' });
    const row = chips.closest('.ct-filter__groups');
    expect(row).not.toBeNull();
    expect(row!.contains(collapse)).toBe(true);
    expect(row!.contains(screen.getByRole('group', { name: 'Trạng thái' }))).toBe(false);
    expect(chips.compareDocumentPosition(collapse) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(collapse).toHaveClass('btn--ghost', 'btn--sm');
    await userEvent.click(collapse);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('thanh hàng loạt chỉ hiện khi có chọn và nằm hàng riêng (không chung hàng 1 hay hàng chip)', () => {
    show({ bulk: bulk(2) });
    const bar = screen.getByRole('toolbar', { name: 'Hành động trên các dòng đã chọn' });
    expect(bar.closest('.ct-filter__main, .ct-filter__groups')).toBeNull();
    expect(bar.parentElement).toHaveClass('ct-filter__bulk');
  });

  it('không chọn gì → không có hàng thao tác hàng loạt', () => {
    show();
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(document.querySelector('.ct-filter__bulk')).toBeNull();
  });

  it('CSS: hàng 1 cao 40px đồng đều (ô tìm, rãnh trạng thái, Lưới/Bảng); chip nhóm nhỏ hơn, một dòng cuộn ngang, không wrap', () => {
    expect(rule('.ct-filter__main .flt-search input')).toContain('height: 40px');
    expect(rule('.ct-seg')).toContain('height: 40px');
    expect(rule('.ct-gchip')).toContain('height: 32px');
    expect(rule('.ct-gchips')).toContain('flex-wrap: nowrap');
    expect(rule('.ct-gchips-scroll')).toContain('overflow-x: auto');
    expect(css()).not.toMatch(/\.ct-gchips[^{]*\{[^}]*flex-wrap: wrap/);
  });

  it('CSS: Tất cả/Đang dùng và chip nhóm đang chọn cùng một kiểu B (nền xanh nhạt, TC-03)', () => {
    expect(rule(".ct-seg__opt[aria-pressed='true']")).toContain('background: var(--c-acc-soft)');
    expect(rule(".ct-gchip[aria-pressed='true']")).toContain('background: var(--c-acc-soft)');
  });
});
