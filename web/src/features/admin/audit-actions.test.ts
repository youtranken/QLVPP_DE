import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import vi from '@/locales/vi';
import en from '@/locales/en';
import { AUDIT_ACTIONS, auditActionLabel } from './audit-actions';

const API_SRC = resolve(process.cwd(), '..', 'api', 'src');
const ACTION_LITERAL = /['`]((?:auth|category|config|files|item|line|period|report|request|users)\.[a-z_]+)['`]/g;
const STOCK_REASONS = ['purchase', 'adjust', 'issue', 'delivery'];

function apiSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return apiSources(path);
    return /\.ts$/.test(e.name) && !/\.(spec|d)\.ts$/.test(e.name) ? [path] : [];
  });
}

const dig = (obj: unknown, path: string[]): unknown => path.reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const hasLabel = (messages: unknown, action: string) => typeof dig(messages, ['audit', 'actions', ...action.split('.')]) === 'string';

describe('AUDIT_ACTIONS', () => {
  it('có nhãn cho mọi action mà api ghi (quét api/src, mở rộng stock.${reason})', () => {
    const written = new Set(STOCK_REASONS.map((r) => `stock.${r}`));
    for (const file of apiSources(API_SRC)) {
      for (const m of readFileSync(file, 'utf8').matchAll(ACTION_LITERAL)) written.add(m[1]);
    }
    expect([...written].filter((a) => !AUDIT_ACTIONS.includes(a)).sort()).toEqual([]);
    expect(written.has('line.cancel_remaining') && written.has('report.snapshot_created') && written.has('line.delivered')).toBe(true);
  });

  it('mọi action có khóa audit.actions.<action> ở cả vi và en, nhãn không rỗng', () => {
    for (const a of AUDIT_ACTIONS) {
      expect(hasLabel(vi, a), `vi ${a}`).toBe(true);
      expect(hasLabel(en, a), `en ${a}`).toBe(true);
    }
  });

  it('nhãn hành động lạ rơi về mã thô, không rỗng', () => {
    const t = (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key;
    expect(auditActionLabel(t, 'future.thing')).toBe('future.thing');
    expect(auditActionLabel(() => 'Đã giao', 'line.delivered')).toBe('Đã giao');
  });
});
