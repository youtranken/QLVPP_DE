import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderWithI18n as render, screen, userEvent, waitFor } from '@/test/test-utils';
import { useUrlPatch } from '@/lib/use-url-patch';
import { SearchBox } from './search-box';

function Harness() {
  const [q, setQ] = useState('ban dau');
  return (
    <>
      <SearchBox value={q} onChange={setQ} label="Tìm món" />
      <output aria-label="q">{q}</output>
      <button type="button" onClick={() => setQ('')}>
        reset
      </button>
    </>
  );
}

describe('SearchBox', () => {
  it('ô tìm có nhãn, giá trị đầu từ value; gõ → onChange sau debounce (đã trim)', async () => {
    render(<Harness />);
    const box = screen.getByRole('searchbox', { name: 'Tìm món' });
    expect(box).toHaveValue('ban dau');
    await userEvent.clear(box);
    await userEvent.type(box, ' kep ');
    await waitFor(() => expect(screen.getByLabelText('q')).toHaveTextContent(/^kep$/));
  });

  it('value đổi từ ngoài → ô đồng bộ', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'reset' }));
    expect(screen.getByRole('searchbox', { name: 'Tìm món' })).toHaveValue('');
  });

  // Danh mục: ô tìm của trang ghi ?q=, ô tìm trong panel Nhóm giữ chữ ở state riêng — ghi q của trang không đè chữ của panel
  it('ô state riêng (không urlParam) không bị ghi URL của ô khác đè chữ; ô gắn URL thì theo', async () => {
    function Page() {
      const [params, update] = useUrlPatch();
      const [local, setLocal] = useState('');
      return (
        <>
          <SearchBox urlParam="q" value={params.get('q') ?? ''} onChange={(v) => update({ q: v || null }, true)} label="Tìm trang" />
          <SearchBox value={local} onChange={setLocal} label="Tìm nhóm" />
          <button type="button" onClick={() => update({ q: 'kẹp' })}>
            ghi q
          </button>
        </>
      );
    }
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>,
    );
    await userEvent.type(screen.getByRole('searchbox', { name: 'Tìm nhóm' }), 'bút');
    await userEvent.click(screen.getByRole('button', { name: 'ghi q' }));
    expect(screen.getByRole('searchbox', { name: 'Tìm trang' })).toHaveValue('kẹp');
    expect(screen.getByRole('searchbox', { name: 'Tìm nhóm' })).toHaveValue('bút');
  });
});
