import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');
const SCOPE = "[data-shell='admin']";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function m1Files(): string[] {
  const css = readdirSync(join(SRC, 'css/m1')).filter((f) => f.endsWith('.css')).map((f) => join(SRC, 'css/m1', f));
  const feat = walk(join(SRC, 'features')).filter((f) => f.endsWith('.m1.css'));
  return [...css, ...feat];
}

function stripComments(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, '');
}

// Trả về selector của mọi luật kiểu style, bỏ qua thân @keyframes/@font-face; đi vào @media/@supports.
function selectors(css: string): string[] {
  const out: string[] = [];
  const walkBlock = (text: string) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open < 0) break;
      const head = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const body = text.slice(open + 1, j - 1);
      if (head.startsWith('@media') || head.startsWith('@supports')) walkBlock(body);
      else if (!head.startsWith('@')) out.push(...head.split(',').map((s) => s.trim()));
      i = j;
    }
  };
  walkBlock(css);
  return out;
}

describe('M1 CSS chỉ nằm trong phạm vi Hành chính', () => {
  const files = m1Files();

  it('có ít nhất base.css để kiểm', () => {
    expect(files.some((f) => f.endsWith('css/m1/base.css'))).toBe(true);
  });

  it.each(files.map((f) => [f.replace(SRC, ''), f]))('%s: mọi selector bắt đầu bằng phạm vi admin', (_n, file) => {
    const sels = selectors(stripComments(readFileSync(file, 'utf8')));
    expect(sels.length).toBeGreaterThan(0);
    const bad = sels.filter((s) => !s.startsWith(SCOPE));
    expect(bad).toEqual([]);
  });

  it.each(files.map((f) => [f.replace(SRC, ''), f]))('%s: không chứa mã màu hex', (_n, file) => {
    expect(readFileSync(file, 'utf8')).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('bộ phân tích bắt được selector thiếu phạm vi', () => {
    expect(selectors('.a{color:red} @media (x){ [data-shell=\'admin\'] .b{c:d} .e{f:g} } @keyframes k{from{a:b}}')).toEqual([
      '.a',
      "[data-shell='admin'] .b",
      '.e',
    ]);
  });
});
