import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';

interface Item {
  id: string;
  name: string;
  group: string;
}
const ITEMS: Item[] = [
  { id: 'a', name: 'Bút bi xanh', group: 'Bút & viết' },
  { id: 'b', name: 'Bút chì 2B', group: 'Bút & viết' },
  { id: 'c', name: 'Giấy A4', group: 'Giấy & sổ' },
];
const COLUMNS: ColumnDef<Item>[] = [{ accessorKey: 'name', header: 'Tên món' }];
const GROUP_BY = {
  key: (r: Item) => r.group,
  header: (key: string, rows: Item[]) => `${key} · ${rows.length} món`,
};

function Selectable() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = (ids: string[], checked: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      ids.forEach((id) => (checked ? n.add(id) : n.delete(id)));
      return n;
    });
  return (
    <DataTable
      data={ITEMS}
      columns={COLUMNS}
      emptyText="Trống"
      groupBy={GROUP_BY}
      selection={{ selected, onToggle: toggle, onToggleAll: toggleAll }}
    />
  );
}

function rowOf(text: string) {
  return screen.getByText(text).closest('tr')!;
}

describe('DataTable — nhóm dính', () => {
  it('groupBy dựng một dòng tiêu đề cho mỗi nhóm, theo thứ tự xuất hiện', () => {
    renderWithI18n(<DataTable data={ITEMS} columns={COLUMNS} emptyText="Trống" groupBy={GROUP_BY} />);
    const heads = screen.getAllByRole('rowheader').map((h) => h.textContent);
    expect(heads).toEqual([expect.stringContaining('Bút & viết · 2 món'), expect.stringContaining('Giấy & sổ · 1 món')]);
  });

  it('bấm chevron → aria-expanded="false" và ẩn hàng của nhóm, nhóm khác giữ nguyên', async () => {
    renderWithI18n(<DataTable data={ITEMS} columns={COLUMNS} emptyText="Trống" groupBy={GROUP_BY} />);
    const chevron = screen.getByRole('button', { name: 'Thu/mở nhóm Bút & viết · 2 món' });
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Bút bi xanh')).not.toBeInTheDocument();
    expect(screen.queryByText('Bút chì 2B')).not.toBeInTheDocument();
    expect(screen.getByText('Giấy A4')).toBeInTheDocument();
    await userEvent.click(chevron);
    expect(chevron).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Bút bi xanh')).toBeInTheDocument();
  });

  it('chọn 1/2 hàng của nhóm → checkbox nhóm lửng; chọn đủ 2/2 → checked', async () => {
    renderWithI18n(<Selectable />);
    const groupBox = screen.getByRole('checkbox', { name: 'Chọn nhóm Bút & viết · 2 món' }) as HTMLInputElement;
    expect(groupBox).not.toBeChecked();
    expect(groupBox.indeterminate).toBe(false);
    await userEvent.click(within(rowOf('Bút bi xanh')).getByRole('checkbox'));
    expect(groupBox.indeterminate).toBe(true);
    expect(groupBox).toBePartiallyChecked();
    await userEvent.click(within(rowOf('Bút chì 2B')).getByRole('checkbox'));
    expect(groupBox.indeterminate).toBe(false);
    expect(groupBox).toBeChecked();
  });

  it('bấm checkbox nhóm chọn đúng các hàng của nhóm; ô chọn tất cả thành lửng', async () => {
    renderWithI18n(<Selectable />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Chọn nhóm Bút & viết · 2 món' }));
    expect(within(rowOf('Bút bi xanh')).getByRole('checkbox')).toBeChecked();
    expect(within(rowOf('Bút chì 2B')).getByRole('checkbox')).toBeChecked();
    expect(within(rowOf('Giấy A4')).getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Chọn tất cả' })).toBePartiallyChecked();
  });
});

describe('DataTable — hàng active, mật độ, rỗng', () => {
  it('activeRowId → đúng hàng đó có aria-current="true", hàng khác không có', () => {
    renderWithI18n(<DataTable data={ITEMS} columns={COLUMNS} emptyText="Trống" activeRowId="b" />);
    expect(rowOf('Bút chì 2B')).toHaveAttribute('aria-current', 'true');
    expect(rowOf('Bút bi xanh')).not.toHaveAttribute('aria-current');
  });

  it('density="compact" khai báo trên bảng để CSS hạ hàng 52 → 44', () => {
    renderWithI18n(<DataTable data={ITEMS} columns={COLUMNS} emptyText="Trống" density="compact" />);
    expect(screen.getByRole('table')).toHaveAttribute('data-density', 'compact');
  });

  it('rỗng → EmptyState: tiêu đề, 1 câu gợi ý, 1 nút', () => {
    renderWithI18n(
      <DataTable
        data={[]}
        columns={COLUMNS}
        emptyText="Không có món nào khớp"
        empty={{ art: 'no-match', hint: 'Thử từ khóa khác.', action: <button type="button">Bỏ lọc</button> }}
      />,
    );
    expect(screen.getByText('Không có món nào khớp')).toBeInTheDocument();
    expect(screen.getByText('Thử từ khóa khác.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bỏ lọc' })).toBeInTheDocument();
  });
});
