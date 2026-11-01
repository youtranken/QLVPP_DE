import type { Executor } from '../../database/database.module';
import { resolveObjectLabels } from './audit-object-labels';

const ITEM_ID = 'c419efd8-9894-44b9-9ccc-f668ffa35479';

function fakeDb(rows: Record<string, unknown>[] = []) {
  const execute = jest.fn().mockResolvedValue({ rows });
  return { db: { execute } as unknown as Executor, execute };
}

describe('resolveObjectLabels', () => {
  it.each(['constructor', '__proto__', 'toString', 'hasOwnProperty'])(
    'object_type "%s" (khóa có sẵn của Object) → null, không truy vấn, không ném',
    async (type) => {
      const { db, execute } = fakeDb();
      await expect(
        resolveObjectLabels(db, [{ objectType: type, objectId: ITEM_ID }]),
      ).resolves.toEqual([null]);
      expect(execute).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['2001-04', { name: null, ym: '2001-04', owner: null }],
    ['2001-12', { name: null, ym: '2001-12', owner: null }],
    ['2001-01', { name: null, ym: '2001-01', owner: null }],
    ['2001-13', null],
    ['2001-00', null],
    ['2001-4', null],
    ['2001-04-01', null],
  ])('kỳ "%s" → %j', async (id, expected) => {
    const { db } = fakeDb();
    await expect(
      resolveObjectLabels(db, [{ objectType: 'period', objectId: id }]),
    ).resolves.toEqual([expected]);
  });

  it('uuid viết hoa vẫn khớp hàng DB trả chữ thường', async () => {
    const { db } = fakeDb([{ id: ITEM_ID, name: 'Bút bi đỏ' }]);
    await expect(
      resolveObjectLabels(db, [
        { objectType: 'item', objectId: ITEM_ID.toUpperCase() },
      ]),
    ).resolves.toEqual([{ name: 'Bút bi đỏ', ym: null, owner: null }]);
  });

  it('id không phải uuid ở loại tra theo uuid → null, không truy vấn', async () => {
    const { db, execute } = fakeDb();
    await expect(
      resolveObjectLabels(db, [{ objectType: 'item', objectId: 'abc' }]),
    ).resolves.toEqual([null]);
    expect(execute).not.toHaveBeenCalled();
  });
});
