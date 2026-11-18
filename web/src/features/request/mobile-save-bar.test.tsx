import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { MobileSaveBar } from './mobile-save-bar';

const bar = (canSave: boolean) =>
  render(
    <MobileSaveBar count={3} units={7} savedTime={canSave ? null : '18:32'} dirtyCount={canSave ? 1 : 0} openRef={createRef()} saveRef={createRef()} canSave={canSave} onOpen={() => {}} onSave={() => {}} />,
  );

describe('MobileSaveBar — nút Lưu phiếu khóa có lý do', () => {
  it('chưa có thay đổi → nút Lưu phiếu aria-disabled, mô tả là dòng trạng thái thấy được "… · Đã lưu"', () => {
    bar(false);
    const save = screen.getByRole('button', { name: /Lưu phiếu/ });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    expect(save).toHaveAccessibleDescription(/Đã lưu/);
  });

  it('có thay đổi → không mô tả khóa', () => {
    bar(true);
    expect(screen.getByRole('button', { name: /Lưu phiếu/ })).not.toHaveAccessibleDescription(/Đã lưu/);
  });

  it('dòng phụ: đã lưu → "7 đơn vị · Đã lưu 18:32"; có thay đổi → chỉ "7 đơn vị", không "· Chưa lưu"', () => {
    const { unmount } = bar(false);
    expect(screen.getByText('7 đơn vị · Đã lưu 18:32')).toBeInTheDocument();
    unmount();
    bar(true);
    expect(screen.getByText('7 đơn vị')).toBeInTheDocument();
    expect(screen.queryByText(/Chưa lưu/)).toBeNull();
  });
});
