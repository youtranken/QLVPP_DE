import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen } from '@/test/test-utils';
import { UnregisteredTable } from './unregistered-table';
import { stubSummaryApi } from './summary-fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('UnregisteredTable — danh sách chưa đăng ký', () => {
  it('đúng 2 cột (Người, Phòng ban); "Chưa có phòng ban" khi null; không nút nào trong bảng', async () => {
    stubSummaryApi();
    renderWithI18n(<UnregisteredTable ym="2026-10" onClearFilter={() => {}} />);
    const ha = (await screen.findByText('Phạm Thu Hà')).closest('tr')!;
    expect(ha).toHaveTextContent('Phòng Công trình');
    expect((await screen.findByText('Lê Minh')).closest('tr')).toHaveTextContent('Chưa có phòng ban');
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['Người', 'Phòng ban']);
    expect(screen.getByText('Đang lọc: Chưa đăng ký · 2 người')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Tạo phiếu/ })).toBeNull();
    expect(screen.queryByText(/không tạo phiếu mới/)).toBeNull();
  });
});
