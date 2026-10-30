import { describe, it, expect, vi } from 'vitest';
import { Toolbar } from '@/ui/toolbar';
import { renderWithI18n, screen, userEvent, fireEvent } from '@/test/test-utils';

const search = (over = {}) => ({ value: '', onChange: () => {}, label: 'Tìm món', ...over });

describe('Toolbar', () => {
  it('"/" khi focus ở body → focus vào ô tìm, ký tự "/" không bị gõ vào', async () => {
    renderWithI18n(<Toolbar search={search()} />);
    await userEvent.keyboard('/');
    expect(screen.getByRole('searchbox', { name: 'Tìm món' })).toHaveFocus();
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
  it('"/" khi đang gõ trong input khác → không chuyển focus, "/" được gõ vào ô đó', async () => {
    renderWithI18n(
      <>
        <Toolbar search={search()} />
        <input aria-label="Khác" />
      </>,
    );
    const other = screen.getByLabelText('Khác');
    other.focus();
    await userEvent.keyboard('a/');
    expect(other).toHaveFocus();
    expect(other).toHaveValue('a/');
  });
  it('"/" khi đang ở chính ô tìm → gõ bình thường', async () => {
    const onChange = vi.fn();
    renderWithI18n(<Toolbar search={search({ onChange })} />);
    await userEvent.click(screen.getByRole('searchbox'));
    await userEvent.keyboard('/');
    expect(onChange).toHaveBeenCalledWith('/');
  });
  it('gõ gọi onChange; maxLength và placeholder được áp', () => {
    const onChange = vi.fn();
    renderWithI18n(<Toolbar search={search({ onChange, maxLength: 80, placeholder: 'Tìm…' })} />);
    const box = screen.getByRole('searchbox');
    expect(box).toHaveAttribute('maxlength', '80');
    expect(box).toHaveAttribute('placeholder', 'Tìm…');
    fireEvent.change(box, { target: { value: 'bút' } });
    expect(onChange).toHaveBeenCalledWith('bút');
  });
  it('không search → không ô tìm; children hiện', () => {
    renderWithI18n(<Toolbar><button>Lọc</button></Toolbar>);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lọc' })).toBeInTheDocument();
  });
});
