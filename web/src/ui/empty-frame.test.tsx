import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EmptyFrame } from '@/ui/empty-frame';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

// Cán kính lúp chỉ có trong hình "no-match"
const MAGNIFIER = 'M110 72l16 16';
const svg = () => document.querySelector('.empty-state svg')!;

describe('EmptyFrame: hai biến thể', () => {
  it('"no-match": kính lúp + nút Xóa lọc gọi onClear', async () => {
    const onClear = vi.fn();
    renderWithI18n(<EmptyFrame variant="no-match" title="Không có món khớp" onClear={onClear} />);
    expect(svg().innerHTML).toContain(MAGNIFIER);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('"no-match" bỏ qua art truyền vào: lọc không ra luôn là kính lúp', () => {
    renderWithI18n(<EmptyFrame variant="no-match" art="no-backlog" title="x" />);
    expect(svg().innerHTML).toContain(MAGNIFIER);
  });

  it('"empty" (mặc định): không bao giờ kính lúp, không nút Xóa lọc dù có onClear', () => {
    renderWithI18n(<EmptyFrame title="Chưa có gì" onClear={() => undefined} />);
    expect(svg().innerHTML).not.toContain(MAGNIFIER);
    expect(screen.queryByRole('button', { name: 'Xóa lọc' })).toBeNull();
  });

  it('flush (trong bảng): không heading, không nền thẻ thứ hai', () => {
    renderWithI18n(<EmptyFrame flush variant="no-match" title="Không khớp" />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(document.querySelector('.empty-state--flush')).not.toBeNull();
  });
});

// Năm chỗ từng có năm kiểu trống: mọi chỗ đi qua EmptyFrame (hoặc DataTable.empty → EmptyFrame), không dựng khung riêng
describe('EmptyFrame: dùng ở cả năm chỗ', () => {
  const src = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');
  it.each([
    ['features/month/month-people-table.tsx', /variant: 'no-match'.*onClear/],
    ['features/month/month-open-table.tsx', /empty=\{\{ art: 'no-request' \}\}/],
    ['features/arrivals/arrivals-page.tsx', /<EmptyFrame flush variant="no-match"/],
    ['features/delivery/backlog-page.tsx', /<EmptyFrame/],
    ['features/stock/stock-ledger-page.tsx', /<DataTable[^>]*emptyText=/] /* trang Xuất lẻ gộp vào sổ Lịch sử (AD-38) */,
  ])('%s', (file, re) => {
    const text = src(file);
    expect(text).toMatch(re);
    expect(text).not.toMatch(/<EmptyState\b/);
  });
});
