import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// TN-15: bảng màu cũ (teal v2, lục đời trước) không còn sót ở đâu ngoài test
const OLD = ['0E6A7B', '0E2A33', '14231C', '51645B', 'C9D5CE', '08303B', '0A5868', 'DDF1F5'];
const root = resolve(process.cwd(), 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(css|tsx?)$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : [];
  });
}

describe('không còn màu cũ (TN-15)', () => {
  it.each(OLD)('#%s không xuất hiện trong mã nguồn web', (hex) => {
    const re = new RegExp(`#${hex}\\b`, 'i');
    const hits = [...files(root), resolve(process.cwd(), 'index.html')].filter((f) => re.test(readFileSync(f, 'utf8')));
    expect(hits.map((f) => f.slice(root.length - 3))).toEqual([]);
  });
});
