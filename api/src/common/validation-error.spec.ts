import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveLinesBody } from '../modules/requests/request.dto';
import { StockChangeDto } from '../modules/catalog/stock.dto';
import { validationException } from './validation-error';

const STAMP = '2026-11-01T00:00:00.000Z';
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
});
