import { reminderConflict, validateConfigPatch } from './config-validation';

const box = (over: Record<string, unknown> = {}) => ({
  title: 'Chủ quản đơn vị',
  title_en: 'Head of Dept.',
  name: '',
  ...over,
});

describe('validateConfigPatch', () => {
  it('patch hợp lệ đủ khóa → giữ nguyên giá trị', () => {
    expect(
      validateConfigPatch({
        registration_last_day: 3,
        default_max_qty: 999,
        low_stock_notify: false,
        signature_boxes: [box({ name: 'B' })],
        reminder_days_left: 2,
        admin_contact: 'Chị Lan — 0901',
      }),
    ).toEqual({
      ok: true,
      patch: {
        registration_last_day: 3,
        default_max_qty: 999,
        low_stock_notify: false,
        signature_boxes: [box({ name: 'B' })],
        reminder_days_left: 2,
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

  it.each([['vpp_admin'], [''], [42]])(
    'admin_group=%p không còn là khóa cấu hình → field admin_group',
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

  it('authorized_groups không còn, khóa lạ → field là tên khóa', () => {
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

  it.each([1, 7])('reminder_days_left=%p (biên trong [1,7]) → hợp lệ', (v) => {
    expect(validateConfigPatch({ reminder_days_left: v })).toEqual({
      ok: true,
      patch: { reminder_days_left: v },
    });
  });

  it.each([0, 8, 2.5, '3', null])(
    'reminder_days_left=%p (ngoài [1,7] hoặc không phải số nguyên) → field reminder_days_left',
    (v) => {
      expect(validateConfigPatch({ reminder_days_left: v })).toEqual({
        ok: false,
        field: 'reminder_days_left',
      });
    },
  );

  it.each([1, 3])('signature_boxes %d ô → hợp lệ, PUT giữ cả mảng', (n) => {
    const boxes = Array.from({ length: n }, (_, i) => box({ name: `N${i}` }));
    expect(validateConfigPatch({ signature_boxes: boxes })).toEqual({
      ok: true,
      patch: { signature_boxes: boxes },
    });
  });

  it.each([0, 4])('signature_boxes %d ô → field signature_boxes', (n) => {
    const boxes = Array.from({ length: n }, () => box());
    expect(validateConfigPatch({ signature_boxes: boxes })).toEqual({
      ok: false,
      field: 'signature_boxes',
    });
  });

  it.each([{ head: 'A' }, 'A', null])(
    'signature_boxes không phải mảng (%p) → field signature_boxes',
    (v) => {
      expect(validateConfigPatch({ signature_boxes: v })).toEqual({
        ok: false,
        field: 'signature_boxes',
      });
    },
  );

  it.each([
    ['title', 60, 'x'],
    ['title_en', 60, 'x'],
    ['name', 200, 'x'],
  ])('signature_boxes ô 2: %s dài %d → hợp lệ', (key, max, ch) => {
    const boxes = [box(), box({ [key]: ch.repeat(max) })];
    expect(validateConfigPatch({ signature_boxes: boxes })).toMatchObject({
      ok: true,
    });
  });

  it.each([
    ['title', 61],
    ['title_en', 61],
    ['name', 201],
  ])(
    'signature_boxes ô 2: %s dài %d → field signature_boxes.1.<trường>',
    (key, len) => {
      const boxes = [box(), box({ [key]: 'x'.repeat(len) })];
      expect(validateConfigPatch({ signature_boxes: boxes })).toEqual({
        ok: false,
        field: `signature_boxes.1.${key}`,
      });
    },
  );

  it('signature_boxes: title trim; title rỗng sau trim → field .title; title_en/name rỗng hợp lệ', () => {
    expect(
      validateConfigPatch({
        signature_boxes: [{ title: '  Duyệt ', title_en: '', name: '' }],
      }),
    ).toEqual({
      ok: true,
      patch: { signature_boxes: [{ title: 'Duyệt', title_en: '', name: '' }] },
    });
    expect(
      validateConfigPatch({ signature_boxes: [box({ title: '   ' })] }),
    ).toEqual({ ok: false, field: 'signature_boxes.0.title' });
  });

  it('signature_boxes: ô không phải object → .<i>; khóa lạ/kế thừa hoặc thiếu trường → .<i>.<trường>', () => {
    expect(validateConfigPatch({ signature_boxes: [box(), 'x'] })).toEqual({
      ok: false,
      field: 'signature_boxes.1',
    });
    expect(
      validateConfigPatch({ signature_boxes: [box({ boss: 'X' })] }),
    ).toEqual({ ok: false, field: 'signature_boxes.0.boss' });
    const proto: unknown = JSON.parse(
      '{"signature_boxes": [{"title": "A", "title_en": "", "name": "", "__proto__": "X"}]}',
    );
    expect(validateConfigPatch(proto)).toEqual({
      ok: false,
      field: 'signature_boxes.0.__proto__',
    });
    expect(
      validateConfigPatch({ signature_boxes: [{ title: 'A', name: '' }] }),
    ).toEqual({ ok: false, field: 'signature_boxes.0.title_en' });
    expect(
      validateConfigPatch({ signature_boxes: [box({ name: 5 })] }),
    ).toEqual({ ok: false, field: 'signature_boxes.0.name' });
  });

  it('signers (khóa cũ) không còn ghi được → field signers', () => {
    expect(validateConfigPatch({ signers: { head: 'A' } })).toEqual({
      ok: false,
      field: 'signers',
    });
  });

  describe('reminderConflict — reminder_days_left ≤ registration_last_day − 1 sau khi gộp', () => {
    const current = { registration_last_day: 10, reminder_days_left: 3 };

    it('registration_last_day=3 trong bản vá + reminder 2 → hợp lệ; + reminder 3 → field reminder_days_left', () => {
      expect(
        reminderConflict(
          { registration_last_day: 3, reminder_days_left: 2 },
          current,
        ),
      ).toBeNull();
      expect(
        reminderConflict(
          { registration_last_day: 3, reminder_days_left: 3 },
          current,
        ),
      ).toBe('reminder_days_left');
    });

    it('chỉ vá reminder: gộp với last_day hiện có 3 → 2 hợp lệ, 3 lỗi field reminder_days_left', () => {
      const lastDay3 = { registration_last_day: 3, reminder_days_left: 2 };
      expect(reminderConflict({ reminder_days_left: 2 }, lastDay3)).toBeNull();
      expect(reminderConflict({ reminder_days_left: 3 }, lastDay3)).toBe(
        'reminder_days_left',
      );
    });

    it('chỉ vá last_day: reminder hiện có 7 → last_day 8 hợp lệ, 7 lỗi field registration_last_day', () => {
      const r7 = { registration_last_day: 10, reminder_days_left: 7 };
      expect(reminderConflict({ registration_last_day: 8 }, r7)).toBeNull();
      expect(reminderConflict({ registration_last_day: 7 }, r7)).toBe(
        'registration_last_day',
      );
    });

    it('bản vá không chạm hai khóa → null kể cả khi config hiện có đã lệch luật', () => {
      const broken = { registration_last_day: 3, reminder_days_left: 7 };
      expect(reminderConflict({ default_max_qty: 5 }, broken)).toBeNull();
    });
  });

  it.each([{}, null, [], 'x'])(
    'body %p rỗng/không phải object → field body',
    (body) => {
      expect(validateConfigPatch(body)).toEqual({ ok: false, field: 'body' });
    },
  );
});
