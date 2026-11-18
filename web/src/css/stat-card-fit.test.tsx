import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { StatCard } from '@/ui/stat-card';

const base = readFileSync(resolve(process.cwd(), 'src/css/m1/base.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const ruleOf = (selector: string) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return base.match(new RegExp(`(?:^|\\})\\s*${esc}\\s*\\{([^}]*)\\}`, 'm'))?.[1] ?? '';
};

describe('thẻ số: nhãn và dòng phụ không bị cắt, số cùng hàng thẳng nhau', () => {
  it('dòng phụ xuống tối đa 2 dòng (line-clamp 2) thay vì cắt một dòng', () => {
    const rule = ruleOf("[data-shell='admin'] .stat-card__sub");
    expect(rule).toMatch(/-webkit-line-clamp:\s*2/);
    expect(rule).toMatch(/white-space:\s*normal/);
    expect(rule).not.toMatch(/white-space:\s*nowrap/);
  });

  it('dưới 1024 (thẻ 90–130px) cho tới 3 dòng; từ 1024 giữ 2 dòng', () => {
    expect(base).toMatch(/@media \(max-width: 1023px\) \{ \[data-shell='admin'\] \.stat-card__sub \{ -webkit-line-clamp: 3; \} \}/);
  });

  it('thẻ dùng hàng con chung của hàng thẻ (subgrid 3 hàng: nhãn / số / dòng phụ) — nhãn 2 dòng ở thẻ này đẩy số mọi thẻ cùng hàng', () => {
    const rule = ruleOf("[data-shell='admin'] .stat-card");
    expect(rule).toMatch(/display:\s*grid/);
    expect(rule).toMatch(/grid-template-rows:\s*subgrid/);
    expect(rule).toMatch(/grid-row:\s*span 3/);
  });

  it('StatCard có dòng phụ + thanh đo vẫn chỉ 3 khối trong luồng (gợi ý lọc nằm tuyệt đối)', () => {
    const { container } = render(<StatCard label="Đã giao" value={3} sub="trong đó 1 giao được ngay" meter={0.5} onClick={() => undefined} />);
    const card = container.querySelector('.stat-card')!;
    const inFlow = [...card.children].filter((c) => !c.classList.contains('stat-card__hint'));
    expect(inFlow).toHaveLength(3);
    expect(card.querySelector('.stat-card__sub')?.getAttribute('title')).toBe('trong đó 1 giao được ngay');
  });
});
