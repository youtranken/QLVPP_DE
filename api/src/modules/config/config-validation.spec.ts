import { validateConfigPatch } from './config-validation';

describe('validateConfigPatch', () => {
  it('patch hợp lệ đủ khóa → giữ nguyên giá trị, admin_group được trim', () => {
    expect(
      validateConfigPatch({
        registration_last_day: 3,
        default_max_qty: 999,
        admin_group: '  vpp-admin ',
        low_stock_notify: false,
        signers: { preparer: 'A', head: 'B', approver: 'C' },
        admin_contact: 'Chị Lan — 0901',
      }),
    ).toEqual({
      ok: true,
      patch: {
        registration_last_day: 3,
        default_max_qty: 999,
        admin_group: 'vpp-admin',
        low_stock_notify: false,
        signers: { preparer: 'A', head: 'B', approver: 'C' },
        admin_contact: 'Chị Lan — 0901',
      },
    });
  });

  it.each([2, 29, 10.5, '10', null, true])(
    'registration_last_day=%p (ngoài [3,28] hoặc không phải số nguyên) → field registration_last_day',
    (value) => {
      expect(validateConfigPatch({ registration_last_day: value })).toEqual({
        ok: false,
        field: 'registration_last_day',
      });
    },
  );

  it.each([0, 1000, 2.5, '20'])(
    'default_max_qty=%p (ngoài [1,999] hoặc không phải số nguyên) → field default_max_qty',
    (value) => {
      expect(validateConfigPatch({ default_max_qty: value })).toEqual({
        ok: false,
        field: 'default_max_qty',
      });
    },
  );

  it.each(['', '   ', 42, null])(
    'admin_group=%p rỗng/không phải chuỗi → field admin_group',
    (value) => {
      expect(validateConfigPatch({ admin_group: value })).toEqual({
        ok: false,
        field: 'admin_group',
      });
    },
  );

  it('low_stock_notify phải là boolean, admin_contact phải là chuỗi ≤ 500', () => {
    expect(validateConfigPatch({ low_stock_notify: 'true' })).toEqual({
      ok: false,
      field: 'low_stock_notify',
    });
    expect(validateConfigPatch({ admin_contact: 'x'.repeat(501) })).toEqual({
      ok: false,
      field: 'admin_contact',
    });
  });

  it('signers một phần hợp lệ; khóa con lạ hoặc không phải chuỗi → field signers.<khóa>', () => {
    expect(validateConfigPatch({ signers: { preparer: 'A' } })).toEqual({
      ok: true,
      patch: { signers: { preparer: 'A' } },
    });
    expect(validateConfigPatch({ signers: { head: 1 } })).toEqual({
      ok: false,
      field: 'signers.head',
    });
    expect(validateConfigPatch({ signers: { boss: 'X' } })).toEqual({
      ok: false,
      field: 'signers.boss',
    });
    expect(validateConfigPatch({ signers: 'A' })).toEqual({
      ok: false,
      field: 'signers',
    });
  });

  it('authorized_groups chỉ đọc, khóa lạ → field là tên khóa', () => {
    expect(validateConfigPatch({ authorized_groups: ['IT'] })).toEqual({
      ok: false,
      field: 'authorized_groups',
    });
    expect(validateConfigPatch({ directory_sync_last_at: 1 })).toEqual({
      ok: false,
      field: 'directory_sync_last_at',
    });
  });

  it.each([
    'constructor',
    'toString',
    'valueOf',
    '__proto__',
    'hasOwnProperty',
  ])(
    'khóa kế thừa từ Object.prototype %s → field là tên khóa, không ném lỗi',
    (key) => {
      // JSON.parse tạo own property kể cả __proto__, giống body thật sau express.json
      const body: unknown = JSON.parse(`{"${key}": 1}`);
      expect(validateConfigPatch(body)).toEqual({ ok: false, field: key });
    },
  );

  it('signers có khóa kế thừa (constructor, __proto__) → field signers.<khóa>', () => {
    for (const key of ['constructor', '__proto__']) {
      const body: unknown = JSON.parse(`{"signers": {"${key}": "X"}}`);
      expect(validateConfigPatch(body)).toEqual({
        ok: false,
        field: `signers.${key}`,
      });
    }
  });

  it.each([{}, null, [], 'x'])(
    'body %p rỗng/không phải object → field body',
    (body) => {
      expect(validateConfigPatch(body)).toEqual({ ok: false, field: 'body' });
    },
  );
});
