import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest chạy với cwd = web/ → đọc thẳng file CSS
const css = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const ruleOf = (text: string, selector: string) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.match(new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
};

describe('nhãn .tag không ra ngoài ô chứa nó', () => {
  it.each([
    ['css/tokens.css', '.tag'],
    ['css/m1/base.css', "[data-shell='admin'] .tag"],
  ])('%s %s: rộng tối đa bằng khung, chữ dài xuống dòng thay vì tràn', (file, selector) => {
    const rule = ruleOf(css(file), selector);
    expect(rule).not.toBe('');
    expect(rule).toMatch(/max-width:\s*100%/);
    expect(rule).toMatch(/white-space:\s*normal/);
    expect(rule).not.toMatch(/(?:^|;)\s*height:\s*22px/);
    expect(rule).toMatch(/min-height:\s*22px/);
  });
});
