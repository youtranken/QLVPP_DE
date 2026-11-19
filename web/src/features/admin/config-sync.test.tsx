import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, screen, userEvent, within } from '@/test/test-utils';
import { CONFIG, block, openConfig, putBodies, stubConfigApi } from './config-fixtures';

afterEach(() => vi.unstubAllGlobals());

const OTHER_ADMIN = {
  signature_boxes: [
    { title: 'Chủ quản đơn vị', title_en: 'Head of Dept.', name: 'Trần Văn Cả' },
    { title: 'Người yêu cầu', title_en: 'Applicant', name: 'Lê Thị Bình' },
  ],
};

async function retype(el: HTMLElement, value: string) {
  await userEvent.clear(el);
  await userEvent.type(el, value);
}

async function savePeriodWhileOtherAdminChanged(editSigner: boolean) {
  const fetchMock = stubConfigApi((body) => jsonResponse(200, { ...CONFIG, ...OTHER_ADMIN, ...body }));
  await openConfig();
  if (editSigner) await retype(screen.getAllByLabelText('Người ký')[1], 'chị Hoa');
  await retype(screen.getByLabelText('Hạn đăng ký (ngày)'), '12');
  await userEvent.click(screen.getByRole('button', { name: 'Lưu kỳ đăng ký' }));
  await userEvent.click(await screen.findByRole('button', { name: 'Lưu hạn mới' }));
  await screen.findByText('Đã lưu Kỳ đăng ký');
  return fetchMock;
}

describe('Cấu hình · khối theo cấu hình mới nhất', () => {
  it('khối chưa sửa theo giá trị mới của cấu hình, không bị coi là chưa lưu', async () => {
    await savePeriodWhileOtherAdminChanged(false);
    expect(screen.getByDisplayValue('Trần Văn Cả')).toBeInTheDocument();
    expect(within(block('Ô ký trên phiếu đề xuất')).getByRole('button', { name: 'Chưa có thay đổi' })).toBeDisabled();
  });

  it('khối đang sửa giữ ô người dùng đã đổi sau khi khối khác lưu; Lưu gửi bản đang sửa', async () => {
    const fetchMock = await savePeriodWhileOtherAdminChanged(true);
    expect(screen.getAllByLabelText('Người ký')[1]).toHaveValue('chị Hoa');
    await userEvent.click(screen.getByRole('button', { name: 'Lưu ô ký' }));
    await vi.waitFor(() => expect(putBodies(fetchMock)).toHaveLength(2));
    expect(putBodies(fetchMock)[1]).toEqual({ signature_boxes: [CONFIG.signature_boxes[0], { ...CONFIG.signature_boxes[1], name: 'chị Hoa' }] });
  });
});
