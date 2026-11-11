import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { SearchClear } from '@/ui/search-clear';
import { Toolbar } from '@/ui/toolbar';
import { SearchBox } from '@/ui/filter/search-box';
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

describe('SearchClear (B0.1)', () => {
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
