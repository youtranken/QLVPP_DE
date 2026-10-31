import { withUnitNames } from './snapshot-unit-names';
import { UNIT_NAMES, snapshotData } from './xlsx-snapshot.fixture-spec';

describe('withUnitNames', () => {
  const report = snapshotData();

  it('lưu tên vi/en của ĐVT lúc chốt vào mọi hàng: món, ngoài DM, chi tiết, xuất lẻ', () => {
    const out = withUnitNames(report, UNIT_NAMES);
    expect(
      out.byItem.map((r) => [r.unit, r.unit_name, r.unit_name_en]),
    ).toEqual([
      ['cay', 'cây', 'stick'],
      ['hop', 'hộp', 'box'],
    ]);
    expect(out.custom[0]).toMatchObject({
      unit_name: 'cái',
      unit_name_en: 'piece',
    });
    expect(out.byDepartment[0].people[0].lines[0]).toMatchObject({
      unit_name: 'cây',
      unit_name_en: 'stick',
    });
    expect(out.issues[1]).toMatchObject({
      unit_name: 'hộp',
      unit_name_en: 'box',
    });
  });

  it('ĐVT không có name_en → unit_name_en null; mã không có trong bảng → giữ mã thô', () => {
    const out = withUnitNames(
      {
        ...report,
        byItem: [
          { ...report.byItem[0], unit: 'thung' },
          { ...report.byItem[1], unit: 'kg' },
        ],
      },
      UNIT_NAMES,
    );
    expect(out.byItem.map((r) => [r.unit_name, r.unit_name_en])).toEqual([
      ['thùng', null],
      ['kg', null],
    ]);
  });

  it('không sửa báo cáo gốc', () => {
    withUnitNames(report, UNIT_NAMES);
    expect(report.byItem[0]).not.toHaveProperty('unit_name');
  });
});
