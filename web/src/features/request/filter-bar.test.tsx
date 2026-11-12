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

function Harness({ shown = 6, copy }: { shown?: number; copy?: ReactNode }) {
  const [f, setF] = useState<FilterState>(DEFAULT_FILTER);
  return (
    <FilterBar
      filter={f}
      groups={GROUPS}
      total={6}
      shown={shown}
      pickedCount={3}
      copy={copy}
      onChange={(p) => setF({ ...f, ...p })}
      onClear={() => setF(DEFAULT_FILTER)}
      onAddCustom={() => undefined}
    />
  );
}

describe('FilterBar', () => {
  it('"Đã chọn 3" là nút bật tắt có aria-pressed', async () => {
    render(<Harness />);
    const btn = screen.getByRole('button', { name: 'Đã chọn 3' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('chip nhóm có số và aria-pressed; "Tất cả" đang bật mặc định', async () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Tất cả 6' })).toHaveAttribute('aria-pressed', 'true');
    const g1 = screen.getByRole('button', { name: 'Bút 4' });
    await userEvent.click(g1);
    expect(g1).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Tất cả 6' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('6 món khớp bộ lọc')).toBeInTheDocument();
  });

  it('rỗng: thông báo + "Xóa bộ lọc" trả về mặc định', async () => {
    render(<Harness shown={0} />);
    await userEvent.click(screen.getByRole('button', { name: 'Giấy 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Đã chọn 3' }));
    expect(screen.getByText('Không có món phù hợp')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }));
    expect(screen.getByRole('button', { name: 'Tất cả 6' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Đã chọn 3' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('có ô tìm và ô sắp xếp có tên', () => {
    render(<Harness />);
    expect(screen.getByRole('searchbox', { name: 'Tìm món' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Sắp xếp' })).toHaveTextContent('Theo nhóm');
  });

  it.each([
    [1024, 'cuối hàng chip'],
    [1280, 'hàng trên'],
  ])('%i px: nút "Chép lại" nằm ở %s; "+ Thêm món khác" luôn ở hàng trên; chip nằm trong khung cuộn', (width) => {
    mockViewport(width);
    render(<Harness copy={<button type="button">Chép lại danh sách tháng 12</button>} />);
    const copy = screen.getByRole('button', { name: 'Chép lại danh sách tháng 12' });
    const add = screen.getByRole('button', { name: '+ Thêm món khác' });
    const chips = screen.getByRole('group', { name: 'Nhóm món' });
    expect(add.closest('.rq-f-row')).not.toBeNull();
    expect(chips.parentElement).toHaveClass('rq-f-scroll');
    if (width === 1024) expect(copy.closest('.rq-f-chiprow')).not.toBeNull();
    else expect(copy.closest('.rq-f-row')).not.toBeNull();
  });
});
