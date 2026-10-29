import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
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
