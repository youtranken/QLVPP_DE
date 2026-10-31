import { afterEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { jsonResponse, renderWithI18n, screen, userEvent, waitFor } from '@/test/test-utils';
import { ToastProvider } from '@/ui/toast-provider';
import { UnregisteredCopy } from './unregistered-copy';
import { UNREGISTERED } from './summary-fixtures';

const TEXT = 'Chưa đăng ký VPP tháng 11 (hạn 23:59 ngày 10):\n- Phạm Thu Hà (Phòng Công trình)\n- Lê Minh';

function stubList(status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(url === '/api/admin/periods/2026-11/unregistered' && status === 200 ? jsonResponse(200, { items: UNREGISTERED }) : jsonResponse(500, {})),
    ),
  );
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

const renderCopy = (count = 2) =>
  renderWithI18n(
    <ToastProvider>
      <UnregisteredCopy ym="2026-11" deadline="2026-11-10T17:00:00.000Z" count={count} />
    </ToastProvider>,
  );

afterEach(() => {
  vi.unstubAllGlobals();
  setClipboard(undefined);
});

describe('UnregisteredCopy — sao chép danh sách chưa đăng ký', () => {
  it('clipboard.writeText nhận đúng chuỗi SPEC → toast "Đã sao chép 2 người"', async () => {
    stubList();
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    renderCopy();
    await userEvent.click(screen.getByRole('button', { name: 'Sao chép danh sách chưa đăng ký (2)' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đã sao chép 2 người'));
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it('không có clipboard API → hộp thoại B1c, văn bản chọn sẵn, gợi ý Ctrl+C', async () => {
    stubList();
    renderCopy();
    await userEvent.click(screen.getByRole('button', { name: /Sao chép danh sách chưa đăng ký/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Danh sách chưa đăng ký' });
    const box = screen.getByRole('textbox', { name: 'Danh sách chưa đăng ký' }) as HTMLTextAreaElement;
    expect(dialog).toContainElement(box);
    expect(dialog).toHaveTextContent('nhấn Ctrl+C rồi dán vào nhóm chat');
    expect(box.value).toBe(TEXT);
    expect(box.selectionStart).toBe(0);
    expect(box.selectionEnd).toBe(TEXT.length);
  });

  it('clipboard reject (không cấp quyền) → hộp thoại B1c, không toast', async () => {
    stubList();
    setClipboard({ writeText: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) });
    renderCopy();
    await userEvent.click(screen.getByRole('button', { name: /Sao chép danh sách chưa đăng ký/ }));
    expect(await screen.findByRole('dialog', { name: 'Danh sách chưa đăng ký' })).toBeInTheDocument();
    expect(screen.queryByText(/Đã sao chép/)).toBeNull();
  });

  it('tải danh sách lỗi → câu lỗi tại nút (role=alert), không toast', async () => {
    stubList(500);
    setClipboard({ writeText: vi.fn(() => Promise.resolve()) });
    renderCopy();
    await userEvent.click(screen.getByRole('button', { name: /Sao chép danh sách chưa đăng ký/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Chưa tải được danh sách. Thử lại sau.');
  });

  it('n=0 → nút vô hiệu, chú thích "Mọi người đã đăng ký"; n=1 → bật', () => {
    stubList();
    const { unmount } = renderCopy(0);
    const btn = screen.getByRole('button', { name: 'Sao chép danh sách chưa đăng ký (0)' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription('Mọi người đã đăng ký');
    unmount();
    renderCopy(1);
    expect(screen.getByRole('button', { name: 'Sao chép danh sách chưa đăng ký (1)' })).toBeEnabled();
    expect(screen.queryByText('Mọi người đã đăng ký')).toBeNull();
  });

  it('giao diện tiếng Anh vẫn sao chép văn bản tiếng Việt', async () => {
    stubList();
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    await i18n.changeLanguage('en');
    try {
      renderCopy();
      await userEvent.click(screen.getByRole('button', { name: 'Copy not-submitted list (2)' }));
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Copied 2 people'));
      expect(writeText).toHaveBeenCalledWith(TEXT);
    } finally {
      await i18n.changeLanguage('vi');
    }
  });
});
