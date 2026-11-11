import { describe, it, expect, vi } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import {
  renderWithI18n,
  screen,
  within,
  waitFor,
  userEvent,
} from '@/test/test-utils';

interface Row {
  name: string;
  qty: number;
}
const DATA: Row[] = [
  { name: 'Banana', qty: 3 },
  { name: 'apple', qty: 10 },
  { name: 'Cherry', qty: 1 },
];
const COLUMNS: ColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Tên' },
  { accessorKey: 'qty', header: 'SL' },
  { id: 'act', header: 'Hành động', enableSorting: false, cell: () => <button>x</button> },
];

/** Tên ở cột đầu của từng dòng body (bỏ dòng header). */
function rowNames(): (string | null)[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0].textContent);
}

describe('DataTable', () => {
  it('meta.width ở một cột → table--fixed + colgroup đủ cột (cột không đặt để trống); không cột nào đặt → không colgroup', () => {
    const cols: ColumnDef<Row>[] = [
      { accessorKey: 'name', header: 'Tên' },
      { accessorKey: 'qty', header: 'SL', meta: { width: '12%' } },
      { id: 'act', header: 'Hành động', meta: { width: '56px' }, cell: () => <button>x</button> },
    ];
    const { unmount } = renderWithI18n(<DataTable data={DATA} columns={cols} emptyText="Trống" />);
    const table = screen.getByRole('table');
    expect(table).toHaveClass('table--fixed');
    expect([...table.querySelectorAll('colgroup > col')].map((c) => (c as HTMLElement).style.width)).toEqual(['', '12%', '56px']);
    unmount();
    renderWithI18n(<DataTable data={DATA} columns={COLUMNS} emptyText="Trống" />);
    expect(screen.getByRole('table')).not.toHaveClass('table--fixed');
    expect(screen.getByRole('table').querySelector('colgroup')).toBeNull();
  });

  it('rowProps gắn thuộc tính lên dòng dữ liệu (dòng mở rộng bằng bàn phím: tabIndex, aria-expanded, onKeyDown)', async () => {
    const onKeyDown = vi.fn();
    renderWithI18n(<DataTable data={DATA} columns={COLUMNS} emptyText="Trống" rowProps={(r) => ({ tabIndex: 0, 'aria-expanded': r.name === 'apple', onKeyDown })} />);
    const banana = screen.getByText('Banana').closest('tr')!;
    expect(banana).toHaveAttribute('tabindex', '0');
    expect(banana).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('apple').closest('tr')).toHaveAttribute('aria-expanded', 'true');
    banana.focus();
    await userEvent.keyboard('{Enter}');
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('ô xếp chồng 390: đầu cột là component thì nhãn ô lấy từ meta.label, đầu cột chuỗi giữ chuỗi', () => {
    const cols: ColumnDef<Row>[] = [
      { accessorKey: 'name', header: 'Tên' },
      { accessorKey: 'qty', header: () => <span>SL <button type="button">i</button></span>, meta: { label: 'SL' }, enableSorting: false },
    ];
    renderWithI18n(<DataTable data={DATA} columns={cols} emptyText="Trống" stackOnMobile />);
    const cells = within(screen.getAllByRole('row')[1]).getAllByRole('cell');
    expect(cells.map((c) => c.getAttribute('data-label'))).toEqual(['Tên', 'SL']);
  });

  it('render đủ dòng + cột', () => {
    renderWithI18n(<DataTable data={DATA} columns={COLUMNS} emptyText="Trống" />);
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(rowNames()).toEqual(['Banana', 'apple', 'Cherry']);
  });

  it('bấm header cột sắp xếp: asc → desc → về nguyên bản', async () => {
    renderWithI18n(<DataTable data={DATA} columns={COLUMNS} emptyText="Trống" />);
    const slHeader = screen.getByRole('button', { name: /SL/ });
    await userEvent.click(slHeader);
    expect(rowNames()).toEqual(['Cherry', 'Banana', 'apple']); // 1,3,10
    await userEvent.click(slHeader);
    expect(rowNames()).toEqual(['apple', 'Banana', 'Cherry']); // 10,3,1
    await userEvent.click(slHeader);
    expect(rowNames()).toEqual(['Banana', 'apple', 'Cherry']); // nguyên bản
  });

  it('th mang aria-sort phản ánh trạng thái sắp xếp', async () => {
    renderWithI18n(<DataTable data={DATA} columns={COLUMNS} emptyText="Trống" />);
    const slHeaderCell = screen.getByText('SL').closest('th')!;
    expect(slHeaderCell).not.toHaveAttribute('aria-sort');
    await userEvent.click(screen.getByRole('button', { name: /SL/ }));
    expect(slHeaderCell).toHaveAttribute('aria-sort', 'ascending');
  });

  it('cột enableSorting=false không cho bấm sắp xếp', async () => {
    renderWithI18n(<DataTable data={DATA} columns={COLUMNS} emptyText="Trống" />);
    // header "Hành động" không được bọc trong button
    expect(screen.getByText('Hành động').closest('button')).toBeNull();
  });

  it('ô tìm kiếm lọc dòng theo nội dung (debounce)', async () => {
    renderWithI18n(
      <DataTable
        data={DATA}
        columns={COLUMNS}
        emptyText="Trống"
        searchPlaceholder="Tìm"
      />,
    );
    await userEvent.type(screen.getByLabelText('Tìm'), 'app');
    // apple luôn hiện kể cả trước khi lọc → phải đợi Banana biến mất sau debounce
    await waitFor(() =>
      expect(screen.queryByText('Banana')).not.toBeInTheDocument(),
    );
    expect(rowNames()).toEqual(['apple']);
  });

  it('data rỗng → hiện emptyText, ẩn đầu bảng (không còn tiêu đề cột trơ trọi)', () => {
    renderWithI18n(<DataTable data={[]} columns={COLUMNS} emptyText="Chưa có dữ liệu" />);
    expect(screen.getByText('Chưa có dữ liệu')).toBeInTheDocument();
    expect(screen.queryAllByRole('columnheader')).toHaveLength(0);
  });

  it('1 dòng → đầu bảng hiện; đang tải (chưa có dòng) → đầu bảng vẫn hiện', () => {
    const { unmount } = renderWithI18n(<DataTable data={DATA.slice(0, 1)} columns={COLUMNS} emptyText="Trống" />);
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
    unmount();
    renderWithI18n(<DataTable data={[]} columns={COLUMNS} emptyText="Trống" loading />);
    expect(screen.getAllByRole('columnheader').length).toBeGreaterThan(0);
  });

  it('rowClassName gán class <tr> theo dữ liệu dòng', () => {
    renderWithI18n(
      <DataTable
        data={DATA}
        columns={COLUMNS}
        emptyText="Trống"
        rowClassName={(r) => (r.qty > 5 ? 'hot' : '')}
      />,
    );
    expect(screen.getByText('apple').closest('tr')).toHaveClass('hot');
    expect(screen.getByText('Banana').closest('tr')).not.toHaveClass('hot');
  });

  it('manualSorting: bấm header gọi onSortingChange, không sắp client', async () => {
    const onSortingChange = vi.fn();
    renderWithI18n(
      <DataTable
        data={DATA}
        columns={COLUMNS}
        emptyText="Trống"
        manualSorting
        sorting={[]}
        onSortingChange={onSortingChange}
      />,
    );
    expect(rowNames()).toEqual(['Banana', 'apple', 'Cherry']);
    await userEvent.click(screen.getByRole('button', { name: /SL/ }));
    expect(onSortingChange).toHaveBeenCalled();
    // server trả data đã sắp, client không tự sắp
    expect(rowNames()).toEqual(['Banana', 'apple', 'Cherry']);
  });

  it('onRowClick: bấm dòng gọi callback; nút stopPropagation thì không', async () => {
    const onRowClick = vi.fn();
    const cols: ColumnDef<Row>[] = [
      { accessorKey: 'name', header: 'Tên' },
      {
        id: 'act',
        header: '',
        enableSorting: false,
        cell: () => <button onClick={(e) => e.stopPropagation()}>x</button>,
      },
    ];
    renderWithI18n(
      <DataTable data={DATA} columns={cols} emptyText="Trống" onRowClick={onRowClick} />,
    );
    await userEvent.click(screen.getByText('Banana'));
    expect(onRowClick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Banana' }),
    );
    onRowClick.mockClear();
    await userEvent.click(screen.getAllByText('x')[0]);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('tableClassName nối thêm vào <table>', () => {
    const { container } = renderWithI18n(
      <DataTable
        data={DATA}
        columns={COLUMNS}
        emptyText="Trống"
        tableClassName="board-table"
      />,
    );
    expect(container.querySelector('table')).toHaveClass('table', 'board-table');
  });
  it('busy → table aria-busy "true"/"false"; không truyền thì không có thuộc tính', () => {
    const { rerender } = renderWithI18n(<DataTable data={DATA} columns={COLUMNS} emptyText="Trống" busy />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    rerender(<DataTable data={DATA} columns={COLUMNS} emptyText="Trống" busy={false} />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'false');
    rerender(<DataTable data={DATA} columns={COLUMNS} emptyText="Trống" />);
    expect(screen.getByRole('table')).not.toHaveAttribute('aria-busy');
  });

  it('expandedRow trả nội dung → một hàng chiếm đủ cột ngay dưới hàng đó; trả null thì không thêm hàng', () => {
    renderWithI18n(
      <DataTable data={DATA} columns={COLUMNS} emptyText="Trống" expandedRow={(r) => (r.name === 'apple' ? <p>Chi tiết apple</p> : null)} />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows).toHaveLength(4);
    const cell = within(rows[2]).getByRole('cell');
    expect(cell).toHaveAttribute('colspan', '3');
    expect(cell).toHaveTextContent('Chi tiết apple');
    expect(within(rows[1]).getAllByRole('cell')[0]).toHaveTextContent('apple');
  });
});

describe('DataTable ô trống', () => {
  it('ô dữ liệu không có giá trị → td[data-empty] hiện "—" (aria-hidden) + chữ ẩn "Chưa có"; cột không tên để trống', () => {
    const cols: ColumnDef<{ name: string; note?: string }>[] = [
      { accessorKey: 'name', header: 'Tên' },
      { accessorKey: 'note', header: 'Ghi chú' },
      { id: 'act', header: '', cell: () => null },
    ];
    renderWithI18n(<DataTable data={[{ name: 'Bút' }, { name: 'Giấy', note: 'A4' }]} columns={cols} emptyText="Trống" />);
    const [first, second] = screen.getAllByRole('row').slice(1);
    const note = within(first).getAllByRole('cell')[1];
    expect(note).toHaveAttribute('data-empty');
    expect(within(note).getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(within(note).getByText('Chưa có')).toHaveClass('sr-only');
    const act = within(first).getAllByRole('cell')[2];
    expect(act).not.toHaveAttribute('data-empty');
    expect(act).toBeEmptyDOMElement();
    expect(within(second).getAllByRole('cell')[1]).toHaveTextContent('A4');
    expect(within(second).getAllByRole('cell')[1]).not.toHaveAttribute('data-empty');
  });

  it('ô tự vẽ (cell riêng) giữ nguyên nội dung kể cả khi giá trị trống', () => {
    const cols: ColumnDef<{ name: string; note?: string }>[] = [
      { accessorKey: 'name', header: 'Tên' },
      { accessorKey: 'note', header: 'Ghi chú', cell: () => <button type="button">Thêm ghi chú</button> },
    ];
    renderWithI18n(<DataTable data={[{ name: 'Bút' }]} columns={cols} emptyText="Trống" />);
    const note = within(screen.getAllByRole('row')[1]).getAllByRole('cell')[1];
    expect(note).not.toHaveAttribute('data-empty');
    expect(within(note).getByRole('button', { name: 'Thêm ghi chú' })).toBeInTheDocument();
  });

  it('nhận ô mặc định qua defaultColumn, không dò API riêng của TanStack', async () => {
    const { readFileSync } = await import('node:fs');
    const row = readFileSync(`${process.cwd()}/src/ui/data-table-row.tsx`, 'utf8');
    const table = readFileSync(`${process.cwd()}/src/ui/data-table.tsx`, 'utf8');
    expect(row).not.toContain('_getDefaultColumnDef');
    expect(table).toContain('defaultColumn: { cell: EmptyAwareCell }');
  });
});
