import { Logger } from '@nestjs/common';
import { BulkDeliveryService } from './bulk-delivery.service';
import type { BulkRequestResult } from './bulk-delivery.dto';

const NOW = new Date('2026-11-12T03:00:00.000Z');
const BODY = {
  requests: [
    {
      request_id: 'r-1',
      lines: [{ line_id: 'l-1', qty: 1, expected_delivered_qty: 0 }],
    },
  ],
};
const DONE: BulkRequestResult = {
  request_id: 'r-1',
  ok: true,
  delivered_units: 1,
  request_complete: true,
};

function serviceWith(record: jest.Mock) {
  const service = new BulkDeliveryService(
    {} as never,
    { now: () => NOW } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { record } as never,
  );
  jest
    .spyOn(
      service as unknown as {
        deliverRequest: () => Promise<BulkRequestResult>;
      },
      'deliverRequest',
    )
    .mockResolvedValue(DONE);
  return service;
}

describe('BulkDeliveryService.deliver — ghi sổ hoàn tác sau khi các phiếu đã commit', () => {
  afterEach(() => jest.restoreAllMocks());

  it('ghi sổ hoàn tác được → trả kết quả giao kèm undo_id', async () => {
    const record = jest.fn().mockResolvedValue('x');
    const res = await serviceWith(record).deliver(BODY, 'admin-1');
    expect(res.results).toEqual([DONE]);
    expect(res.undo_id).toEqual(expect.any(String));
    expect(record).toHaveBeenCalledTimes(1);
  });

  it('INSERT undo_actions lỗi → không ném 500: trả kết quả giao, undo_id null, log warn không kèm dữ liệu', async () => {
    const record = jest
      .fn()
      .mockRejectedValue(new Error('connection reset by peer admin-1'));
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const res = await serviceWith(record).deliver(BODY, 'admin-1');
    expect(res).toEqual({ results: [DONE], undo_id: null });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/admin-1|r-1|l-1/);
  });
});
