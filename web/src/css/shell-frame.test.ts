import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// TC-01: khung admin theo họ QLHS/QLTS
const shell = readFileSync(resolve(process.cwd(), 'src/css/m1/shell.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  // chỉ luật ngoài @media (áp mọi bề rộng)
  .replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
const body = (sel: string) => [...shell.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].split(',').some((s) => s.trim() === sel))?.[2] ?? '';

describe('khung admin (TC-01, TC-02)', () => {
  it('nền trang phẳng --c-page, không còn vỏ gradient tối', () => {
    expect(body("[data-shell='admin'] .shell")).toMatch(/background:\s*var\(--c-page\)/);
    expect(body("[data-shell='admin'] .shell")).not.toMatch(/gradient/);
    expect(body("[data-shell='admin'] .shell__panel")).not.toMatch(/background|border-radius/);
  });
  it('sidebar nền rail navy', () => {
    expect(body("[data-shell='admin'] .side")).toMatch(/background:\s*var\(--c-rail\)/);
  });
  it('đường dẫn đầu trang ẩn: thanh trên đã có "QLVPP › trang"', () => {
    expect(body("[data-shell='admin'] .page-head__crumbs")).toMatch(/display:\s*none/);
  });
});

const rd = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
const ruleIn = (css: string, sel: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].split(',').some((s) => s.trim() === sel))?.[2] ?? '';

describe('khung nhân viên (TC-14, TC-15)', () => {
  const ms = rd('css/m1/member-shell.css');
  const mp = rd('css/m1/member-page.css');
  const rq = rd('features/request/request.m1.css');
  it('nền trang sáng, thanh trên và thanh dưới rail navy đặc (không kính mờ)', () => {
    expect(ruleIn(ms, "[data-shell='member'] .m-shell")).toMatch(/background:\s*var\(--c-page\)/);
    expect(ruleIn(ms, "[data-shell='member'] .m-top")).toMatch(/background:\s*var\(--c-rail\)/);
    expect(ruleIn(ms, "[data-shell='member'] .bottom-nav")).toMatch(/background:\s*var\(--c-rail\)/);
  });
  it('khung nội dung là tấm trắng viền mảnh', () => {
    const b = ruleIn(ms, "[data-shell='member'] .m-panel");
    expect(b).toMatch(/background:\s*var\(--c-surface\)/);
    expect(b).not.toMatch(/gradient/);
  });
  it('chữ đầu trang trên nền sáng là mực tối, không còn chữ trắng', () => {
    expect(ruleIn(rq, "[data-shell='member'] .rq-hero h1")).toMatch(/color:\s*var\(--c-ink\)/);
    expect(ruleIn(mp, "[data-shell='member'] .m-head h1")).toMatch(/color:\s*var\(--c-ink\)/);
  });
  it('thanh "Lưu phiếu" 390 là tấm trắng dính trên thanh dưới', () => {
    expect(ruleIn(rq, "[data-shell='member'] .rq-bar")).toMatch(/background:\s*var\(--c-surface\)/);
  });
});

describe('đợt sửa sau review đợt 1', () => {
  const raw = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
  it('đầu bảng dính nằm dưới thanh trên 60: th top = --sticky-top, đầu nhóm cộng 36', () => {
    const table = raw('src/css/m1/table.css');
    // chỉ bảng dính theo trang (có nhóm, overflow clip); bảng tự cuộn ngang thì đầu cột dính theo khung bảng, top 0
    expect(table).toMatch(/\.table th \{ position: sticky; top: 0;/);
    expect(table).toMatch(/\.table-wrap:has\(\.dt-group\) \.table th \{ top: var\(--sticky-top, 0px\); \}/);
    expect(table).toMatch(/top: calc\(var\(--sticky-top, 0px\) \+ 36px\)/);
    expect(raw('src/css/m1/shell.css')).toMatch(/@media \(min-width: 768px\) \{\s*\[data-shell='admin'\] \.shell \{ --sticky-top: 60px; \}/);
  });
  it('điều khiển cao 40 khi dùng chuột ≥ 768, 44 khi cảm ứng/điện thoại', () => {
    const tokens = raw('src/css/tokens-m1.css');
    expect(tokens).toMatch(/--hit: 44px;/);
    expect(tokens).toMatch(/@media \(min-width: 768px\) and \(pointer: fine\) \{\s*:root \{ --hit: 40px; \}/);
  });
  it('nền trước khi tải xong (index.html) đúng --c-page #F3F6FB', () => {
    expect(raw('index.html')).toMatch(/background: #f3f6fb/i);
  });
  it('không còn biến khung cũ: --c-hero-*, --c-panel-*, --c-owed-*, --c-shell-*, --c-glass*, --c-logo-bg', () => {
    const all = ['src/css/tokens-m1.css', 'src/css/m1/shell.css', 'src/css/m1/member-shell.css', 'src/features/profile/profile.m1.css'].map(raw).join('\n');
    expect(all).not.toMatch(/--c-(hero|panel|owed|shell|glass|logo-bg)\b/);
  });
  it('logo sidebar: vòng focus vẽ phía trong (không bị cột trái cắt)', () => {
    expect(rd('css/m1/shell.css')).toMatch(/\.side__brand:focus-visible \{[^}]*box-shadow: inset 0 0 0 2px/);
  });
  it('bước mờ ở Kỳ tháng không dùng opacity (axe: chữ mờ thiếu tương phản)', () => {
    expect(rd('features/month/month.m1.css')).not.toMatch(/\.mk-step\[data-state='muted'\] \{[^}]*opacity/);
  });
});
