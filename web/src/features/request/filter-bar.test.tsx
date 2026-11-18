import type { ReactNode } from 'react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n as render, screen, userEvent } from '@/test/test-utils';
import { mockViewport } from '@/test/viewport';
import { FilterBar } from './filter-bar';
import { DEFAULT_FILTER, type FilterState } from './item-filters';

const GROUPS = [
  { id: 'g1', label: 'Bút', n: 4 },
  { id: 'g2', label: 'Giấy', n: 2 },
];

function Harness({ shown = 6, copy, start = DEFAULT_FILTER }: { shown?: number; copy?: ReactNode; start?: FilterState }) {
  const [f, setF] = useState<FilterState>(start);
  return (
    <FilterBar
      filter={f}
      groups={GROUPS}
      total={6}
      shown={shown}
      copy={copy}
      onChange={(p) => setF({ ...f, ...p })}
      onClear={() => setF(DEFAULT_FILTER)}
    />
  );
}

describe('FilterBar', () => {
  it('chip nhóm có số và aria-pressed; "Tất cả" đang bật mặc định', async () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Tất cả 6' })).toHaveAttribute('aria-pressed', 'true');
    const g1 = screen.getByRole('button', { name: 'Bút 4' });
    await userEvent.click(g1);
    expect(g1).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tất cả 6' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('không có ô sắp xếp, không có nút "Đã chọn", không có "+ Thêm món khác" trên thanh lọc', () => {
    render(<Harness />);
    expect(screen.getByRole('searchbox', { name: 'Tìm món' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Sắp xếp' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Đã chọn/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Thêm món khác/ })).toBeNull();
  });

  it('"n món khớp" chỉ hiện khi ô tìm có chữ; lọc nhóm không có chữ thì không hiện; không còn "món trong danh mục"', async () => {
    const { unmount } = render(<Harness shown={6} />);
    expect(screen.queryByText(/món khớp/)).toBeNull();
    expect(screen.queryByText(/món trong danh mục/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Bút 4' }));
    expect(screen.queryByText(/món khớp/)).toBeNull();
    unmount();
    render(<Harness shown={1} start={{ ...DEFAULT_FILTER, q: 'g' }} />);
    expect(screen.getByText('1 món khớp')).toBeInTheDocument();
  });

  it('rỗng: thông báo + "Xóa lọc" trả về mặc định', async () => {
    render(<Harness shown={0} start={{ ...DEFAULT_FILTER, q: 'zzz' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Giấy 2' }));
    expect(screen.getByText('Không có món phù hợp')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa lọc' }));
    expect(screen.getByRole('button', { name: 'Tất cả 6' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([1024, 1280, 390])('%i px: nút "Chép lại" nằm ở hàng ô tìm; chip nằm trong khung cuộn', (width) => {
    mockViewport(width);
    render(<Harness copy={<button type="button">Chép lại danh sách tháng 12</button>} />);
    const copy = screen.getByRole('button', { name: 'Chép lại danh sách tháng 12' });
    const chips = screen.getByRole('group', { name: 'Nhóm món' });
    expect(copy.closest('.rq-f-row')).toContainElement(screen.getByRole('searchbox', { name: 'Tìm món' }));
    expect(chips.parentElement).toHaveClass('rq-f-scroll');
  });
});
