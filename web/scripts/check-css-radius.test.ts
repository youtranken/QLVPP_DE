import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findRadiusIssues, scanRadius } from './check-css-radius.mjs';

const reasons = (css: string) => findRadiusIssues('a.css', css).map((i) => `${i.selector.trim()} ${i.value} ${i.reason}`);

describe('check-css-radius', () => {
  it('border-radius: 14px trong .card → lỗi px, kèm số dòng', () => {
    expect(findRadiusIssues('a.css', '.x { color: red; }\n.card { border-radius: 14px; }')).toEqual([
      { file: 'a.css', line: 2, selector: '.card', value: '14px', reason: 'px' },
    ]);
  });

  it('0, 1px, 2px, 50%, inherit, var(--r-md) → không lỗi; 3px → lỗi (biên trên nét mảnh)', () => {
    for (const v of ['0', '1px', '2px', '50%', 'inherit', 'var(--r-md)', '0 0 var(--r-xl) var(--r-xl)']) {
      expect(reasons(`.card { border-radius: ${v}; }`)).toEqual([]);
    }
    expect(reasons('.card { border-radius: 3px; }')).toEqual(['.card 3px px']);
  });

  it('góc lẻ border-top-left-radius: 12px → lỗi px', () => {
    expect(reasons('.sheet { border-top-left-radius: 12px; }')).toEqual(['.sheet 12px px']);
  });

  it('.btn { var(--r-pill) } → pill-on-control; 999px cũng vậy', () => {
    expect(reasons('.btn { border-radius: var(--r-pill); }')).toEqual(['.btn var(--r-pill) pill-on-control']);
    expect(reasons('.btn { border-radius: 999px; }')).toEqual(['.btn 999px pill-on-control']);
  });

  it('pill cho .tag, số đếm em trong nhóm lọc, badge, avatar, công tắc, tiến độ, chấm → ok', () => {
    for (const sel of ['.tag', '.seg-m1 em', '.nav-badge', '.avatar', '.switch', '.progress > i', '.dot', '.count', '.x::after']) {
      expect(reasons(`${sel} { border-radius: var(--r-pill); }`)).toEqual([]);
    }
  });

  it('nhãn chỉ đọc có tên lớp riêng (.side__cnt, .ct-card__group, .dd-debt) → ok; .side__btn vẫn lỗi', () => {
    for (const sel of ['.side__cnt', '.ct-card__group', '.rq-card-group', '.dd-debt', '.rq-cart-chip']) {
      expect(reasons(`${sel} { border-radius: var(--r-pill); }`)).toEqual([]);
    }
    expect(reasons('.side__btn { border-radius: var(--r-pill); }')).toEqual(['.side__btn var(--r-pill) pill-on-control']);
  });

  it('rule trong @media vẫn được quét với đúng selector', () => {
    expect(reasons('@media (max-width: 640px) {\n  .ovp { border-radius: 20px 0 0 20px; }\n}')).toEqual(['.ovp 20px 0 0 20px px']);
  });

  it('quét toàn bộ web/src hiện tại → 0 lỗi', () => {
    const issues = scanRadius(resolve(import.meta.dirname, '..'));
    expect(issues.map((i) => `${i.file}:${i.line} ${i.value} ${i.reason}`)).toEqual([]);
  });
});
