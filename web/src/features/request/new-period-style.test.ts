import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// vitest chạy với cwd = web/
const css = readFileSync(resolve(process.cwd(), 'src/features/request/request.m1.css'), 'utf8');
const rules = (prefix: string) => css.split('\n').filter((l) => l.includes(prefix));

describe('Popup kỳ mới: màu và vùng chạm', () => {
  it('chữ nhấn (tháng, hạn chót) không dùng đỏ cảnh báo: đỏ để dành cho lỗi', () => {
    const np = rules('.rq-np-');
    expect(np.length).toBeGreaterThan(0);
    for (const line of np) expect(line).not.toContain('--c-danger');
  });

  it('link "Xem phiếu" một dòng, cao ≥ 44px', () => {
    const link = rules('.rq-np-prev a {')[0] ?? '';
    expect(link).toContain('white-space: nowrap');
    expect(link).toMatch(/min-height: 44px/);
  });
});
