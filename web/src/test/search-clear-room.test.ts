import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.css')) out.push(p);
  }
  return out;
}

// Độ ưu tiên [id, class/attr/pseudo-class, thẻ]; :where() = 0, :is()/:not()/:has() = đối số cao nhất
function specificity(sel: string): [number, number, number] {
  let s = sel.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, '');
  const total: [number, number, number] = [0, 0, 0];
  s = s.replace(/:(?:is|not|has)\(((?:[^()]|\([^()]*\))*)\)/g, (_, args: string) => {
    const best = args
      .split(',')
      .map((a) => specificity(a.trim()))
      .sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2])[0];
    total[0] += best[0];
    total[1] += best[1];
    total[2] += best[2];
    return ' ';
  });
  s = s.replace(/\[[^\]]*\]/g, () => {
    total[1]++;
    return ' ';
  });
  total[0] += (s.match(/#[\w-]+/g) ?? []).length;
  total[1] += (s.match(/\.[\w-]+/g) ?? []).length + (s.match(/(?<!:):[\w-]+/g) ?? []).length;
  total[2] += (s.replace(/[.#:][\w-]+/g, ' ').match(/(?:^|[\s>+~])([a-z][\w-]*)/gi) ?? []).length;
  return total;
}

const gt = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

// Mọi luật đặt padding / padding-right cho ô tìm nằm trong .search-wrap (bảng dữ liệu, UserPicker)
function paddingRules(): { file: string; selector: string }[] {
  const out: { file: string; selector: string }[] = [];
  for (const file of walk(SRC)) {
    const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/(^|;|\s)padding(-right|-inline-end|-inline)?\s*:/.test(m[2])) continue;
      for (const sel of m[1].split(/,(?![^(]*\))/).map((x) => x.trim())) {
        if (/(\.table-search|\.a-input)(:[\w-]+)*$/.test(sel)) out.push({ file, selector: sel });
      }
    }
  }
  return out;
}

describe('ô tìm có nút X chừa chỗ bên phải, không bị luật của ô đè', () => {
  const base = readFileSync(join(SRC, 'css/base.css'), 'utf8');
  const room = /\n([^\n{}]*\.search-wrap > input[^{]*)\{[^}]*padding-right:/.exec(base);

  it('luật chừa chỗ tồn tại', () => {
    expect(room).not.toBeNull();
  });

  it('độ ưu tiên cao hơn mọi luật padding của .table-search / .a-input (chữ dài không chạy dưới nút X)', () => {
    const mine = specificity(room![1].trim());
    const rules = paddingRules();
    expect(rules.length).toBeGreaterThan(0);
    for (const r of rules) expect(gt(mine, specificity(r.selector)), `${r.selector} (${r.file})`).toBeGreaterThan(0);
  });
});

// Playwright đo vùng chạm bằng hộp thật của nút (không tính ::after): hộp nút phải 44×44, vòng 28px vẽ ở phần tử con
describe('nút X ô tìm đủ vùng chạm 44×44 ở điện thoại', () => {
  const base = readFileSync(join(SRC, 'css/base.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (sel: string) => new RegExp(`(?:^|\\n)${sel.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`).exec(base)?.[1] ?? '';

  it('hộp .search-clear rộng và cao 44px, không dựa vào pseudo-element', () => {
    const body = rule('.search-clear');
    expect(body).toMatch(/(^|;)\s*width:\s*44px/);
    expect(body).toMatch(/(^|;)\s*height:\s*44px/);
    expect(base).not.toMatch(/\.search-clear::after/);
  });

  it('vòng tròn 28px nằm ở .search-clear-dot', () => {
    expect(rule('.search-clear-dot')).toMatch(/width:\s*28px/);
  });
});
