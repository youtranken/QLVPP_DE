import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { Dialog, DialogCloseButton, DialogTitle } from '@/ui/dialog';
import { ConfirmProvider } from '@/ui/confirm-provider';
import { renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';

function Harness({ dirty, onOpenChange }: { dirty: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <ConfirmProvider>
      <Dialog open onOpenChange={onOpenChange} dirty={dirty}>
        <DialogTitle>Sửa món</DialogTitle>
      </Dialog>
    </ConfirmProvider>
  );
}

describe('Dialog dirty guard', () => {
  it('không sửa dở: Esc đóng ngay', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness dirty={false} onOpenChange={onOpenChange} />);
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('đang sửa dở: Esc hỏi "Bỏ thay đổi?" — Ở lại giữ mở, Bỏ thay đổi mới đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<Harness dirty onOpenChange={onOpenChange} />);
    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('Bỏ thay đổi?')).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByText('Ở lại'));
    expect(onOpenChange).not.toHaveBeenCalled();

    await userEvent.keyboard('{Escape}');
    await userEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('Dialog closeOnOutside', () => {
  it('closeOnOutside=false: bấm nền không đóng; Esc vẫn đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(
      <Dialog open onOpenChange={onOpenChange} closeOnOutside={false}>
        <DialogTitle>T</DialogTitle>
      </Dialog>,
    );
    await userEvent.pointer({ keys: '[MouseLeft]', target: document.querySelector('.modal-backdrop')! });
    expect(onOpenChange).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('mặc định (closeOnOutside=true): bấm nền đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogTitle>T</DialogTitle>
      </Dialog>,
    );
    await userEvent.pointer({ keys: '[MouseLeft]', target: document.querySelector('.modal-backdrop')! });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('DialogCloseButton', () => {
  function CloseHarness({ disabled, onOpenChange }: { disabled?: boolean; onOpenChange: (o: boolean) => void }) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogTitle>Sửa món</DialogTitle>
        <DialogCloseButton disabled={disabled} />
      </Dialog>
    );
  }

  it('nút "Đóng" là biểu tượng SVG, không phải ký tự ✕, bấm thì đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<CloseHarness onOpenChange={onOpenChange} />);
    const btn = screen.getByRole('button', { name: 'Đóng' });
    expect(btn.querySelector('svg')).not.toBeNull();
    expect(btn).not.toHaveTextContent('✕');
    await userEvent.click(btn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('disabled: nút "Đóng" vô hiệu, bấm không đóng', async () => {
    const onOpenChange = vi.fn();
    renderWithI18n(<CloseHarness disabled onOpenChange={onOpenChange} />);
    const btn = screen.getByRole('button', { name: 'Đóng' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe('Dialog lồng', () => {
  it('hộp mở sau nằm sau trong DOM và được đánh dấu data-stacked; hộp đầu không; Esc chỉ đóng hộp trên', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    renderWithI18n(
      <Dialog open onOpenChange={outer}>
        <DialogTitle>Hộp ngoài</DialogTitle>
        <Dialog open onOpenChange={inner}>
          <DialogTitle>Hộp trong</DialogTitle>
        </Dialog>
      </Dialog>,
    );
    const [first, second] = screen.getAllByRole('dialog', { hidden: true });
    expect(first).toHaveAccessibleName('Hộp ngoài');
    expect(second).toHaveAccessibleName('Hộp trong');
    // Cùng z-index → thứ tự DOM quyết định lớp trên: lớp mờ + khung của hộp trong đứng sau hộp ngoài
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const backdrops = document.querySelectorAll('.modal-backdrop');
    expect(backdrops).toHaveLength(2);
    expect(first.compareDocumentPosition(backdrops[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(first).not.toHaveAttribute('data-stacked');
    expect(second).toHaveAttribute('data-stacked');
    await userEvent.keyboard('{Escape}');
    expect(inner).toHaveBeenCalledWith(false);
    expect(outer).not.toHaveBeenCalled();
  });

  it('base.css: .modal-backdrop và .dialog-viewport cùng z-index 50, lớp mờ không còn màu xanh rêu cũ', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync(`${process.cwd()}/src/css/base.css`, 'utf8');
    const z = (sel: string) => new RegExp(`^\\${sel} \\{[^}]*z-index: (\\d+)`, 'm').exec(css)?.[1];
    expect(z('.modal-backdrop')).toBe('50');
    expect(z('.dialog-viewport')).toBe('50');
    expect(css).not.toContain('rgba(20, 35, 28, .45)');
  });
});

describe('Dialog lồng: chỉ đếm hộp modal', () => {
  it('popover role=dialog không modal (bảng thông báo, menu tài khoản) đang mở → hộp không bị đánh dấu chồng', () => {
    renderWithI18n(
      <>
        <div role="dialog" aria-label="Thông báo" />
        <Dialog open onOpenChange={() => {}}>
          <DialogTitle>Hộp</DialogTitle>
        </Dialog>
      </>,
    );
    expect(screen.getByRole('dialog', { name: 'Hộp' })).not.toHaveAttribute('data-stacked');
  });

  it('hộp dưới đóng trong khi hộp trên còn mở → hộp trên bỏ đánh dấu chồng', async () => {
    function Two({ outer }: { outer: boolean }) {
      return (
        <>
          <Dialog open={outer} onOpenChange={() => {}}>
            <DialogTitle>Hộp dưới</DialogTitle>
          </Dialog>
          <Dialog open onOpenChange={() => {}}>
            <DialogTitle>Hộp trên</DialogTitle>
          </Dialog>
        </>
      );
    }
    const { rerender } = renderWithI18n(<Two outer />);
    expect(screen.getByRole('dialog', { name: 'Hộp trên', hidden: true })).toHaveAttribute('data-stacked');
    rerender(<Two outer={false} />);
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Hộp trên' })).not.toHaveAttribute('data-stacked'));
  });
});

describe('Dialog nằm trong form khác', () => {
  // React cho sự kiện submit nổi qua portal tới form tổ tiên: hộp "Sản phẩm mới" trong ngăn Điều chỉnh từng làm Lưu cả ngăn
  // (gửi thêm lượt duyệt "mua" chạy đua với lượt "Thêm vào danh mục" → LINE_ALREADY_REVIEWED)
  it('gửi form trong hộp không gửi form bên ngoài', async () => {
    const outer = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    const inner = vi.fn((e: { preventDefault: () => void }) => e.preventDefault());
    renderWithI18n(
      <form onSubmit={outer}>
        <Dialog open onOpenChange={() => undefined}>
          <DialogTitle>Sản phẩm mới</DialogTitle>
          <form onSubmit={inner}>
            <button type="submit">Mua và thêm vào danh mục</button>
          </form>
        </Dialog>
      </form>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mua và thêm vào danh mục' }));
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });
});

describe('Dialog trả focus về nút mở', () => {
  // Rà soát 13/11 #2: Điều chỉnh phiếu, Lịch sử nhập xuất, Xuất lẻ một món — đóng bằng Esc thì focus rơi về BODY
  // <main> không đặt tabIndex như khung thật cũ của Nhân viên: test không được che lỗi "#main không focus được"
  function Opener({ remountKey, show = true, autoFocusInside = true, twin = false }: { remountKey?: number; show?: boolean; autoFocusInside?: boolean; twin?: boolean }) {
    const [open, setOpen] = useState(false);
    return (
      <>
        <main id="main">
          {twin && (
            <button type="button" aria-label="Điều chỉnh phiếu của An">
              Điều chỉnh (người trùng tên)
            </button>
          )}
          {show && (
            <button key={remountKey} type="button" aria-label="Điều chỉnh phiếu của An" onClick={() => setOpen(true)}>
              Điều chỉnh
            </button>
          )}
        </main>
        {/* Hộp gắn có điều kiện, và ô trong hộp tự focus (autoFocus) trước khi FocusScope của Radix kịp ghi nhớ nút mở */}
        {open && (
          <Dialog open onOpenChange={(o) => !o && setOpen(false)}>
            <DialogTitle>Điều chỉnh</DialogTitle>
            <input aria-label="Món" autoFocus={autoFocusInside} />
          </Dialog>
        )}
      </>
    );
  }

  it('ô trong hộp tự focus khi mở: Esc → focus về nút mở, không rơi về BODY', async () => {
    renderWithI18n(<Opener />);
    const btn = screen.getByRole('button', { name: 'Điều chỉnh phiếu của An' });
    btn.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Món' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(btn).toHaveFocus());
  });

  it('nút mở bị render lại khi hộp đang mở (URL đổi ?request=/?item=): focus về nút mới cùng nhãn', async () => {
    const { rerender } = renderWithI18n(<Opener remountKey={1} />);
    const old = screen.getByRole('button', { name: 'Điều chỉnh phiếu của An' });
    old.focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('dialog');
    rerender(<Opener remountKey={2} />);
    const fresh = screen.getByRole('button', { name: 'Điều chỉnh phiếu của An', hidden: true });
    expect(fresh).not.toBe(old);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(fresh).toHaveFocus());
  });

  it('nút mở không còn: focus về vùng nội dung #main thay vì BODY', async () => {
    const { rerender } = renderWithI18n(<Opener />);
    screen.getByRole('button', { name: 'Điều chỉnh phiếu của An' }).focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('dialog');
    rerender(<Opener show={false} />);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.getElementById('main')).toHaveFocus());
  });

  it('nút mở không còn mà có hai nút cùng nhãn (trùng tên): không đoán hàng, focus về #main', async () => {
    const { rerender } = renderWithI18n(<Opener twin />);
    screen.getAllByRole('button', { name: 'Điều chỉnh phiếu của An' })[1]!.focus();
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('dialog');
    rerender(<Opener twin show={false} />);
    rerender(<Opener twin show />);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.getElementById('main')).toHaveFocus());
  });
});
