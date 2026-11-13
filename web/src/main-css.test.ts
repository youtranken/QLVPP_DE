import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Màn nạp lười (shell/route-chunks.ts) mà tự import CSS thì CSS đó tách khỏi file chung, chèn vào trang muộn và lệch thứ tự
// cascade so với trước. main.tsx gom mọi CSS đúng thứ tự cũ; test này nhắc khi thêm CSS mới mà quên khai ở đó.
const SRC = resolve(__dirname);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [];
  });
}

function cssImports(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  return [...src.matchAll(/^import '([^']+\.css)';/gm)].map((m) => {
    const spec = m[1]!;
    return spec.startsWith('@/') ? spec.slice(2) : relative(SRC, resolve(join(file, '..'), spec));
  });
}

describe('main.tsx gom mọi CSS', () => {
  it('mọi file CSS được import trong src đều có trong main.tsx', () => {
    const inMain = new Set(cssImports(join(SRC, 'main.tsx')));
    expect(inMain.size).toBeGreaterThan(40);
    const missing = files(SRC)
      .flatMap((f) => cssImports(f).map((c) => `${c} (${relative(SRC, f)})`))
      .filter((c) => !inMain.has(c.split(' ')[0]!));
    expect(missing).toEqual([]);
  });
});
