import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { MobileSaveBar } from './mobile-save-bar';

const bar = (dirty: boolean, dirtyCount = dirty ? 1 : 0) =>
  render(
    <MobileSaveBar
      count={3}
      units={7}
      savedTime={dirty ? null : '18:32'}
      dirtyCount={dirtyCount}
      openRef={createRef()}
      canSave={dirty}
      onOpen={() => {}}
      onSave={() => {}}
    />,
  );

describe('MobileSaveBar', () => {
  it('phiếu đã lưu, không đổi gì → không có nút "Lưu phiếu" (không nút mờ); còn "Xem phiếu (3 món)"', () => {
    bar(false);
    expect(screen.queryByRole('button', { name: /Lưu phiếu/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Xem phiếu (3 món)' })).toBeInTheDocument();
  });

  it('có thay đổi → nút ghi đúng "Lưu phiếu" một dòng; số thay đổi chỉ còn cho trình đọc màn hình', () => {
    bar(true);
    const save = screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' });
    const visible = [...save.childNodes].filter((n) => !(n instanceof HTMLElement && n.classList.contains('sr-only'))).map((n) => n.textContent).join('').trim();
    expect(visible).toBe('Lưu phiếu');
  });

  it('biên số thay đổi: 1 và 2 đều chỉ ghi "Lưu phiếu" trên nút', () => {
    const { unmount } = bar(true, 1);
    expect(screen.getByRole('button', { name: '1 thay đổi chưa lưu · Lưu phiếu' })).toBeInTheDocument();
    unmount();
    bar(true, 2);
    expect(screen.getByRole('button', { name: '2 thay đổi chưa lưu · Lưu phiếu' })).toBeInTheDocument();
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
