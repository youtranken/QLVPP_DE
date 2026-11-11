import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { SearchClear } from '@/ui/search-clear';
import { Toolbar } from '@/ui/toolbar';
import { SearchBox } from '@/ui/filter/search-box';
import { DataTable } from '@/ui/data-table';
import { UserPicker } from '@/features/directory/user-picker';
import i18n from '@/lib/i18n';

function Harness({ initial = '' }: { initial?: string }) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  return (
    <label>
      <input ref={ref} type="search" aria-label="Tìm" value={v} onChange={(e) => setV(e.target.value)} />
      <SearchClear value={v} onClear={() => setV('')} inputRef={ref} />
    </label>
  );
}

describe('SearchClear', () => {
  it('ô trống → không có nút xóa', () => {
    renderWithI18n(<Harness />);
    expect(screen.queryByRole('button', { name: 'Xóa chữ tìm' })).toBeNull();
  });

  it('gõ chữ → hiện nút có aria-label i18n; bấm → xóa chữ, nút biến mất, focus về ô tìm', async () => {
    renderWithI18n(<Harness />);
    const box = screen.getByRole('searchbox', { name: 'Tìm' });
    await userEvent.type(box, 'bút bi');
    const clear = screen.getByRole('button', { name: 'Xóa chữ tìm' });
    expect(clear).toHaveAttribute('type', 'button');
    expect(clear).toHaveClass('search-clear');
    // Vòng tròn vẽ ở phần tử con, hộp nút là vùng chạm 44×44
    expect(clear.querySelector('.search-clear-dot')).not.toBeNull();
    await userEvent.click(clear);
    expect(box).toHaveValue('');
    expect(screen.queryByRole('button', { name: 'Xóa chữ tìm' })).toBeNull();
    expect(box).toHaveFocus();
  });

  it('bấm nút trong <label> không bị chuyển thành click vào ô (gọi onClear đúng 1 lần)', async () => {
    const onClear = vi.fn();
    renderWithI18n(
      <label>
        <input type="search" aria-label="Tìm" defaultValue="a" />
        <SearchClear value="a" onClear={onClear} />
      </label>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Xóa chữ tìm' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('tiếng Anh → aria-label "Clear search"', async () => {
    await i18n.changeLanguage('en');
    try {
      renderWithI18n(<SearchClear value="x" onClear={() => {}} />);
      expect(screen.getByRole('button', { name: 'Clear search' })).toBeInTheDocument();
    } finally {
      await i18n.changeLanguage('vi');
    }
  });

  it('Toolbar: có chữ → nút xóa gọi onChange("")', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Toolbar search={{ value: 'kẹp', onChange, label: 'Tìm món' }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa chữ tìm' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('searchbox', { name: 'Tìm món' })).toHaveFocus();
  });

  it('SearchBox (lọc theo URL): bấm xóa → ô trống ngay, đẩy q rỗng sau debounce', async () => {
    function Box() {
      const [q, setQ] = useState('giấy');
      return (
        <>
          <SearchBox value={q} onChange={setQ} label="Tìm món" className="flt-search" />
          <output aria-label="q">{q}</output>
        </>
      );
    }
    renderWithI18n(<Box />);
    await userEvent.click(screen.getByRole('button', { name: 'Xóa chữ tìm' }));
    expect(screen.getByRole('searchbox', { name: 'Tìm món' })).toHaveValue('');
    await waitFor(() => expect(screen.getByLabelText('q')).toHaveTextContent(/^$/));
  });
});

// Luật chừa chỗ nút X ở css/base.css; độ ưu tiên so với luật của ô kiểm ở test/search-clear-room.test.ts
const ROOM = "[data-shell] .search-wrap > input[type='search']";
const LONG = 'giấy in A4 định lượng 80gsm loại dày cho máy in laser văn phòng';

describe('ô tìm dùng .search-wrap nhận luật chừa chỗ nút X khi chữ dài', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.body.dataset.shell;
  });

  it('DataTable', async () => {
    document.body.dataset.shell = 'admin';
    renderWithI18n(<DataTable data={[{ id: 1, name: 'Bút' }]} columns={[{ accessorKey: 'name', header: 'Tên' }]} searchPlaceholder="Tìm trong bảng" emptyText="Trống" />);
    const box = screen.getByRole('searchbox', { name: 'Tìm trong bảng' });
    await userEvent.type(box, LONG);
    expect(screen.getByRole('button', { name: 'Xóa chữ tìm' })).toBeInTheDocument();
    expect(box.matches(ROOM)).toBe(true);
  });

  it('UserPicker', async () => {
    document.body.dataset.shell = 'admin';
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(200, { items: [], next_cursor: null }))));
    renderWithI18n(<UserPicker label="Người nhận" searchLabel="Tìm người nhận" value={null} onChange={vi.fn()} />);
    const box = screen.getByRole('searchbox', { name: 'Tìm người nhận' });
    await userEvent.type(box, LONG);
    expect(screen.getByRole('button', { name: 'Xóa chữ tìm' })).toBeInTheDocument();
    expect(box.matches(ROOM)).toBe(true);
  });
});
