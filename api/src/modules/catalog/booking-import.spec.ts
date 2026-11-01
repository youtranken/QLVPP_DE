import {
  bookingItemProblem,
  normalizeUnit,
  parseBookingRows,
  seededUnitCode,
  type BookingRawRow,
} from './booking-import';

const raw = (
  row: number,
  code: string | null,
  name: string | null,
  nameEn: string | null = 'Item',
  unit: string | null = 'cái',
): BookingRawRow => ({ row, code, name, nameEn, unit });

describe('normalizeUnit', () => {
  it('"04 viên/vĩ" → ĐVT "vỉ" và pack_note "4 viên/vỉ" (bỏ số 0 đầu, vĩ viết thành vỉ)', () => {
    expect(normalizeUnit('04 viên/vĩ')).toEqual({
      unitName: 'vỉ',
      packNote: '4 viên/vỉ',
    });
    expect(normalizeUnit('01 viên/vĩ')).toEqual({
      unitName: 'vỉ',
      packNote: '1 viên/vỉ',
    });
  });

  it('"10 viên/vỉ" giữ 10 (chỉ bỏ số 0 đầu)', () => {
    expect(normalizeUnit('10 viên/vỉ').packNote).toBe('10 viên/vỉ');
  });

  it('"Cái" dạng NFD bằng "cái" dạng NFC', () => {
    const nfd = 'Cái'.normalize('NFD');
    expect(nfd).not.toBe('Cái');
    expect(normalizeUnit(nfd)).toEqual({ unitName: 'cái', packNote: null });
  });

  it('"Ream"/"ream" → ram', () => {
    expect(normalizeUnit('Ream').unitName).toBe('ram');
    expect(normalizeUnit(' ream ').unitName).toBe('ram');
  });

  it('"Vĩ" → vỉ, không pack_note', () => {
    expect(normalizeUnit('Vĩ')).toEqual({ unitName: 'vỉ', packNote: null });
  });

  it('cuốn khác cuộn (không gộp theo slug)', () => {
    expect(normalizeUnit('cuốn').unitName).toBe('cuốn');
    expect(normalizeUnit('Cuộn').unitName).toBe('cuộn');
  });

  it('ĐVT trống → unitName rỗng', () => {
    expect(normalizeUnit('  ').unitName).toBe('');
    expect(normalizeUnit(null).unitName).toBe('');
  });
});

describe('parseBookingRows', () => {
  it('mã trùng: hàng đầu giữ mã, hàng sau code=null và vào "Cần đặt mã"', () => {
    const r = parseBookingRows([
      raw(8, 'K04', 'Keo khô Staedler'),
      raw(9, 'K04', 'Keo khô loại khác'),
      raw(10, 'K04', 'Keo khô thứ ba'),
    ]);
    expect(r.items.map((i) => i.code)).toEqual(['K04', null, null]);
    expect(r.items[0].name).toBe('Keo khô Staedler');
    expect(r.needCode).toEqual([
      { row: 9, name: 'Keo khô loại khác', fileCode: 'K04' },
      { row: 10, name: 'Keo khô thứ ba', fileCode: 'K04' },
    ]);
  });

  it('hàng không mã cũng vào "Cần đặt mã" (fileCode null)', () => {
    const r = parseBookingRows([raw(152, null, 'Pin A', null, 'viên')]);
    expect(r.items[0]).toMatchObject({ code: null, name: 'Pin A' });
    expect(r.needCode).toEqual([{ row: 152, name: 'Pin A', fileCode: null }]);
  });

  it('tên trống thì bỏ hàng và ghi lý do; hàng trống hoàn toàn thì lờ', () => {
    const r = parseBookingRows([
      raw(8, 'A01', '   '),
      raw(9, null, null, null, null),
      raw(10, 'A02', 'Bút'),
    ]);
    expect(r.items.map((i) => i.code)).toEqual(['A02']);
    expect(r.skipped).toEqual([
      { row: 8, code: 'A01', name: '', reason: 'empty_name' },
    ]);
  });

  it('hàng có tên nhưng ĐVT trống thì bỏ và ghi lý do', () => {
    const r = parseBookingRows([raw(8, 'A01', 'Bút', 'Pen', '')]);
    expect(r.items).toEqual([]);
    expect(r.skipped[0]).toMatchObject({ row: 8, reason: 'empty_unit' });
  });

  it('tên en trống → null; trim và NFC mọi ô; sort_order = hàng*10', () => {
    const r = parseBookingRows([
      raw(12, ' B01 ', ' Bìa '.normalize('NFD'), '  ', '04 viên/vĩ'),
    ]);
    expect(r.items[0]).toEqual({
      row: 12,
      code: 'B01',
      name: 'Bìa',
      nameEn: null,
      unitName: 'vỉ',
      packNote: '4 viên/vỉ',
      sortOrder: 120,
    });
  });
});

describe('bookingItemProblem — giới hạn trường món', () => {
  const item = parseBookingRows([raw(8, 'A01', 'Bút')]).items[0];

  it.each([
    ['name', 120, null],
    ['name', 121, 'name'],
    ['nameEn', 120, null],
    ['nameEn', 121, 'name_en'],
    ['code', 40, null],
    ['code', 41, 'code'],
    ['unitName', 40, null],
    ['unitName', 41, 'unit'],
  ] as const)('%s dài %i → %p', (field, len, expected) => {
    expect(bookingItemProblem({ ...item, [field]: 'x'.repeat(len) })).toBe(
      expected,
    );
  });

  it('pack_note 121 ký tự → pack_note', () => {
    expect(bookingItemProblem({ ...item, packNote: 'x'.repeat(121) })).toBe(
      'pack_note',
    );
  });
});

describe('seededUnitCode', () => {
  it('ĐVT có sẵn theo §11.4 → mã seed (cái→cai, hộp→hop, cây→cay, ram→ram, cuộn→cuon, bịch→bich, chai→chai, bộ→bo)', () => {
    const cases: [string, string][] = [
      ['cái', 'cai'],
      ['hộp', 'hop'],
      ['cây', 'cay'],
      ['ram', 'ram'],
      ['cuộn', 'cuon'],
      ['bịch', 'bich'],
      ['chai', 'chai'],
      ['bộ', 'bo'],
    ];
    for (const [name, code] of cases) expect(seededUnitCode(name)).toBe(code);
    expect(seededUnitCode(normalizeUnit('Ream').unitName)).toBe('ram');
  });

  it('ĐVT ngoài danh sách seed (cuốn, xấp, vỉ) → null, khớp theo tên', () => {
    for (const name of ['cuốn', 'xấp', 'vỉ']) {
      expect(seededUnitCode(name)).toBeNull();
    }
  });
});
