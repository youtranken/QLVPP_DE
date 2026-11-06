import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');

// Danh sách cho phép duy nhất: chỉ các selector này được chặn bề rộng
const ALLOWED: Record<string, { selectors: string[]; limit?: string }> = {
  a4: { selectors: ['.sa-sheet', '.pp-page'] },
  field: { selectors: ['.toolbar__search', '.flt-search', '.gcb'], limit: '480px' },
  prose: { selectors: ['.page-sub'], limit: '72ch' },
  emptyState: { selectors: ['.empty-state__body'], limit: '480px' },
  overlay: { selectors: ['.sheet', '.sa-preview-dialog', '.ovp'] },
};

// Chặn ≤ 280 px là nhãn/cột hẹp (cột cố định của bảng tối đa 280 px), không phải khối bố cục
const COLUMN_CAP_PX = 280;

interface Cap {
  file: string;
  selector: string;
  value: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function adminCssFiles(): string[] {
  const css = readdirSync(join(SRC, 'css/m1'))
    .filter((f) => f.endsWith('.css') && !f.startsWith('member-'))
    .map((f) => join(SRC, 'css/m1', f));
  const feat = walk(join(SRC, 'features')).filter((f) => f.endsWith('.m1.css') && !/\/features\/(request|history|profile)\//.test(f));
  return [...css, ...feat];
}

// Mọi khai báo max-width/max-inline-size có độ dài cố định, ngoài @media print
function widthCaps(file: string, css: string): Cap[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const caps: Cap[] = [];
  const stack: string[] = [];
  let buf = '';
  for (const ch of text) {
    if (ch === '{') {
      stack.push(buf.trim());
      buf = '';
    } else if (ch === '}') {
      const selector = stack.pop() ?? '';
      const inPrint = stack.some((s) => /^@media\s+print/.test(s));
      if (!selector.startsWith('@') && !inPrint) {
        for (const m of buf.matchAll(/max-(?:width|inline-size)\s*:\s*([^;]+)/g)) {
          const value = m[1].replace(/!important/, '').trim();
          if (/^\d+(\.\d+)?(px|rem|em|ch|mm)$/.test(value)) caps.push({ file, selector, value });
        }
      }
      buf = '';
    } else buf += ch;
  }
  return caps;
}

const lastClass = (selector: string) => selector.split(',').map((s) => s.trim().split(/\s+/).pop() ?? '');

function violation(cap: Cap): string | null {
  const px = /^(\d+)px$/.exec(cap.value);
  if (px && Number(px[1]) <= COLUMN_CAP_PX) return null;
  const targets = lastClass(cap.selector);
  for (const group of Object.values(ALLOWED)) {
    if (!targets.every((t) => group.selectors.some((s) => t.startsWith(s)))) continue;
    if (!group.limit) return null;
    const limit = parseFloat(group.limit);
    const unit = group.limit.replace(/[\d.]/g, '');
    return cap.value.endsWith(unit) && parseFloat(cap.value) <= limit ? null : `${cap.selector}: ${cap.value} > ${group.limit}`;
  }
  return `${relative(SRC, cap.file)} ${cap.selector}: max-width ${cap.value}`;
}

describe('Hành chính toàn màn hình', () => {
  it('không khối/trang nào chặn bề rộng ngoài danh sách cho phép (A4, ô nhập ≤ 480, văn xuôi 72ch, trạng thái trống ≤ 480, hộp thoại/panel)', () => {
    const bad = adminCssFiles()
      .flatMap((f) => widthCaps(f, readFileSync(f, 'utf8')))
      .map(violation)
      .filter(Boolean);
    expect(bad).toEqual([]);
  });

  it('bộ quét bắt selector lạ: .un-block 960px, .shell__panel 1280px, ô nhập 520px', () => {
    const css = `[data-shell='admin'] .un-block { max-width: 960px; }
[data-shell='admin'] .shell__panel { max-width: 1280px; margin-inline: auto; }
[data-shell='admin'] .flt-search { max-width: 520px; }
[data-shell='admin'] .ct-code { max-width: 120px; }
@media print { [data-shell='admin'] .x-print { max-width: 900px; } }`;
    expect(widthCaps('x.css', css).map(violation).filter(Boolean)).toHaveLength(3);
  });

  it('.shell__panel không còn max-width, lề trong 24 px (≥ 768) và 16 px (< 768)', () => {
    const shell = readFileSync(join(SRC, 'css/m1/shell.css'), 'utf8');
    const panel = /\[data-shell='admin'\] \.shell__panel \{([^}]*)\}/.exec(shell)![1];
    expect(panel).not.toMatch(/max-width|margin-inline:\s*auto/);
    expect(panel).toMatch(/padding: 24px/);
    expect(shell).toMatch(/@media \(max-width: 767px\)[\s\S]*\.shell__panel \{[^}]*padding: 16px/);
  });

  it('không còn has-drawer / padding-right: var(--drawer-w) / usePushContent trong mã', () => {
    const files = walk(SRC).filter((f) => /\.(css|tsx?)$/.test(f) && !f.endsWith('admin-full-width.test.ts') && !f.endsWith('drawer.test.tsx'));
    const hits = files.filter((f) => /has-drawer|--drawer-w|usePushContent/.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => relative(SRC, f))).toEqual([]);
  });
});

describe('Bố cục theo route', () => {
  it('Cấu hình: khối xếp auto-fill minmax(420px) (một khối lẻ không kéo hết hàng), khối ô ký chiếm cả hàng; < 420 một cột', () => {
    const css = readFileSync(join(SRC, 'features/admin/config.m1.css'), 'utf8');
    expect(css).toMatch(/\.cf-blocks \{[^}]*grid-template-columns: repeat\(auto-fill, minmax\(min\(100%, 420px\), 1fr\)\)/);
    expect(css).toMatch(/\.cf-block:has\(\.cf-box\) \{ grid-column: 1 \/ -1; \}/);
  });
});

describe('Panel phủ — hoạt ảnh và thứ tự lớp', () => {
  const overlay = readFileSync(join(SRC, 'css/m1/overlay.css'), 'utf8');
  const rule = (sel: string) => new RegExp(`\\[data-shell='admin'\\] ${sel.replace('.', '\\.')} \\{([^}]*)\\}`).exec(overlay)?.[1] ?? '';

  it('mặc định trượt 200 ms ease-out, nền mờ hiện dần 150 ms; prefers-reduced-motion: reduce → không hoạt ảnh', () => {
    expect(rule('.ovp')).toMatch(/animation: ovp-in 200ms ease-out/);
    expect(overlay).toMatch(/@keyframes ovp-in \{ from \{ transform: translateX\(100%\); \} \}/);
    expect(rule('.ovp-backdrop')).toMatch(/animation: ovp-fade 150ms/);
    const reduced = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/.exec(overlay)![1];
    expect(reduced).toMatch(/\.ovp, \[data-shell='admin'\] \.ovp-backdrop \{ animation: none; transition: none; \}/);
  });

  it('nền mờ rgb(14 42 51 / .32) + blur(2px) phủ cả khung nhìn (inset 0, kể cả sidebar); panel kính 440 px, bo 20 px hai góc trái; < 768 rộng 100 %', () => {
    expect(rule('.ovp-backdrop')).toMatch(/position: fixed; inset: 0;/);
    expect(rule('.ovp-backdrop')).toMatch(/background: rgb\(14 42 51 \/ \.32\); backdrop-filter: blur\(2px\)/);
    expect(rule('.ovp')).toMatch(/width: 440px;/);
    expect(rule('.ovp')).toMatch(/border-radius: 20px 0 0 20px;/);
    expect(rule('.ovp')).toMatch(/background: rgb\(255 255 255 \/ \.86\); backdrop-filter:/);
    expect(overlay).toMatch(/@media \(max-width: 767px\) \{[\s\S]*\.ovp \{ width: 100%;/);
  });

  it('thứ tự lớp: panel z 40 < hộp thoại z 50 < toast z 60', () => {
    const base = readFileSync(join(SRC, 'css/base.css'), 'utf8');
    const states = readFileSync(join(SRC, 'css/m1/states.css'), 'utf8');
    const z = (css: string, sel: string) => Number(new RegExp(`${sel.replace('.', '\\.')} \\{[^}]*z-index: (\\d+)`).exec(css)![1]);
    expect(z(overlay, '.ovp-viewport')).toBe(40);
    expect(z(overlay, '.ovp-backdrop')).toBe(40);
    expect(z(base, '.modal-backdrop')).toBe(50);
    expect(z(states, '.toast-host')).toBe(60);
  });
});
