import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// TC-07, TC-08, TC-10, TN-11: một khuôn bảng, dòng cần chú ý, thanh lọc
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const table = read('css/m1/table.css');
const filter = read('css/m1/filter.css');
const body = (css: string, sel: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => m[1].split(',').some((s) => s.trim() === sel))?.[2] ?? '';

describe('khuôn bảng (TC-07)', () => {
  it('đầu cột nền xám nhạt, chữ cap màu muted', () => {
    const b = body(table, "[data-shell='admin'] .table th");
    expect(b).toMatch(/background:\s*var\(--c-surface-2\)/);
    expect(b).toMatch(/color:\s*var\(--c-muted\)/);
  });
  it('dòng nhóm nền trung tính, không tô màu theo nhóm (TN-11, AD-21)', () => {
    expect(read('features/reports/reports.m1.css')).not.toMatch(/\.dt-group:has\(\.bc-group\[data-tone/);
  });
});

describe('dòng cần chú ý: vạch trái 3px + nền nhạt cùng tông (TC-08)', () => {
  it.each([
    ['warn', '--c-warn-fill', '--c-warn-soft'],
    ['danger', '--c-danger', '--c-danger-tint'],
  ])('.row--attn-%s', (tone, bar, bg) => {
    expect(body(table, `[data-shell='admin'] .table tr.row--attn-${tone} td`)).toMatch(new RegExp(`background:\\s*var\\(${bg}\\)`));
    expect(body(table, `[data-shell='admin'] .table tr.row--attn-${tone} td:first-child`)).toMatch(new RegExp(`box-shadow:\\s*inset 3px 0 0 var\\(${bar}\\)`));
  });
});

describe('thanh lọc một khuôn (TC-10)', () => {
  it('khung trắng viền mảnh bo --r-md', () => {
    const b = body(filter, "[data-shell='admin'] .filterbar");
    expect(b).toMatch(/background:\s*var\(--c-surface\)/);
    expect(b).toMatch(/border-radius:\s*var\(--r-md\)/);
    expect(b).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--c-line\)/);
  });
});
