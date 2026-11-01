import { describe, expect, it } from 'vitest';
import vi from '@/locales/vi';
import en from '@/locales/en';
import { scanApi, scanSource, stockReasons } from '@/test/api-audit-scan';
import { AUDIT_ACTIONS, auditActionLabel } from './audit-actions';

const dig = (obj: unknown, path: string[]): unknown => path.reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
const hasLabel = (messages: unknown, action: string) => typeof dig(messages, ['audit', 'actions', ...action.split('.')]) === 'string';

describe('AUDIT_ACTIONS', () => {
  it('có nhãn cho mọi action mà api ghi, và mọi lời gọi append/appendWithin/@Audited đều giải được action', () => {
    const { actions, unresolved } = scanApi();
    expect(unresolved.map((u) => `${u.where} ${u.text}`)).toEqual([]);
    expect([...actions].filter((a) => !AUDIT_ACTIONS.includes(a)).sort()).toEqual([]);
    expect(AUDIT_ACTIONS.filter((a) => !actions.has(a)).sort()).toEqual([]);
    for (const a of ['line.cancel_remaining', 'report.snapshot_created', 'line.delivered']) expect(actions.has(a)).toBe(true);
    // Giao trừ kho không audit riêng (line.delivered mang movement_id): bộ lọc Nhật ký không được có mục luôn rỗng
    expect(actions.has('stock.delivery')).toBe(false);
  });

  it('trích xuất không phụ thuộc tiền tố: nhóm mới, ba ngôi, biến const, template reason; dạng lạ -> báo file:dòng', () => {
    const src = `class A {
  f() {
    this.audit.append({ actor: 'x', action: 'brand_new.thing' });
    this.audit.appendWithin(tx, { actor: 'x', action: ok ? 'a.b' : 'c.d' });
    const action = del ? 'r.deleted' : 'r.created';
    this.audit.appendWithin(tx, { actor, action });
    this.audit.appendWithin(tx, { actor, action: \`stock.\${m.reason}\` });
    this.audit.append({ actor, action: compute() });
  }
}`;
    const r = scanSource('modules/x/a.ts', src, ['purchase', 'transfer']);
    expect([...r.actions].sort()).toEqual(['a.b', 'brand_new.thing', 'c.d', 'r.created', 'r.deleted', 'stock.purchase', 'stock.transfer']);
    expect(r.unresolved).toEqual([{ where: 'modules/x/a.ts:8', text: 'compute()' }]);
  });

  it('lý do kho đọc từ kiểu union ở stock.service.ts, không chép tay', () => {
    expect(stockReasons("interface M { reason: 'purchase' | 'adjust' | 'issue' | 'delivery'; note: string }")).toEqual(['purchase', 'adjust', 'issue', 'delivery']);
    expect(stockReasons('interface M { note: string }')).toEqual([]);
    expect(stockReasons("interface M { reason: 'purchase' | 'adjust' | 'issue' } function f(m: M & { reason: 'purchase' | 'adjust' }) {}")).toEqual(['purchase', 'adjust', 'issue']);
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
