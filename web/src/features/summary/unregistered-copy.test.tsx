import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithI18n, screen, userEvent } from '@/test/test-utils';
import { UnregisteredCopy } from './unregistered-copy';

const LIST = {
  items: [
    { sub: 'u-1', full_name: 'Phạm Thu Hà', email: 'ha@pmh.com.vn', department: 'Phòng Công trình' },
    { sub: 'u-2', full_name: 'Lê Minh', email: 'minh@pmh.com.vn', department: null },
  ],
};
const TEXT = 'Chưa đăng ký VPP tháng 11 (hạn 23:59 ngày 10/11):\n- Phạm Thu Hà — Phòng Công trình\n- Lê Minh';

function stubList() {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) =>
      Promise.resolve(url === '/api/admin/periods/2026-11/unregistered' ? jsonResponse(200, LIST) : jsonResponse(500, {})),
    ),
  );
}

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

const renderCopy = (count = 2) =>
  renderWithI18n(<UnregisteredCopy ym="2026-11" deadline="2026-11-10T17:00:00.000Z" count={count} />);

afterEach(() => {
  vi.unstubAllGlobals();
  setClipboard(undefined);
});

describe('UnregisteredCopy — sao chép danh sách chưa đăng ký', () => {
  it('ghi đúng văn bản vào clipboard và báo "Đã sao chép 2 người"', async () => {
    stubList();
    const writeText = vi.fn(() => Promise.resolve());
    setClipboard({ writeText });
    renderCopy();
    await userEvent.click(screen.getByRole('button', { name: 'Sao chép danh sách chưa đăng ký (2)' }));
    expect(await screen.findByText('Đã sao chép 2 người')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(TEXT);
  });

  it('trình duyệt không có clipboard API → hộp hiện sẵn văn bản đã chọn để tự sao chép', async () => {
    stubList();
    setClipboard(undefined);
    renderCopy();
    await userEvent.click(screen.getByRole('button', { name: /Sao chép danh sách chưa đăng ký/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Danh sách chưa đăng ký' });
    const box = screen.getByRole('textbox', { name: 'Danh sách chưa đăng ký' }) as HTMLTextAreaElement;
    expect(dialog).toContainElement(box);
    expect(box.value).toBe(TEXT);
    expect(box.selectionStart).toBe(0);
    expect(box.selectionEnd).toBe(TEXT.length);
    expect(screen.queryByText(/Đã sao chép/)).toBeNull();
  });

  it('clipboard từ chối ghi (không cấp quyền) → cũng mở hộp tự sao chép', async () => {
    stubList();
    setClipboard({ writeText: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) });
    renderCopy();
    await userEvent.click(screen.getByRole('button', { name: /Sao chép danh sách chưa đăng ký/ }));
    expect(await screen.findByRole('dialog', { name: 'Danh sách chưa đăng ký' })).toBeInTheDocument();
  });

  it('không còn ai chưa đăng ký → nút bị vô hiệu', () => {
    stubList();
    renderCopy(0);
    expect(screen.getByRole('button', { name: 'Sao chép danh sách chưa đăng ký (0)' })).toBeDisabled();
  });
});
