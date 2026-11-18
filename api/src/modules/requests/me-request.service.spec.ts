import { MeRequestService } from './me-request.service';
import { periodLocked } from './request-errors';

const NOW = new Date('2026-11-10T16:59:59.999Z');
const ME = { sub: 'u-a', role: 'member' } as never;

function build(save: jest.Mock) {
  const tx = { tag: 'tx' };
  const db = { transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)) };
  const clock = { now: jest.fn(() => NOW) };
  const views = { build: jest.fn().mockResolvedValue({ id: 'r-1' }) };
  const notifications = { markReadByEvent: jest.fn().mockResolvedValue(1) };
  const service = new MeRequestService(
    db as never,
    clock as never,
    {} as never,
    { save } as never,
    views as never,
    notifications as never,
  );
  return { service, tx, notifications };
}

describe('MeRequestService.saveLines — chuông nhắc chưa đăng ký tự đọc (NV-03)', () => {
  it('lưu phiếu kỳ 2026-11 thành công → đánh dấu đọc chuông reminder:2026-11 của chính người lưu, trong cùng tx, giờ ClockService', async () => {
    const { service, tx, notifications } = build(
      jest.fn().mockResolvedValue({ request_id: 'r-1' }),
    );
    await service.saveLines(ME, { ym: '2026-11', lines: [] } as never);
    expect(notifications.markReadByEvent).toHaveBeenCalledTimes(1);
    expect(notifications.markReadByEvent).toHaveBeenCalledWith(
      'u-a',
      'reminder:2026-11',
      tx,
      NOW,
    );
  });

  it('PERIOD_LOCKED khi lưu → không đụng chuông', async () => {
    const { service, notifications } = build(
      jest.fn().mockRejectedValue(periodLocked('2026-12')),
    );
    await expect(
      service.saveLines(ME, { ym: '2026-11', lines: [] } as never),
    ).rejects.toMatchObject({
      response: { code: 'PERIOD_LOCKED' },
    });
    expect(notifications.markReadByEvent).not.toHaveBeenCalled();
  });

  it('lưu phiếu trống (bỏ hết dòng, không còn phiếu) → chuông nhắc giữ nguyên chưa đọc', async () => {
    const { service, notifications } = build(
      jest.fn().mockResolvedValue({ request_id: null }),
    );
    await service.saveLines(ME, { ym: '2026-11', lines: [] } as never);
    expect(notifications.markReadByEvent).not.toHaveBeenCalled();
  });
});
