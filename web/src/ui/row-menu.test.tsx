import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowMenu } from './row-menu';

function setup(overrides: { disabledTitle?: string } = {}) {
  const edit = vi.fn();
  const stop = vi.fn();
  const remove = vi.fn();
  render(
    <>
      <button type="button">ngoài</button>
      <RowMenu
        label="Thao tác cho Bút"
        items={[
          { label: 'Sửa', onSelect: edit },
          { label: 'Ngừng', onSelect: stop, disabled: true, title: overrides.disabledTitle },
          { label: 'Xóa', onSelect: remove, danger: true },
        ]}
      />
    </>,
  );
  return { edit, stop, remove, trigger: screen.getByRole('button', { name: 'Thao tác cho Bút' }) };
}

describe('RowMenu', () => {
  it('nút mở có aria-haspopup="menu", aria-expanded theo trạng thái; bấm mở menu có nhãn và đủ mục', async () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu', { name: 'Thao tác cho Bút' })).toBeInTheDocument();
    expect(screen.getAllByRole('menuitem').map((m) => m.textContent)).toEqual(['Sửa', 'Ngừng', 'Xóa']);
  });

  it('bàn phím: Enter mở và focus mục đầu; ↓ ↑ Home End vòng quanh; Esc đóng và trả focus về nút', async () => {
    const { trigger } = setup();
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('menuitem', { name: 'Sửa' })).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Xóa' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Sửa' })).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Xóa' })).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Sửa' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('↓ trên nút cũng mở menu; Enter trên mục gọi onSelect và đóng menu', async () => {
    const { trigger, edit } = setup();
    trigger.focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Enter}');
    expect(edit).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('mục vô hiệu: aria-disabled, giữ title giải thích, bấm không gọi onSelect và menu vẫn mở', async () => {
    const { trigger, stop } = setup({ disabledTitle: 'Đang dùng' });
    await userEvent.click(trigger);
    const item = screen.getByRole('menuitem', { name: 'Ngừng' });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveAttribute('title', 'Đang dùng');
    await userEvent.click(item);
    expect(stop).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('mục danger có lớp nguy hiểm; mục thường không', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    expect(screen.getByRole('menuitem', { name: 'Xóa' })).toHaveClass('row-menu__item--danger');
    expect(screen.getByRole('menuitem', { name: 'Sửa' })).not.toHaveClass('row-menu__item--danger');
  });

  it('bấm ra ngoài đóng menu, không trả focus về nút', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'ngoài' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: 'ngoài' })).toHaveFocus();
  });

  it.each([
    ['nút sát mép trái (390, ⋯ đứng trước nút chính)', 16, 60, { left: '16px', right: '' }],
    ['nút ở mép phải (menu dòng bảng)', 300, 344, { left: '', right: '46px' }],
  ])('%s → menu không tràn ra ngoài màn hình', async (_case, left, right, expected) => {
    vi.stubGlobal('innerWidth', 390);
    const width = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(220);
    const { trigger } = setup();
    trigger.getBoundingClientRect = () => ({ left, right, top: 100, bottom: 140, width: right - left, height: 40, x: left, y: 100, toJSON: () => ({}) });
    await userEvent.click(trigger);
    const menu = screen.getByRole('menu');
    expect(menu.style.left).toBe(expected.left);
    expect(menu.style.right).toBe(expected.right);
    width.mockRestore();
    vi.unstubAllGlobals();
  });
});
