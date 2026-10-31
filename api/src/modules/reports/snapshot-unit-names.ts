import type { UnitFacts } from '../units/units.service';
import type { FrozenUnitName, MonthReport } from './report.types';

export type UnitNames = ReadonlyMap<
  string,
  Pick<UnitFacts, 'name' | 'name_en'>
>;

export function withUnitNames(
  report: MonthReport,
  names: UnitNames,
): MonthReport {
  const frozen = <T extends { unit: string }>(row: T): T & FrozenUnitName => {
    const unit = names.get(row.unit);
    return {
      ...row,
      unit_name: unit?.name ?? row.unit,
      unit_name_en: unit?.name_en ?? null,
    };
  };
  return {
    ...report,
    byItem: report.byItem.map(frozen),
    custom: report.custom.map(frozen),
    byDepartment: report.byDepartment.map((dept) => ({
      ...dept,
      people: dept.people.map((p) => ({ ...p, lines: p.lines.map(frozen) })),
    })),
    issues: report.issues.map(frozen),
  };
}

// Bản chốt mới dùng tên đã chụp; bản chốt cũ chưa có thì lấy tên hiện tại trong bảng units
export function unitNameOf(
  row: { unit: string } & FrozenUnitName,
  names: UnitNames,
  lang: 'vi' | 'en',
): string {
  const unit =
    row.unit_name !== undefined
      ? { name: row.unit_name, name_en: row.unit_name_en ?? null }
      : names.get(row.unit);
  if (!unit) return row.unit;
  return lang === 'en' && unit.name_en ? unit.name_en : unit.name;
}
