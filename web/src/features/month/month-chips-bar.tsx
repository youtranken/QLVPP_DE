import { useTranslation } from 'react-i18next';
import { Toolbar } from '@/ui/toolbar';
import type { PersonRow } from '@/features/summary/summary.api';
import { MONTH_CHIPS, chipCounts, type MonthChip } from './month-chips';
import { useUrlSearchBox } from '@/lib/use-url-search-box';
import { Segmented } from '@/ui/segmented';

const MAX_SEARCH = 100;

interface Props {
  rows: PersonRow[];
  // Danh sách chưa nạp xong (tháng mới đang tải, hoặc còn trang sau): số đếm "—" thay vì số của dữ liệu dở dang
  loading?: boolean;
  chip: MonthChip;
  q: string;
  onChip: (c: MonthChip) => void;
  onQ: (q: string) => void;
}

export function MonthChips({ rows, loading = false, chip, q, onChip, onQ }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useUrlSearchBox(q, onQ);
  const counts = chipCounts(rows);
  return (
    <Toolbar search={{ value: search, onChange: setSearch, label: t('month.search'), placeholder: t('month.search'), maxLength: MAX_SEARCH }}>
      <Segmented
        label={t('month.chips.label')}
        value={chip}
        options={MONTH_CHIPS.map((c) => ({ value: c, label: t(`month.chips.${c}`), count: loading ? t('month.value.none') : counts[c] }))}
        onChange={onChip}
      />
    </Toolbar>
  );
}
