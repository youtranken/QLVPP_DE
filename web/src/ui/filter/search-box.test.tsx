import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n as render, screen, userEvent, waitFor } from '@/test/test-utils';
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
});
