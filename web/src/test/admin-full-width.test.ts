import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');

// Danh sách cho phép duy nhất (R-D1.2 năm nhóm + cột bảng ≤ 280 px của R-D1.10), so khớp nguyên selector sau [data-shell='admin']
const ALLOWED: Record<string, { selectors: string[]; limit?: string }> = {
  a4: { selectors: ['.sa-sheet', '.pp-page'] },
  field: { selectors: ['.toolbar__search', '.flt-search', '.dd-step'], limit: '480px' },
  prose: { selectors: ['.page-sub', '.au-muted', '.au-pairs'], limit: '72ch' },
  emptyState: { selectors: ['.empty-state__body'], limit: '480px' },
  // Bảng Trước/Sau của Nhật ký: giãn hết 1400px thì mắt phải nhìn rất xa
  readable: { selectors: ['.au-diff'], limit: '760px' },
  // Lớp nổi của ô chọn/lịch: chặn theo bề ngang màn hình để không tràn ở 390
  overlay: { selectors: ['.sheet', '.sa-preview-dialog', '.ovp', '.side .notif-panel', '.adm-head .notif-panel', '.qs', '.toast-host', '[data-shell] .lb-list', '[data-shell] .cal', '[data-shell] .mp'] },
  column: { selectors: ['.ct-code', '.ct-name-en', '.dv-give__out'], limit: '280px' },
  // Nhãn nhóm nằm đè trên ảnh thẻ: chặn theo % của thẻ, không phải khối bố cục
  photoBadge: { selectors: ['.ct-card__group'], limit: '62%' },
};

// Không chặn gì: bằng khung cha hoặc bỏ chặn
const NOT_A_CAP = /^(none|100%|auto|initial|inherit|unset|revert)$/;

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

const MEMBER_ONLY = /\/features\/(request|history|profile)\/|\/css\/m1\/member-|\/css\/(login|tokens|tokens-m1)\.css$/;

function adminCssFiles(): string[] {
  return walk(SRC).filter((f) => f.endsWith('.css') && !MEMBER_ONLY.test(f));
}

// Mọi khai báo max-width/max-inline-size khác none/100% (kể cả min()/calc()/var()/%/vw), ngoài @media print
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
          if (!NOT_A_CAP.test(value)) caps.push({ file, selector, value });
        }
      }
      buf = '';
    } else buf += ch;
  }
  return caps;
}

const targetsOf = (selector: string) =>
  selector
    .split(',')
    .map((s) => s.trim())
    .filter((s) => !s.startsWith("[data-shell='member']"))
    .map((s) => s.replace(/^\[data-shell='admin'\]\s*/, '').replace(/\s+/g, ' '));

const LITERAL = /^(\d+(?:\.\d+)?)(px|rem|em|ch|mm|%)$/;

function violation(cap: Cap): string | null {
  const targets = targetsOf(cap.selector);
  if (targets.length === 0) return null;
  const where = `${relative(SRC, cap.file)} ${cap.selector}: max-width ${cap.value}`;
  const group = Object.values(ALLOWED).find((g) => targets.every((t) => g.selectors.includes(t)));
  if (!group) return where;
  if (!group.limit) return null;
  const value = LITERAL.exec(cap.value);
  const limit = LITERAL.exec(group.limit)!;
  return value && value[2] === limit[2] && Number(value[1]) <= Number(limit[1]) ? null : `${where} > ${group.limit}`;
}

describe('Adm D&E toàn màn hình', () => {
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

  it('bộ quét không cho qua: min()/calc()/var()/%/vw, selector chỉ trùng tiền tố (.sheet-wide), nhãn hẹp ≤ 280 px ngoài danh sách cột', () => {
    const css = `[data-shell='admin'] .x-min { max-width: min(960px, 100%); }
[data-shell='admin'] .x-calc { max-width: calc(100% - 320px); }
[data-shell='admin'] .x-var { max-width: var(--page-max); }
[data-shell='admin'] .x-pct { max-width: 60%; }
[data-shell='admin'] .x-vw { max-inline-size: 80vw; }
[data-shell='admin'] .sheet-wide { max-width: 900px; }
[data-shell='admin'] .ovp-body { max-width: 600px; }
[data-shell='admin'] .x-label { max-width: 200px; }
[data-shell='admin'] .ct-code { max-width: 300px; }
[data-shell='admin'] .ct-code { max-width: min(120px, 50%); }`;
    expect(widthCaps('x.css', css).map(violation).filter(Boolean)).toHaveLength(10);
  });

  it('bộ quét cho qua: none, 100%, cột trong danh sách ≤ 280 px, panel/hộp thoại, selector của member', () => {
    const css = `[data-shell='admin'] .x-full { max-width: 100%; }
[data-shell='admin'] .x-none { max-width: none !important; }
[data-shell='admin'] .ct-code { max-width: 120px; }
[data-shell='admin'] .sheet { max-width: 440px; }
[data-shell='member'] .m-page { max-width: 1440px; }`;
    expect(widthCaps('x.css', css).map(violation).filter(Boolean)).toEqual([]);
  });

  it('chữ chi tiết Nhật ký là văn xuôi 72ch (R-D1.2 nhóm 3)', () => {
    const css = readFileSync(join(SRC, 'features/admin/audit.m1.css'), 'utf8');
    expect(css).toMatch(/\[data-shell='admin'\] \.au-muted, \[data-shell='admin'\] \.au-pairs \{ max-inline-size: 72ch; \}/);
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

  it('panel cũ 384 px đã gỡ: không còn ui/drawer, cột .pp-side, lớp .drawer — Tổng hợp, Nhân viên, Còn nợ, Giao hàng, Tủ đều dùng OverlayPanel', () => {
    expect(existsSync(join(SRC, 'ui/drawer.tsx'))).toBe(false);
    const files = walk(SRC).filter((f) => /\.(css|tsx?)$/.test(f) && !f.endsWith('admin-full-width.test.ts'));
    const css = /\.drawer(-viewport|-backdrop|-header|-body|-footer)?\s*[{,.[]|pp-side/;
    const code = /@\/ui\/drawer'|pp-side/;
    const hits = files.filter((f) => (f.endsWith('.css') ? css : code).test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => relative(SRC, f))).toEqual([]);
    const panels = ['features/summary/adjust-dialog.tsx', 'features/directory/user-drawer.tsx', 'features/delivery/deliveries-drawer.tsx', 'features/delivery/people/delivery-people-page.tsx', 'features/stock/movements-drawer.tsx'];
    for (const f of panels) expect(readFileSync(join(SRC, f), 'utf8'), f).toMatch(/<OverlayPanel/);
  });
});

describe('Bố cục theo route', () => {
  it('Cấu hình: dùng hết bề ngang (không chặn rộng); ≥1280 lưới 2 cột, khối đầu (Kỳ đăng ký + lịch) chiếm cả hàng; hẹp 1 cột', () => {
    const css = readFileSync(join(SRC, 'features/admin/config.m1.css'), 'utf8');
    expect(css).not.toMatch(/\.cf-blocks \{[^}]*max-(?:inline-size|width)/);
    expect(css).toMatch(/\.cf-blocks \{[^}]*grid-template-columns: minmax\(0, 1fr\)/);
    // Còn 2 khối (A7 bỏ Liên hệ): một cột ở mọi bề rộng, không để khối Ô ký nằm nửa hàng
    expect(css).not.toMatch(/\.cf-blocks \{ grid-template-columns: repeat\(2,/);
    expect(css).not.toMatch(/\.cf-layout|\.cf-aside/);
  });

  it('Bảng cột cố định: tiêu đề (cả cột số th.r vốn nowrap) xuống dòng trong cột; bảng có bề rộng tối thiểu --dt-min', () => {
    const css = readFileSync(join(SRC, 'css/m1/table.css'), 'utf8');
    expect(css).toMatch(/\.table\.table--fixed th\.r \{ white-space: normal;/);
    expect(css).toMatch(/\.table--fixed \{ table-layout: fixed; min-width: var\(--dt-min, 0\); \}/);
  });

  // dải chấm nối là tiến trình nên giữ một hàng cả ở 390 (hai hàng thì đường nối gãy)
  it('Kỳ tháng: dải 4 bước một hàng ở mọi bề rộng, bước cuối vừa nội dung để dải chạm hai mép (A3); bảng dùng hết bề ngang', () => {
    const css = readFileSync(join(SRC, 'features/month/month.m1.css'), 'utf8');
    expect(css).toMatch(/\.mk-strip \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\) auto/);
    expect(css).not.toMatch(/\.mk-strip \{[^}]*grid-template-columns: repeat\(2,/);
  });

  it('Báo cáo & gửi NCC: đầu trang wrap; thanh công cụ (tháng, công tắc, nút) trong khung, 390 hàng nút tự xuống dòng', () => {
    const css = readFileSync(join(SRC, 'features/reports/reports.m1.css'), 'utf8');
    expect(css).toMatch(/\.bc-head \{[^}]*display: flex; flex-wrap: wrap/);
    expect(css).toMatch(/@media \(max-width: 767px\) \{[^}]*\.bc-page > \.toolbar \.toolbar__end \{ flex-wrap: wrap; \}/);
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

  it('nền mờ rgb(14 42 51 / .32) + blur(2px) phủ cả khung nhìn (inset 0, kể cả sidebar); panel kính 440 px, bo --r-xl (12 px, giao diện A) hai góc trái; < 768 rộng 100 %', () => {
    expect(rule('.ovp-backdrop')).toMatch(/position: fixed; inset: 0;/);
    expect(rule('.ovp-backdrop')).toMatch(/background: rgb\(14 42 51 \/ \.32\); backdrop-filter: blur\(2px\)/);
    expect(rule('.ovp')).toMatch(/width: 440px;/);
    expect(rule('.ovp')).toMatch(/border-radius: var\(--r-xl\) 0 0 var\(--r-xl\);/);
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
