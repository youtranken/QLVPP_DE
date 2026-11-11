import { expect } from 'vitest';

// Bảng có tab/chip lọc phải giữ cột đứng yên khi đổi lọc: table-layout fixed (class table--fixed) + colgroup
// đủ một <col> cho mỗi cột, chỉ cột chữ chính để trống bề rộng (nhận phần còn lại).
// jsdom không dàn trang nên kiểm cấu trúc; vị trí thật đo ở playwright/fixed-columns.spec.ts
export function expectFixedColumns(table: HTMLElement, opts: { cssWidths?: boolean } = {}): void {
  expect(table).toHaveClass('table--fixed');
  const cols = [...table.querySelectorAll(':scope > colgroup > col')] as HTMLTableColElement[];
  const heads = table.querySelectorAll(':scope > thead > tr:first-child > th');
  expect(cols.length).toBe(heads.length);
  // cssWidths: bề rộng đặt bằng class trong CSS (bảng viết tay) thay vì style
  const free = cols.filter((c) => (opts.cssWidths ? !c.className : !c.style.width && !c.classList.contains('sel')));
  expect(free.length).toBeLessThanOrEqual(1);
  // Bảng DataTable mang tổng bề rộng tối thiểu: màn 768–1024 hẹp hơn thì cuộn ngang, không ép nút/tiêu đề tràn cột
  if (!opts.cssWidths) expect(table.style.getPropertyValue('--dt-min')).toMatch(/^\d+(\.5)?rem$/);
}
