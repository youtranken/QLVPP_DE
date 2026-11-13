import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import vi from '@/locales/vi';
import en from '@/locales/en';

// parity.test.ts chỉ so vi với en; test này so khoá CODE GỌI với locale.
// Bắt khoá thiếu kiểu `t('units.page.saving')` (i18next trả nguyên khoá → người dùng thấy chữ khoá).
// Chỉ quét khoá dạng chuỗi cố định: t('…'), i18n.t('…'), i18nKey="…". Khoá dựng động (`${x}`) bỏ qua.
const SRC = resolve(process.cwd(), 'src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'locales' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) ? [p] : [];
  });
}

function leafKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => leafKeys(v, prefix ? `${prefix}.${k}` : k));
}

const PLURAL = /_(zero|one|two|few|many|other)$/;
function keySet(locale: unknown): Set<string> {
  const s = new Set<string>();
  for (const k of leafKeys(locale)) {
    s.add(k);
    s.add(k.replace(PLURAL, '')); // t('x', { count }) → x_one / x_other
  }
  return s;
}

// Khoá i18n luôn có dấu chấm (namespace.khoá); chuỗi không chấm là t() khác, không phải i18next
const CALL = /(?:\bt|\bi18n\.t)\(\s*(['"])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\1/g;
const TRANS = /i18nKey=(['"])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\1/g;

function usedKeys(): { key: string; at: string }[] {
  return sourceFiles(SRC).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(CALL), ...text.matchAll(TRANS)].map((m) => ({ key: m[2], at: relative(SRC, file) }));
  });
}

describe('khoá i18n code gọi', () => {
  const used = usedKeys();

  it('quét được khoá (tránh regex hỏng mà test vẫn xanh)', () => {
    expect(used.length).toBeGreaterThan(1000);
  });

  it.each([
    ['vi', vi],
    ['en', en],
  ])('mọi khoá chuỗi cố định có trong %s', (_lang, locale) => {
    const keys = keySet(locale);
    const missing = used.filter((u) => !keys.has(u.key)).map((u) => `${u.key} (${u.at})`);
    expect([...new Set(missing)]).toEqual([]);
  });
});
