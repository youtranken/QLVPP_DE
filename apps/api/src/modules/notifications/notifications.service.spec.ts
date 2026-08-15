import { Logger } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Db } from '../../infra/db/db.module';
import { NotificationsService } from './notifications.service';

/**
 * Điều cần bảo vệ: **chuông hỏng không được làm hỏng nghiệp vụ**.
 *
 * Đã từng xảy ra thật — ghi thông báo lỗi khiến nhân viên nhận HTTP 500 dù đơn đã
 * lưu, bấm gửi lại thì bị báo "đã có đơn trong kỳ". Và khi không ai có vai trò
 * admin thì thông báo bị bỏ qua HOÀN TOÀN IM LẶNG, không có dấu vết để lần ra.
 */

interface TuyChon {
  admins?: { id: string }[];
  loiKhiDoc?: boolean;
  loiKhiGhi?: boolean;
}

/** Db giả, chỉ dựng đúng những mắt xích service dùng tới. */
function db({ admins = [], loiKhiDoc = false, loiKhiGhi = false }: TuyChon): {
  db: Db;
  daGhi: unknown[][];
} {
  const daGhi: unknown[][] = [];
  const gia = {
    select: () => ({
      from: () => ({
        where: () =>
          loiKhiDoc ? Promise.reject(new Error('CSDL mất kết nối')) : Promise.resolve(admins),
      }),
    }),
    insert: () => ({
      values: (rows: unknown[]) => {
        if (loiKhiGhi) return Promise.reject(new Error('vi phạm ràng buộc'));
        daGhi.push(rows);
        return Promise.resolve();
      },
    }),
  };
  return { db: gia as unknown as Db, daGhi };
}

const TIN = { type: 'request.submitted', title: 'Có đơn mới', body: 'x', requestId: 'r1' };

describe('NotificationsService — không bao giờ ném lỗi', () => {
  let loi: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    loi = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('gửi được thì ghi đúng một dòng cho mỗi admin', async () => {
    const { db: gia, daGhi } = db({ admins: [{ id: 'a1' }, { id: 'a2' }] });
    await new NotificationsService(gia).notifyAdmins(TIN);

    expect(daGhi).toHaveLength(1);
    expect(daGhi[0]).toHaveLength(2);
    expect(daGhi[0][0]).toMatchObject({ userId: 'a1', type: 'request.submitted' });
    expect(loi).not.toHaveBeenCalled();
  });

  it('bỏ qua chính người vừa thao tác', async () => {
    const { db: gia, daGhi } = db({ admins: [{ id: 'a1' }, { id: 'a2' }] });
    await new NotificationsService(gia).notifyAdmins(TIN, { exceptUserId: 'a1' });

    expect(daGhi[0]).toHaveLength(1);
    expect(daGhi[0][0]).toMatchObject({ userId: 'a2' });
  });

  it('chỉ có một admin và chính họ thao tác ⇒ không ghi gì, cũng KHÔNG báo lỗi', async () => {
    const { db: gia, daGhi } = db({ admins: [{ id: 'a1' }] });
    await new NotificationsService(gia).notifyAdmins(TIN, { exceptUserId: 'a1' });

    expect(daGhi).toHaveLength(0);
    // Đây là trường hợp bình thường, không phải sự cố — không được kêu.
    expect(loi).not.toHaveBeenCalled();
  });

  it('KHÔNG có admin nào ⇒ không ném lỗi nhưng phải GHI LOG mức error', async () => {
    const { db: gia } = db({ admins: [] });
    await expect(new NotificationsService(gia).notifyAdmins(TIN)).resolves.toBeUndefined();

    expect(loi).toHaveBeenCalledTimes(1);
    // Log phải chỉ thẳng nguyên nhân hay gặp nhất, không chỉ nói "có lỗi".
    expect(String(loi.mock.calls[0][0])).toContain('VPP_ADMIN_GROUP');
  });

  it('ghi thông báo lỗi ⇒ nuốt lỗi, có log — nghiệp vụ vẫn phải đi tiếp', async () => {
    const { db: gia } = db({ admins: [{ id: 'a1' }], loiKhiGhi: true });
    await expect(new NotificationsService(gia).notifyAdmins(TIN)).resolves.toBeUndefined();
    expect(loi).toHaveBeenCalledTimes(1);
  });

  it('đọc danh sách admin lỗi ⇒ cũng không được ném ra ngoài', async () => {
    const { db: gia } = db({ loiKhiDoc: true });
    await expect(new NotificationsService(gia).notifyAdmins(TIN)).resolves.toBeUndefined();
    expect(loi).toHaveBeenCalledTimes(1);
  });

  it('notify() cho một người cũng nuốt lỗi có log', async () => {
    const { db: gia } = db({ loiKhiGhi: true });
    await expect(
      new NotificationsService(gia).notify({ userId: 'u1', type: 't', title: 'x' }),
    ).resolves.toBeUndefined();
    expect(loi).toHaveBeenCalledTimes(1);
  });
});
