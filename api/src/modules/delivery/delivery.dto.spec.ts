import { randomUUID } from 'node:crypto';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { BulkDeliverBody } from './bulk-delivery.dto';
import { DeliverBody } from './delivery.dto';

const failing = (body: object) =>
  validateSync(plainToInstance(DeliverBody, body)).map((e) => e.property);

describe('DeliverBody', () => {
  it.each([1, 9999])('qty %d hợp lệ', (qty) => {
    expect(failing({ qty, expected_delivered_qty: 0 })).toEqual([]);
  });

  it.each([0, 10000, 1.5, -1, '3', null])('qty %p → lỗi qty', (qty) => {
    expect(failing({ qty, expected_delivered_qty: 0 })).toEqual(['qty']);
  });

  it('expected_delivered_qty 0 hợp lệ; -1, 1.5, thiếu → lỗi', () => {
    expect(failing({ qty: 1, expected_delivered_qty: 0 })).toEqual([]);
    for (const expected of [-1, 1.5, undefined]) {
      expect(failing({ qty: 1, expected_delivered_qty: expected })).toEqual([
        'expected_delivered_qty',
      ]);
    }
  });
});

describe('BulkDeliverBody', () => {
  const line = {
    line_id: randomUUID() as string,
    qty: 1,
    expected_delivered_qty: 0,
  };
  const req = (n = 1) => ({
    request_id: randomUUID(),
    lines: Array.from({ length: n }, () => ({ ...line })),
  });
  const bulkFailing = (body: object) =>
    validateSync(plainToInstance(BulkDeliverBody, body)).map((e) => e.property);

  it('hợp lệ: 1 phiếu 1 dòng; 100 phiếu; 200 dòng', () => {
    expect(bulkFailing({ requests: [req()] })).toEqual([]);
    expect(
      bulkFailing({ requests: Array.from({ length: 100 }, () => req()) }),
    ).toEqual([]);
    expect(bulkFailing({ requests: [req(200)] })).toEqual([]);
  });

  it('rỗng, 101 phiếu, 201 dòng, qty 0, line_id không phải uuid → lỗi', () => {
    expect(bulkFailing({ requests: [] })).toEqual(['requests']);
    expect(
      bulkFailing({ requests: Array.from({ length: 101 }, () => req()) }),
    ).toEqual(['requests']);
    expect(bulkFailing({ requests: [req(201)] })).toEqual(['requests']);
    const bad = req();
    bad.lines[0].qty = 0;
    expect(bulkFailing({ requests: [bad] })).toEqual(['requests']);
    const nouuid = req();
    nouuid.lines[0].line_id = 'x';
    expect(bulkFailing({ requests: [nouuid] })).toEqual(['requests']);
  });
});
