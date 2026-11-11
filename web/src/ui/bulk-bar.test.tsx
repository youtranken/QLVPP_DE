import { afterEach, describe, it, expect, vi } from 'vitest';
import { BulkBar } from '@/ui/bulk-bar';
import { renderWithI18n, screen, userEvent } from '@/test/test-utils';

describe('BulkBar', () => {
  it('count=0 → không render', () => {
    renderWithI18n(<BulkBar count={0} label="món" onClear={() => {}} />);
    expect(screen.queryByRole('toolbar')).toBeNull();
  });
  it('count=1 là biên dưới → render "1 món đã chọn"', () => {
    renderWithI18n(<BulkBar count={1} label="món" onClear={() => {}} />);
    expect(screen.getByRole('toolbar')).toHaveTextContent('1 món đã chọn');
  });
  it('count=2 → toolbar "2 món đã chọn", hành động hiện, Bỏ chọn gọi onClear', async () => {
    const onClear = vi.fn();
    renderWithI18n(
      <BulkBar count={2} label="món" onClear={onClear}>
        <button>Ngừng</button>
      </BulkBar>,
    );
    expect(screen.getByRole('toolbar')).toHaveTextContent('2 món đã chọn');
    expect(screen.getByRole('button', { name: 'Ngừng' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
  it('biến thể light: class bulk-bar--light (không nền tối); "Bỏ chọn" là nút ghost', () => {
    renderWithI18n(<BulkBar count={2} label="món" variant="light" onClear={() => {}} />);
    expect(screen.getByRole('toolbar')).toHaveClass('bulk-bar--light');
    expect(screen.getByRole('button', { name: 'Bỏ chọn' })).toHaveClass('btn', 'btn--ghost', 'btn--sm');
  });

  it('biến thể mặc định vẫn tối, "Bỏ chọn" không phải btn', () => {
    renderWithI18n(<BulkBar count={2} label="món" onClear={() => {}} />);
    expect(screen.getByRole('toolbar')).not.toHaveClass('bulk-bar--light');
    expect(screen.getByRole('button', { name: 'Bỏ chọn' })).not.toHaveClass('btn');
  });
});

describe('BulkBar sticky: chừa chỗ ở đáy khung trang', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete document.body.dataset.shell;
    document.body.style.removeProperty('--bulkbar-h');
  });

  const heightByClass = () =>
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this.classList.contains('tall') ? 80 : 40;
    });

  it('sticky → đặt --bulkbar-h trên phần tử khung (data-shell), không trên <html>; gỡ bar thì gỡ biến', () => {
    heightByClass();
    document.body.dataset.shell = 'admin';
    const { unmount } = renderWithI18n(<BulkBar sticky count={2} label="món" onClear={() => {}} />);
    expect(screen.getByRole('toolbar')).toHaveClass('is-sticky-bottom');
    expect(document.body.style.getPropertyValue('--bulkbar-h')).toBe('60px');
    expect(document.documentElement.style.getPropertyValue('--bulkbar-h')).toBe('');
    unmount();
    expect(document.body.style.getPropertyValue('--bulkbar-h')).toBe('');
  });

  it('không sticky → không đặt biến, dù className có chữ is-sticky-bottom', () => {
    renderWithI18n(<BulkBar count={2} label="món" className="is-sticky-bottom" onClear={() => {}} />);
    expect(document.body.style.getPropertyValue('--bulkbar-h')).toBe('');
  });

  it('hai bar sticky: biến = bar cao nhất; gỡ một bar (bất kể thứ tự) thì biến theo bar còn lại', () => {
    heightByClass();
    function Two({ a, b }: { a: boolean; b: boolean }) {
      return (
        <>
          {a && <BulkBar sticky className="tall" count={1} label="món" onClear={() => {}} />}
          {b && <BulkBar sticky count={1} label="món" onClear={() => {}} />}
        </>
      );
    }
    const { rerender } = renderWithI18n(<Two a b />);
    expect(document.body.style.getPropertyValue('--bulkbar-h')).toBe('100px');
    rerender(<Two a={false} b />);
    expect(document.body.style.getPropertyValue('--bulkbar-h')).toBe('60px');
    rerender(<Two a b />);
    rerender(<Two a b={false} />);
    expect(document.body.style.getPropertyValue('--bulkbar-h')).toBe('100px');
    rerender(<Two a={false} b={false} />);
    expect(document.body.style.getPropertyValue('--bulkbar-h')).toBe('');
  });
});
