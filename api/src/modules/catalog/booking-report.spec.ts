import { formatBookingReport } from './booking-report';

const item = {
  row: 9,
  code: null,
  name: 'Bút bi đỏ',
  nameEn: null,
  unitName: 'cây',
  packNote: null,
};

describe('formatBookingReport', () => {
  it('chạy thử: ghi rõ không ghi gì, đếm và liệt kê bỏ qua (lý do), ĐVT mới, Cần đặt mã', () => {
    const text = formatBookingReport({
      applied: false,
      created: [item],
      skipped: [
        { row: 16, code: 'X01', name: '', reason: 'empty_name' },
        { row: 8, code: 'D01', name: 'Bút bi', reason: 'exists_code' },
      ],
      unitsCreated: [{ code: 'cuon-2', name: 'cuốn' }],
      needCode: [
        { row: 9, name: 'Bút bi đỏ', fileCode: 'D01' },
        { row: 152, name: 'Pin A', fileCode: null },
      ],
    });
    expect(text.split('\n')).toEqual([
      'CHẠY THỬ — chưa ghi gì (thêm --apply để ghi).',
      'Món tạo: 1',
      'Bỏ qua: 2',
      '  - hàng 16 (X01): tên trống',
      '  - hàng 8 (D01) Bút bi: đã có món cùng mã',
      'ĐVT tạo mới: 1',
      '  - cuốn (cuon-2)',
      'Cần đặt mã: 2',
      '  - hàng 9: Bút bi đỏ (mã D01 trùng hàng trên)',
      '  - hàng 152: Pin A (không có mã)',
    ]);
  });

  it('--apply: dòng đầu báo đã ghi', () => {
    const text = formatBookingReport({
      applied: true,
      created: [],
      skipped: [],
      unitsCreated: [],
      needCode: [],
    });
    expect(text.split('\n')[0]).toBe(
      'ĐÃ GHI — một transaction, audit catalog.imported.',
    );
  });
});
