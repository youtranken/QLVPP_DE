import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ListMeta } from '@/ui/list-meta';
import { Segmented } from '@/ui/segmented';
import type { MonthView } from './use-month-params';

interface Props {
  view: MonthView;
  onView: (v: MonthView) => void;
  filter?: ReactNode;
  // null: danh sách người chưa nạp xong → chưa có số đúng để đếm
  meta: { shown: number; total: number; areas: number } | null;
}

export function MonthViewBar({ view, onView, filter, meta }: Props) {
  const { t } = useTranslation();
  return (
    <div className="mk-viewbar">
      <Segmented
        label={t('month.view.label')}
        value={view}
        options={[
          { value: 'people', label: t('month.view.people') },
          { value: 'items', label: t('month.view.items') },
        ]}
        onChange={onView}
      />
      {filter}
      {meta && (
        <ListMeta>
          {meta.areas > 0 ? t('month.table.metaAreas', { shown: meta.shown, total: meta.total, count: meta.areas }) : t('month.table.meta', { shown: meta.shown, total: meta.total })}
        </ListMeta>
      )}
    </div>
  );
}
