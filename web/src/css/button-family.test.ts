import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// một bộ nút, một khuôn nhãn trạng thái
const root = resolve(process.cwd(), 'src');
const walk = (dir: string, ext: RegExp): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, ext) : ext.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
const css = walk(root, /\.css$/).map((f) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')).join('\n');
const body = (sel: string) => {
  const m = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((x) => x[1].split(',').some((s) => s.trim() === sel));
  return m?.[2] ?? '';
};
const tsx = walk(root, /\.tsx$/).map((f) => ({ f: f.slice(root.length + 1), s: readFileSync(f, 'utf8') }));

describe('một bộ nút', () => {
  it('nút chính không bóng (TN-02)', () => {
    expect(body("[data-shell='admin'] .btn--primary")).toMatch(/--btn-sh:\s*none/);
  });
  it('nút nguy hiểm trong hàng: chữ đỏ, viền đỏ nhạt, nền trắng (TN-04)', () => {
    const b = body("[data-shell='admin'] .btn--danger-line");
    expect(b).toMatch(/--btn-bg:\s*var\(--c-surface\)/);
    expect(b).toMatch(/--btn-fg:\s*var\(--c-danger\)/);
    expect(b).toMatch(/--btn-sh:\s*inset 0 0 0 1px var\(--c-danger-line\)/);
  });
  it('không còn btn--quiet-danger / btn--danger-ghost', () => {
    expect(css).not.toMatch(/btn--(quiet-danger|danger-ghost)/);
    expect(tsx.filter((x) => /btn--(quiet-danger|danger-ghost)/.test(x.s)).map((x) => x.f)).toEqual([]);
  });
  it('đỏ đặc chỉ ở nút xác nhận cuối trong hộp', () => {
    const solid = tsx.filter((x) => /btn--danger btn--solid|'btn btn--danger btn--solid'/.test(x.s)).map((x) => x.f).sort();
    expect(solid).toEqual(['features/delivery/cancel-dialog.tsx', 'features/review/reject-dialog.tsx', 'ui/confirm-dialog.tsx']);
  });
  it.each([
    ['features/delivery/backlog-month-table.tsx', 'bl-cancel'],
    ['features/catalog/item-drawer.tsx', 'ct-delete'],
    ['features/admin/signature-boxes-block.tsx', 'cf-box__remove'],
  ])('%s: nút %s là btn--danger-line', (file, cls) => {
    const s = tsx.find((x) => x.f === file)!.s;
    expect(s).toMatch(new RegExp(`className="[^"]*btn--danger-line[^"]*${cls}|className="[^"]*${cls}[^"]*btn--danger-line`));
  });
  it('không selector nào vừa là nút vừa gạch chân (TN-05)', () => {
    const bad = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => /\.btn\b/.test(m[1]) && /text-decoration:\s*underline/.test(m[2])).map((m) => m[1].trim());
    expect(bad).toEqual([]);
  });
  it('nút icon có viền mảnh, bo 6 (TN-07)', () => {
    const b = body("[data-shell='admin'] .icon-btn");
    expect(b).toMatch(/border-radius:\s*var\(--r-sm\)/);
    expect(b).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--c-line\)/);
  });
});

describe('một khuôn nhãn trạng thái (TC-09, TN-08)', () => {
  it('nhãn có chấm 6px màu chữ', () => {
    const b = body("[data-shell='admin'] .tag--dot::before");
    expect(b).toMatch(/width:\s*6px/);
    expect(b).toMatch(/background:\s*currentColor/);
  });
  it.each(['ok', 'warn', 'danger', 'info', 'brand'])('tag--%s có chấm và viền cùng tông', (tone) => {
    expect(css).toMatch(new RegExp(`\\.tag--${tone}::before`));
    expect(body(`[data-shell='admin'] .tag--${tone}`)).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--c-/);
  });
});

describe('"Người đã nghỉ" cùng một nhãn xám viền ở mọi màn (TN-08)', () => {
  it.each([
    ['features/month/month-people-table.tsx', 'summary.table.leftCompany'],
    ['features/delivery/backlog-month-table.tsx', 'delivery.backlog.left'],
  ])('%s', (file, key) => {
    const s = tsx.find((x) => x.f === file)!.s;
    expect(s).toMatch(new RegExp(`className="tag tag--outline">\\{t\\('${key.replace('.', '\\.')}'\\)`));
  });
});
