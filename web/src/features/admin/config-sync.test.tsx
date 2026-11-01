import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent } from '@/test/test-utils';
import { CONFIG, openConfig, putBodies, stubConfigApi } from './config-fixtures';

afterEach(() => vi.unstubAllGlobals());

const OTHER_ADMIN = { admin_group: 'nhom-khac', low_stock_notify: false };

async function retype(el: HTMLElement, value: string) {
  await userEvent.clear(el);
  await userEvent.type(el, value);
}

async function savePeriodWhileOtherAdminChanged() {
  const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...OTHER_ADMIN, ...body }));
  await openConfig();
  await retype(screen.getByLabelText('Tên và cách liên hệ Hành chính'), 'chị Hoa');
  await retype(screen.getByLabelText('Ngày hạn đăng ký hằng tháng'), '12');
  await userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
  await screen.findByText('Đã lưu Kỳ đăng ký');
  return fetchMock;
}

describe('Cấu hình · khối theo cấu hình mới nhất', () => {
  it('khối chưa sửa theo giá trị mới của cấu hình, không bị coi là chưa lưu', async () => {
    await savePeriodWhileOtherAdminChanged();
    expect(screen.getByLabelText('Nhóm PMH ID của Hành chính')).toHaveValue('nhom-khac');
    expect(screen.getByRole('button', { name: 'Lưu quyền Hành chính' })).toBeDisabled();
    expect(screen.getByText('1 khối chưa lưu')).toBeInTheDocument();
  });

  it('khối đang sửa giữ ô người dùng đã đổi, ô khác theo cấu hình mới; Lưu chỉ gửi ô đã đổi', async () => {
    const fetchMock = await savePeriodWhileOtherAdminChanged();
    expect(screen.getByLabelText('Tên và cách liên hệ Hành chính')).toHaveValue('chị Hoa');
    expect(screen.getByRole('switch', { name: 'Báo Hành chính khi món sắp hết' })).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu liên hệ' }));
    await vi.waitFor(() => expect(putBodies(fetchMock)).toHaveLength(2));
    expect(putBodies(fetchMock)[1]).toEqual({ admin_contact: 'chị Hoa' });
  });
});
