import { useTranslation } from 'react-i18next';
import type { ArrivalRow, ArrivalSection } from './arrival-rows';
import { ArrivalsGroup, type GroupPick } from './arrivals-group';
import type { ArrivalsDraft } from './use-arrivals-draft';

interface Props {
  sections: ArrivalSection[];
  draft: ArrivalsDraft;
  admBusy: ReadonlySet<string>;
  pickOf: (groupId: string) => GroupPick;
  onToggleAdm: (r: ArrivalRow) => void;
}

const NUMERIC = new Set<string>(['ordered', 'stock', 'short', 'after']);
// Cột luôn đủ và bề rộng cố định: gõ số, bấm NCC hết hàng hay đổi chữ nút nhóm không làm cột nhảy chỗ
const COLUMNS = ['item', 'stock', 'ordered', 'qty', 'short', 'status', 'after'] as const;

export function ArrivalTable({ sections, draft, admBusy, pickOf, onToggleAdm }: Props) {
  const { t } = useTranslation();
  return (
    <div className="ar-scroll">
      <table className="ar-table grid-table table--fixed" aria-label={t('arrivals.table.label')}>
        <colgroup>
          {COLUMNS.map((c) => (
            <col key={c} className={c === 'item' ? undefined : `ar-col-${c}`} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c} scope="col" className={NUMERIC.has(c) ? 'n' : undefined}>
                {t(`arrivals.table.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        {sections.map((s) => (
          <ArrivalsGroup key={s.id} section={s} draft={draft} admBusy={admBusy} columns={COLUMNS.length} pick={pickOf(s.id)} onToggleAdm={onToggleAdm} />
        ))}
      </table>
    </div>
  );
}
