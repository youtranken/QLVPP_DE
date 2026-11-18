import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// vitest chạy với cwd = web/ (css?raw trả rỗng trong môi trường này) → đọc thẳng file
const SRC = resolve(process.cwd(), 'src');

function cssFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return cssFiles(p);
    return p.endsWith('.css') ? [p] : [];
  });
}

interface Rule {
  file: string;
  order: number;
  selectors: string[];
  decls: string;
}

function parse(file: string): Rule[] {
  const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  // Luật lá (không lồng ngoặc): phần trước "{" gần nhất là bộ chọn, @media bao ngoài tự rơi ra
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ file: relative(SRC, file), order: m.index ?? 0, selectors: m[1].split(',').map((s) => s.trim()).filter(Boolean), decls: m[2] });
  }
  return rules;
}

const ALL = cssFiles(SRC).flatMap(parse);
const read = (p: string) => readFileSync(resolve(SRC, p), 'utf8');

// Độ ưu tiên gần đúng (a,b,c) gộp thành số; đủ cho bộ chọn trong dự án (không có :where/:is lồng sâu)
function specificity(sel: string): number {
  const s = sel.replace(/:not\(([^()]*)\)/g, ' $1');
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length;
  const types = (s.replace(/\[[^\]]+\]/g, '').match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return ids * 10000 + classes * 100 + types;
}

// Bộ chọn "gốc": bỏ trạng thái (đang chọn/hover) để khớp luật :focus-visible của cùng phần tử
const base = (sel: string) =>
  sel
    .replace(/:focus-visible/g, '')
    .replace(/:hover|:not\([^)]*\)/g, '')
    .replace(/\[aria-(pressed|checked|selected|current|expanded)[^\]]*\]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

// Luật vẽ được vòng: box-shadow dùng token --focus*, hoặc outline có bề dày
const SHOWS_RING = /box-shadow:\s*var\(--focus|outline:\s*\d/;

const INTERACTIVE = /button|\.btn\b|chip\b|-tab\b|-more\b|-open\b|link\b/;

describe('luật vòng focus', () => {
  it('mọi luật "box-shadow: none" trên phần tử bấm được đều có luật :focus-visible thắng nó (không nuốt vòng focus)', () => {
    const offenders: string[] = [];
    for (const r of ALL) {
      if (!/box-shadow:\s*none/.test(r.decls)) continue;
      for (const sel of r.selectors) {
        // Chỉ xét phần tử cuối của selector: "button em[data-urgent]" là huy hiệu đếm bên trong nút, không phải chỗ nhận focus
        const target = sel.trim().split(/\s+|>/).filter(Boolean).pop() ?? sel;
        if (!INTERACTIVE.test(target) || /:focus|:disabled|\[disabled\]|\[aria-disabled/.test(sel)) continue;
        const want = base(sel);
        const spec = specificity(sel);
        const rescued = ALL.some(
          (f) =>
            SHOWS_RING.test(f.decls) &&
            f.selectors.some((fs) => fs.includes(':focus-visible') && base(fs) === want && (specificity(fs) > spec || (specificity(fs) === spec && f.file === r.file && f.order > r.order))),
        );
        if (!rescued) offenders.push(`${r.file}: ${sel}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('nhóm chọn dạng viên (ngôn ngữ): mục đang chọn vẫn có vòng focus', () => {
    expect(read('css/base.css')).toMatch(/\.seg button\[aria-checked='true'\]:focus-visible[^{]*\{\s*box-shadow:\s*var\(--focus\)/);
  });

  it('thẻ "Không thấy món cần?" có vòng focus', () => {
    expect(read('features/request/item-card.m1.css')).toMatch(/\.rq-card-more:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus\)/);
  });

  it('nút Lọc của Nhật ký: chỉ bỏ bóng khi không focus', () => {
    const audit = read('features/admin/audit.m1.css');
    expect(audit).toMatch(/\.au-filters \.btn--primary:not\(:focus-visible\)\s*\{\s*box-shadow:\s*none/);
    expect(audit).not.toMatch(/\.au-filters \.btn--primary(:hover)?\s*[,{]/);
  });

  it('link "Tới nội dung" của khung quản lý có vòng focus dù luật riêng đặt bóng nổi', () => {
    expect(read('css/m1/shell.css')).toMatch(/\[data-shell='admin'\] \.skip-link:focus-visible\s*\{\s*box-shadow:\s*var\(--e-3\),\s*var\(--focus\)/);
  });

  it('Nhận hàng ở điện thoại (bảng thành thẻ): bỏ khung cuộn ngang để vòng focus ô số/nút sát mép không bị cắt', () => {
    const css = read('features/arrivals/arrivals.m1.css');
    const phone = css.slice(css.indexOf('@media (max-width: 767px)'));
    expect(phone).toMatch(/\.ar-scroll\s*\{\s*overflow:\s*visible/);
  });

  it('bảng thành thẻ (TC-16, ≤680): dòng bấm được có luật :focus-visible đặt sau và thắng bóng viền của thẻ', () => {
    const css = read('css/m1/table.css');
    const card = css.indexOf(".table--cards tbody tr:not(.dt-group):not(.dt-expanded) {");
    const ring = css.search(/\.table--cards tbody tr\.clickable:focus-visible\s*\{[^}]*box-shadow:[^}]*var\(--focus\)/);
    expect(card).toBeGreaterThan(-1);
    expect(ring).toBeGreaterThan(card);
  });

  it('khung cuộn/khung cắt: một luật chung vẽ vòng focus vào trong, nạp sau mọi CSS chung', () => {
    const focus = read('css/focus.css');
    for (const box of ['.rv-tabs', '.month-switch', '.flt-chips', '.seg-m1', '.ct-chips', '.ct-seg-scroll', '.ct-gchips-scroll', '.rq-f-scroll']) expect(focus).toContain(box);
    expect(focus).toMatch(/:focus-visible\s*\{[^}]*box-shadow:\s*var\(--focus-inset\)/);
    expect(read('css/tokens-m1.css')).toMatch(/--focus-inset:\s*inset/);
    const imports = [...read('main.tsx').matchAll(/import '(@\/css\/[^']+\.css)'/g)].map((m) => m[1]);
    expect(imports.at(-1)).toBe('@/css/focus.css');
  });
});
