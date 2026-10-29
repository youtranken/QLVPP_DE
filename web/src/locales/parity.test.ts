import { describe, expect, it } from 'vitest';
import vi from '@/locales/vi';
import en from '@/locales/en';

function keysOf(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

describe('locales vi/en', () => {
  it('mọi khóa trong vi có trong en và ngược lại, không giá trị rỗng', () => {
    const viKeys = keysOf(vi).sort();
    const enKeys = keysOf(en).sort();
    expect(viKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
    expect(enKeys.filter((k) => !viKeys.includes(k))).toEqual([]);
    const empty = (o: unknown, p = ''): string[] =>
      typeof o === 'string' ? (o.trim() === '' ? [p] : []) : Object.entries(o as object).flatMap(([k, v]) => empty(v, p ? `${p}.${k}` : k));
    expect([...empty(vi), ...empty(en)]).toEqual([]);
  });
});
