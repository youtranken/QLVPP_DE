import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, screen, userEvent, within } from '@/test/test-utils';
import { UnregisteredTable } from './unregistered-table';
import { stubSummaryApi } from './summary-fixtures';

const renderTable = (canCreate: boolean) => {
  stubSummaryApi();
  const onCreate = vi.fn();
  renderWithI18n(<UnregisteredTable ym="2026-11" canCreate={canCreate} onCreate={onCreate} onClearFilter={() => {}} />);
  return onCreate;
};

afterEach(() => vi.unstubAllGlobals());

describe('UnregisteredTable — danh sách chưa đăng ký', () => {
  it('mỗi hàng: tên, phòng ban ("Chưa có phòng ban" khi null), nút "Tạo phiếu hộ" → onCreate(người)', async () => {
    const onCreate = renderTable(true);
    const ha = (await screen.findByText('Phạm Thu Hà')).closest('tr')!;
    expect(ha).toHaveTextContent('Phòng Công trình');
    expect((await screen.findByText('Lê Minh')).closest('tr')).toHaveTextContent('Chưa có phòng ban');
    expect(screen.getByText('Đang lọc: Chưa đăng ký · 2 người')).toBeInTheDocument();
    await userEvent.click(within(ha).getByRole('button', { name: 'Tạo phiếu hộ cho Phạm Thu Hà' }));
    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ sub: 'u-ha', fullName: 'Phạm Thu Hà', department: 'Phòng Công trình' }));
  });

  it('kỳ khóa: nút vô hiệu kèm chú thích "Kỳ đã khóa — không tạo phiếu mới được."', async () => {
    renderTable(false);
    const btn = await screen.findByRole('button', { name: 'Tạo phiếu hộ cho Phạm Thu Hà' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription('Kỳ đã khóa — không tạo phiếu mới được.');
  });
});
