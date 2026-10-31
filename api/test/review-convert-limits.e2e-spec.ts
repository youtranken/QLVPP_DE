import { reviewFixture } from './review.fixture';

describe('admin/review: biên tên và tối đa mỗi tháng của món mới (convert)', () => {
  const f = reviewFixture('reviewl');
  const { NEW_PREFIX, customLine, lineRow, newItemBody, review } = f;
  const nameOf = (len: number) => `${NEW_PREFIX}-`.padEnd(len - 1, 'x') + 'a';

  it.each([[120], [121]])('tên món mới dài %i ký tự', async (len) => {
    const { line } = await customLine();
    const res = await review(line.id, { action: 'convert', item: newItemBody({ name: nameOf(len) }) });
    if (len === 120) {
      expect(res.status).toBe(200);
      expect(res.body.item.name).toHaveLength(120);
      return;
    }
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['item.name'] });
    expect((await lineRow(line.id)).review_status).toBe('pending');
  });

  it.each([
    [0, 400],
    [1, 200],
    [999, 200],
    [1000, 400],
  ])('max_qty %i → %i', async (max_qty, status) => {
    const { line } = await customLine();
    const res = await review(line.id, { action: 'convert', item: newItemBody({ max_qty }) });
    expect(res.status).toBe(status);
    if (status === 200) return expect(res.body.item.max_qty).toBe(max_qty);
    expect(res.body).toMatchObject({ code: 'VALIDATION', fields: ['item.max_qty'] });
    expect((await lineRow(line.id)).review_status).toBe('pending');
  });
});
