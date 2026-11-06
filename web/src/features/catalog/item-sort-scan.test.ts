import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ITEM_FIELDS } from './item-draft';

// Thứ tự món chỉ đổi bằng bước dữ liệu theo số ảnh; kéo-thả sắp lại món chưa làm
describe('không giao diện nào trong Danh mục gửi sort_order của món', () => {
  it('không tệp TSX (trừ test) nào nhắc sort_order; nháp món không có trường sort_order', () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith('.tsx') && !f.includes('.test.'));
    expect(files.length).toBeGreaterThan(10);
    expect(files.filter((f) => readFileSync(join(__dirname, f), 'utf8').includes('sort_order'))).toEqual([]);
    expect(ITEM_FIELDS).not.toContain('sort_order');
  });
});
