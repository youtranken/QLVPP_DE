import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, within } from '@/test/test-utils';
import { renderApp } from '@/test/render-app';
import { makeMe } from '@/test/fixtures-me';
import { mockViewport } from '@/test/viewport';
import { AN, BINH, CHI, openUsers, stubUsers } from '@/features/directory/users-fixtures';
import { openAudit, stubApi as stubAudit } from '@/features/admin/audit-test-fixtures';
import { STOCK, stubStockApi } from '@/features/stock/stock-fixtures';

// TC-16: ≤ 680 px mỗi dòng Danh bạ / Nhật ký / Tủ/Kho là một thẻ "nhãn · giá trị", dòng cần chú ý vẫn có vạch trái
const css = readFileSync(resolve(process.cwd(), 'src/css/m1/table.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const mediaBlock = (query: string) => {
  const at = css.indexOf(`@media ${query} {`);
  if (at < 0) return '';
  let depth = 0;
  for (let i = css.indexOf('{', at); i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(at, i + 1);
  }
  return '';
};
const cards = mediaBlock('(max-width: 680px)');
const rule = (sel: string) => [...cards.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].split(',').some((s) => s.trim() === sel))?.[2] ?? '';
const S = "[data-shell='admin'] ";

afterEach(() => vi.unstubAllGlobals());

describe('khuôn thẻ ≤ 680 px (TC-16)', () => {
  it('mốc 680: khối @media (max-width: 680px) có .table--cards; 681 trở lên vẫn là bảng xếp chồng cũ (≤ 767)', () => {
    expect(cards).toContain('.table--cards');
    expect(css).not.toMatch(/@media \(max-width: 681px\)/);
  });

  it('mỗi dòng là thẻ trắng viền mảnh bo --r-md, lưới hai cột nhãn | giá trị, cách nhau', () => {
    const b = rule(`${S}.table--cards tbody tr:not(.dt-group):not(.dt-expanded)`);
    expect(b).toMatch(/display:\s*grid/);
    expect(b).toMatch(/grid-template-columns:\s*max-content minmax\(0, 1fr\)/);
    expect(b).toMatch(/background:\s*var\(--c-surface\)/);
    expect(b).toMatch(/border-radius:\s*var\(--r-md\)/);
    expect(b).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--c-line\)/);
    expect(b).toMatch(/margin-bottom:\s*var\(--s-/);
  });

  it('nhãn đọc từ data-label, đứng cột trái', () => {
    expect(rule(`${S}.table--cards td[data-label]:not([data-label=''])::before`)).toMatch(/content:\s*attr\(data-label\)/);
  });

  it('khung bảng không cuộn ngang, không nền/bóng riêng (thẻ tự có viền)', () => {
    const b = rule(`${S}.table-wrap:has(> .table--cards)`);
    expect(b).toMatch(/overflow:\s*visible/);
    expect(b).toMatch(/box-shadow:\s*none/);
  });

  it.each([
    ['warn', '--c-warn-fill', '--c-warn-soft'],
    ['danger', '--c-danger', '--c-danger-tint'],
  ])('dòng .row--attn-%s: vạch trái 3px trên cả thẻ + nền nhạt', (tone, bar, bg) => {
    const b = rule(`${S}.table--cards tbody tr.row--attn-${tone}`);
    expect(b).toMatch(new RegExp(`box-shadow:\\s*inset 3px 0 0 var\\(${bar}\\)`));
    expect(b).toMatch(new RegExp(`background:\\s*var\\(${bg}\\)`));
  });
});

const tableEl = () => screen.getAllByRole('table')[0];
const bodyRows = () => within(tableEl()).getAllByRole('row').filter((r) => r.closest('tbody') && !r.classList.contains('dt-group') && !r.classList.contains('dt-expanded'));
// Ô đầu là tên dòng (không nhãn); ô chỉ có icon (thao tác, mũi tên mở) để nhãn rỗng; ô có chữ phải có nhãn
const unlabeled = () =>
  bodyRows().flatMap((r) =>
    within(r)
      .getAllByRole('cell')
      .slice(1)
      .filter((c) => !c.getAttribute('data-label') && (c.textContent ?? '').trim() !== '')
      .map((c) => c.outerHTML.slice(0, 80)),
  );

describe('bảng dùng khuôn thẻ (TC-16)', () => {
  it('Danh bạ: bảng là table--cards, mỗi ô giá trị có nhãn', async () => {
    stubUsers([AN, BINH, CHI]);
    await openUsers();
    expect(tableEl()).toHaveClass('table--cards');
    expect(bodyRows().length).toBeGreaterThan(0);
    expect(unlabeled()).toEqual([]);
  });

  it('Nhật ký: bảng là table--cards, mỗi ô giá trị có nhãn', async () => {
    stubAudit();
    await openAudit();
    expect(tableEl()).toHaveClass('table--cards');
    expect(unlabeled()).toEqual([]);
  });

  it('Tủ/Kho Trong tủ: bảng là table--cards, mỗi ô giá trị có nhãn', async () => {
    mockViewport(1280);
    stubStockApi((url) => (url === '/api/admin/stock' ? jsonResponse(200, STOCK) : undefined));
    renderApp(makeMe('admin'), '/admin/stock');
    await screen.findByText('Giấy A4');
    expect(tableEl()).toHaveClass('table--cards');
    expect(unlabeled()).toEqual([]);
  });

  it('Tủ/Kho Lịch sử nhập xuất: bảng là table--cards', async () => {
    mockViewport(1280);
    const move = { id: 'm1', item_id: 'i-1', item_name: 'Giấy A4', item_name_en: null, unit: 'ram', delta: 5, reason: 'purchase', note: null, actor_sub: 'u-hc', actor_name: 'Phạm Hành Chính', recipient_sub: null, recipient_name: null, receipt_ym: null, created_at: '2026-11-12T03:15:00.000Z' };
    stubStockApi((url) => (url.startsWith('/api/admin/stock/movements?') ? jsonResponse(200, { items: [move], next_cursor: null, totals: { in: 5, out: 0 } }) : undefined));
    renderApp(makeMe('admin'), '/admin/stock?tab=history&ym=2026-11');
    await within(await screen.findByRole('table')).findByText('Giấy A4');
    expect(tableEl()).toHaveClass('table--cards');
    expect(unlabeled()).toEqual([]);
  });
});
