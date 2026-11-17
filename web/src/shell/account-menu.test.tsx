import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent, waitFor, within } from '@/test/test-utils';
import { MeContext } from '@/lib/me';
import { makeMe } from '@/test/fixtures-me';
import { AccountMenu } from './account-menu';

afterEach(() => vi.unstubAllGlobals());

function Popover() {
  const [open, setOpen] = useState(false);
  return (
    <MeContext.Provider value={makeMe('member')}>
      <AccountMenu variant="popover" open={open} onOpenChange={setOpen} trigger={(p) => <button type="button" {...p}>Tên</button>} />
    </MeContext.Provider>
  );
}

describe('AccountMenu', () => {
  it('popover: nút mở có aria-expanded/aria-controls; hộp "Tài khoản" có họ tên, "Phòng · Vai trò", email, mã nhân viên', async () => {
    renderWithI18n(<Popover />);
    const btn = screen.getByRole('button', { name: 'Tên' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(btn);
    const box = screen.getByRole('dialog', { name: 'Tài khoản' });
    expect(btn).toHaveAttribute('aria-controls', box.id);
    expect(within(box).getByText('Nguyễn Văn An')).toBeInTheDocument();
    expect(within(box).getByText('Phòng Công trình')).toBeInTheDocument();
    expect(within(box).getByText('NV0231')).toBeInTheDocument();
  });

  it('popover: bấm nút lần nữa đóng; Esc đóng và trả focus về nút', async () => {
    renderWithI18n(<Popover />);
    const btn = screen.getByRole('button', { name: 'Tên' });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(btn);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(btn).toHaveFocus();
  });

  it('sheet: Esc gọi onOpenChange(false); dialog "Tài khoản" có nút Đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(
      <MeContext.Provider value={makeMe('member')}>
        <AccountMenu variant="sheet" open onOpenChange={onOpenChange} />
      </MeContext.Provider>,
    );
    const sheet = screen.getByRole('dialog', { name: 'Tài khoản' });
    expect(sheet).toHaveClass('sheet--bottom');
    expect(within(sheet).getByRole('button', { name: 'Đóng' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('câu mới không chứa " — "', async () => {
    const { default: i18n } = await import('@/lib/i18n');
    for (const lng of ['vi', 'en']) for (const k of ['profile.menu', 'profile.openMenu']) expect(i18n.t(k, { lng, name: 'A' })).not.toContain(' — ');
  });
});
