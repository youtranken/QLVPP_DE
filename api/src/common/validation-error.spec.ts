import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveLinesBody } from '../modules/requests/request.dto';
import { ReviewBody } from '../modules/requests/review.dto';
import { StockChangeDto } from '../modules/catalog/stock.dto';
import { validationException } from './validation-error';

const STAMP = '2026-11-01T00:00:00.000Z';
const CATEGORY = '0b7e6f1a-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
const bodyOf = (dto: object, plain: object) =>
  validationException(
    validateSync(plainToInstance(dto as never, plain), { whitelist: true }),
  ).getResponse();

describe('validationException', () => {
  it('lỗi trường phẳng → fields [delta], message từ constraint', () => {
    const body = bodyOf(StockChangeDto, { delta: 0, reason: 'adjust' });
    expect(body).toMatchObject({ code: 'VALIDATION', fields: ['delta'] });
    expect((body as { message: string }).message).toMatch(/delta/);
    expect(body).not.toHaveProperty('line_index');
  });

  it('dòng 1 custom_name 121 ký tự → fields [custom_name], line_index 1, message không rỗng', () => {
    const body = bodyOf(SaveLinesBody, {
      expected_updated_at: STAMP,
      lines: [{ qty: 1 }, { qty: 1, custom_name: 'x'.repeat(121) }],
    });
    expect(body).toMatchObject({
      code: 'VALIDATION',
      fields: ['custom_name'],
      line_index: 1,
    });
    expect((body as { message: string }).message).toMatch(/custom_name/);
  });

  it('lỗi lồng lẫn lỗi phẳng → line_index của dòng lỗi đầu tiên, fields gộp không trùng', () => {
    const body = bodyOf(SaveLinesBody, {
      expected_updated_at: 'hôm qua',
      lines: [
        { qty: 1 },
        { qty: 1, custom_note: 'x'.repeat(501) },
        { qty: 1, custom_note: 'x'.repeat(501) },
      ],
    });
    expect(body).toMatchObject({
      fields: ['expected_updated_at', 'custom_note'],
      line_index: 1,
    });
  });

  it('trường lồng không phải lines (ReviewBody.item) → giữ đường dẫn có chấm item.max_qty, không có line_index', () => {
    const body = bodyOf(ReviewBody, {
      action: 'accept',
      item: { name: 'Bút', category_id: CATEGORY, max_qty: 0 },
    });
    expect(body).toMatchObject({
      code: 'VALIDATION',
      fields: ['item.max_qty'],
    });
    expect(body).not.toHaveProperty('line_index');
  });

  it('item có hai trường sai → fields [item.category_id, item.max_qty]', () => {
    const body = bodyOf(ReviewBody, {
      action: 'convert',
      item: { name: 'Bút', category_id: 'sai', max_qty: 0 },
    });
    expect(body).toMatchObject({
      fields: ['item.category_id', 'item.max_qty'],
    });
  });

  it.each([[[5]], [[null]], [[{ qty: 1 }, 'x']]])(
    'lines %j có phần tử không phải object → fields [lines], line_index của phần tử đó',
    (lines) => {
      const body = bodyOf(SaveLinesBody, { expected_updated_at: STAMP, lines });
      expect(body).toMatchObject({
        code: 'VALIDATION',
        fields: ['lines'],
        line_index: lines.length - 1,
      });
    },
  );

  it('nhiều dòng lỗi → chỉ báo dòng lỗi đầu tiên: line_index 1, fields và message của dòng 1, không lẫn dòng 2', () => {
    const body = bodyOf(SaveLinesBody, {
      expected_updated_at: STAMP,
      lines: [
        { qty: 1 },
        { qty: 1, custom_note: 'x'.repeat(501) },
        { qty: 1, custom_name: 'x'.repeat(121) },
      ],
    }) as { fields: string[]; message: string; line_index: number };
    expect(body.line_index).toBe(1);
    expect(body.fields).toEqual(['custom_note']);
    expect(body.message).toMatch(/custom_note/);
    expect(body.message).not.toMatch(/custom_name/);
  });
});
