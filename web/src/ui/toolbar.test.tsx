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
  it('"/" khi focus nằm trong hộp thoại → focus không rời hộp thoại', async () => {
    renderWithI18n(
      <>
        <Toolbar search={search()} />
        <div role="dialog" aria-label="Hộp"><button>Trong</button></div>
      </>,
    );
    screen.getByRole('button', { name: 'Trong' }).focus();
    await userEvent.keyboard('/');
    expect(screen.getByRole('button', { name: 'Trong' })).toHaveFocus();
  });
  it('không search → không ô tìm; children hiện', () => {
    renderWithI18n(<Toolbar><button>Lọc</button></Toolbar>);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lọc' })).toBeInTheDocument();
  });
  it('lead (bộ chọn kỳ) đứng trước ô tìm; children sau ô tìm', () => {
    renderWithI18n(<Toolbar lead={<button type="button">Kỳ</button>} search={search()}><button type="button">Xem</button></Toolbar>);
    const [lead, box, after] = [screen.getByRole('button', { name: 'Kỳ' }), screen.getByRole('searchbox'), screen.getByRole('button', { name: 'Xem' })];
    expect(lead.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(box.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('ô tìm .toolbar__search', () => {
  // Rà soát 13/11 #7: Giao hàng tự dựng <div className="toolbar__search"> → bấm phần đệm không focus ô
  it('mọi chỗ dùng lớp toolbar__search là thẻ label (bấm đâu trong khung cũng focus ô)', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join, relative } = await import('node:path');
    const src = join(process.cwd(), 'src');
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : /\.tsx$/.test(n) && !/\.test\.tsx$/.test(n) ? [join(d, n)] : []));
    const bad = walk(src).flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/<(\w+)[^>]*className="[^"]*\btoolbar__search\b/g)].filter((m) => m[1] !== 'label').map(() => relative(src, f)));
    expect(bad).toEqual([]);
  });
});
