import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/ui/data-table';
import { Segmented } from '@/ui/segmented';
import { pickName, type ReportDepartment } from './reports.api';
import { ReportSection } from './report-section';

const ALL = '~all';
const NO_DEPT = '~none';

interface Row {
  id: string;
  dept: string;
  name: string;
  lines: string;
  total: number;
}

const deptKey = (d: ReportDepartment) => d.department ?? NO_DEPT;

function useRows(departments: ReportDepartment[]) {
  const { t, i18n } = useTranslation();
  return useMemo<Row[]>(
    () =>
      departments.flatMap((d) =>
        d.people.map((p) => ({
          id: `${deptKey(d)}:${p.user_sub}`,
          dept: deptKey(d),
          name: p.full_name ?? p.user_sub,
          lines: p.lines.map((l) => t('reports.part2.line', { name: pickName(i18n.language, l.name, l.name_en), qty: l.qty })).join(' · '),
          total: p.lines.reduce((s, l) => s + l.qty, 0),
        })),
      ),
    [departments, t, i18n.language],
  );
}

function useColumns() {
  const { t } = useTranslation();
  return useMemo<ColumnDef<Row, unknown>[]>(() => {
    const col = (k: string) => t(`reports.part2.${k}`);
    const columns: ColumnDef<Row, unknown>[] = [
      { id: 'person', header: col('colPerson'), cell: ({ row }) => <b className="bc-item__name">{row.original.name}</b> },
      { id: 'lines', header: col('colLines'), cell: ({ row }) => row.original.lines },
      { id: 'total', header: col('colTotal'), meta: { className: 'num r' }, cell: ({ row }) => row.original.total },
    ];
    return columns.map((c) => ({ ...c, enableSorting: false }));
  }, [t]);
}

export function ReportPart2({ departments }: { departments: ReportDepartment[] }) {
  const { t } = useTranslation();
  const [dept, setDept] = useState(ALL);
  const all = useRows(departments);
  const columns = useColumns();
  const deptName = (key: string) => (key === NO_DEPT ? t('reports.part2.noDepartment') : key);
  const picked = departments.some((d) => deptKey(d) === dept) ? dept : ALL;
  const rows = picked === ALL ? all : all.filter((r) => r.dept === picked);
  const options = [
    { value: ALL, label: t('reports.part2.all') },
    ...departments.map((d) => ({ value: deptKey(d), label: t('reports.part2.chip', { name: deptName(deptKey(d)), count: d.people.length }) })),
  ];
  return (
    <ReportSection title={t('reports.part2.title')} note={t('reports.part2.note')}>
      {departments.length > 1 && (
        <div className="bc-chips">
          <Segmented label={t('reports.part2.filter')} value={picked} options={options} onChange={setDept} />
        </div>
      )}
      <DataTable
        data={rows}
        columns={columns}
        stackOnMobile
        emptyText={t('reports.part2.empty')}
        groupBy={picked === ALL ? { key: (r) => r.dept, header: (key) => <b>{deptName(key)}</b> } : undefined}
      />
    </ReportSection>
  );
}
