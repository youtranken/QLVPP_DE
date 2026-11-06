import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const PRD = resolve(__dirname, '../../../docs/prd.md');

// Một bảng đường đi cho "ADM không có / giao thiếu" phải nằm trong ghi chú FR-35 (Hủy nợ)
describe('docs/prd.md — bảng đường đi ADM không có / giao thiếu', () => {
  const text = readFileSync(PRD, 'utf8');
  const fr35 = text.slice(text.indexOf('- FR-35'), text.indexOf('### 6.5'));

  it('FR-35 có bảng "Lúc | Tình huống | Đường duy nhất" với đủ 8 tình huống', () => {
    expect(fr35).toMatch(/\|\s*Lúc\s*\|\s*Tình huống\s*\|\s*Đường duy nhất\s*\|/);
    const rows = fr35.split('\n').filter((l) => /^\s*\|/.test(l) && !/^\s*\|\s*(Lúc|---)/.test(l));
    expect(rows).toHaveLength(8);
    for (const phrase of [
      'Giảm ở Tổng hợp',
      'Đánh "ADM hết hàng" ở Hàng về',
      'Về bù kỳ trước',
      'Hủy nợ "Đã nghỉ việc"',
      'phần thiếu ở **Chưa nhận**, thành nợ khi kỳ sau khóa',
      '**không** Hủy nợ',
      'Hủy nợ qua ⋯ với lý do có sẵn',
      'ADM không còn hàng',
    ]) {
      expect(fr35).toContain(phrase);
    }
  });
});
