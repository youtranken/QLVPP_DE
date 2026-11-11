import { useTranslation } from 'react-i18next';
import { OverlayPanel, type PanelNav } from '@/ui/overlay-panel';
import { LoadError, Loading } from '@/ui/load-state';
import { usePersonName } from '@/features/directory/use-all-users';
import { useUnitName } from '@/features/units/units.api';
import { monthOf } from '@/features/request/request-format';
import { useMovements, type StockMovement } from './stock.api';
import { StockTitle } from './stock-dialog-parts';
import { signed } from './stock-input';
import { groupByDay, receiptOf, vnDayKey, type LedgerLine } from './ledger-lines';
import { balancesAfter, type StockRow } from './stock-rows';
import { IssueButton, StockBadge, type StockAction } from './stock-table';

const TAG_CLASS: Record<StockMovement['reason'], string> = {
  purchase: 'tag tag--ok',
  adjust: 'tag tag--warn',
  issue: 'tag tag--info',
  delivery: 'tag tag--brand',
  return: 'tag tag--outline',
};

interface Props {
  item: StockRow;
  groupName: string;
  onAction: (a: StockAction) => void;
  onClose: () => void;
  nav?: Omit<PanelNav, 'prevLabel' | 'nextLabel'>;
}

type Sentence = (m: StockMovement) => { text: string; note: string | null };

function Actions({ item, onAction }: Pick<Props, 'item' | 'onAction'>) {
  const { t } = useTranslation();
  return (
    <>
      <button type="button" className="btn btn--sm" onClick={() => onAction('purchase')}>
        {t('stock.actions.buyOutside')}
      </button>
      <IssueButton item={item} className="btn btn--sm" onClick={() => onAction('issue')} />
    </>
  );
}

// Một câu thường cho mỗi dòng sổ, không lộ ghi chú máy hay mã: "Giao 2 cây cho Nguyễn Văn An"
function useSentence(unit: string, nameOf: (sub: string) => string): Sentence {
  const { t } = useTranslation();
  return (m) => {
    const qty = Math.abs(m.delta);
    switch (m.reason) {
      case 'purchase': {
        const r = receiptOf(m);
        if (!r) return { text: t('stock.ledger.text.purchaseOutside', { qty, unit }), note: m.note };
        return { text: t(`stock.ledger.text.${r.kind}`, { qty, unit, month: monthOf(r.ym) }), note: r.rest };
      }
      case 'issue': {
        const text = m.recipient_sub ? t('stock.ledger.text.issue', { qty, unit, name: nameOf(m.recipient_sub) }) : t('stock.ledger.text.issueShared', { qty, unit });
        return { text, note: m.note };
      }
      case 'delivery': {
        const to = m.delivered_to_sub;
        return { text: to ? t('stock.ledger.text.delivery', { qty, unit, name: nameOf(to) }) : t('stock.ledger.text.deliveryAnon', { qty, unit }), note: m.note };
      }
      case 'return':
        return { text: t('stock.ledger.text.return', { qty, unit }), note: m.note };
      default:
        return { text: t('stock.ledger.text.adjust'), note: m.note };
    }
  };
}

function Line({ line, sentence, actor }: { line: LedgerLine; sentence: Sentence; actor: string }) {
  const { t } = useTranslation();
  const { m } = line;
  const { text, note } = sentence(m);
  return (
    <li className="sk-ledger__row">
      <span className="sk-ledger__time num">{line.time}</span>
      <div className="sk-ledger__body">
        <p className="sk-ledger__text">
          <span className={TAG_CLASS[m.reason]}>{t(`stock.ledger.tags.${m.reason}`)}</span> {text}
        </p>
        <small className="sk-ledger__meta">{note ? t('stock.ledger.metaNote', { actor, note }) : actor}</small>
      </div>
      <div className="sk-ledger__side">
        <b className="num sk-ledger__delta" data-sign={m.delta > 0 ? 'in' : 'out'}>
          {signed(m.delta)}
        </b>
        <small className="sk-ledger__after num">{t('stock.ledger.after', { qty: line.after })}</small>
      </div>
    </li>
  );
}

function useDayLabel() {
  const { t } = useTranslation();
  const today = vnDayKey(new Date());
  return (day: string) => {
    const [y, mo, d] = day.split('-');
    const date = y === today.slice(0, 4) ? `${d}/${mo}` : `${d}/${mo}/${y}`;
    return day === today ? t('stock.ledger.today', { date }) : t('stock.ledger.day', { date });
  };
}

export function MovementsDrawer({ item, groupName, onAction, onClose, nav }: Props) {
  const { t } = useTranslation();
  const unit = useUnitName(item.unit);
  const movements = useMovements(item.id);
  const nameOf = usePersonName();
  const sentence = useSentence(unit, nameOf);
  const dayLabel = useDayLabel();
  const rows = movements.data?.pages.flatMap((p) => p.items) ?? [];
  const days = groupByDay(rows, balancesAfter(rows, item.stock_qty));

  return (
    <OverlayPanel
      open
      onClose={onClose}
      title={
        <span className="sk-title">
          <StockTitle title={t('stock.ledger.title')} name={item.name} />
        </span>
      }
      nav={nav && { ...nav, prevLabel: t('stock.ledger.prev'), nextLabel: t('stock.ledger.next') }}
      footer={<Actions item={item} onAction={onAction} />}
    >
      <small className="drawer-eyebrow">{t('stock.ledger.eyebrow', { group: groupName, unit })}</small>
      <p className="sk-balance">
        <span>
          {t('stock.ledger.sumStock')} <b className="sk-balance__n num">{item.stock_qty}</b>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {t('stock.ledger.sumHeld')} <b className="num">{item.held}</b>
        </span>
        <span aria-hidden="true">·</span>
        <span>
          {t('stock.ledger.sumFree')} <b className="num sk-balance__free">{item.free}</b>
        </span>
        <span className="sk-balance__badge">
          <StockBadge row={item} />
        </span>
      </p>
      {movements.isPending && <Loading />}
      {movements.isError && <LoadError onRetry={() => void movements.refetch()} />}
      {movements.isSuccess && rows.length === 0 && <p className="sk-empty">{t('stock.ledger.empty')}</p>}
      {days.map((d) => (
        <section key={d.key} className="sk-ledger-day" aria-label={dayLabel(d.day)}>
          <h3 className="sk-ledger__day">{dayLabel(d.day)}</h3>
          <ol className="sk-ledger">
            {d.lines.map((line) => (
              <Line key={line.m.id} line={line} sentence={sentence} actor={nameOf(line.m.actor_sub)} />
            ))}
          </ol>
        </section>
      ))}
      {movements.hasNextPage && (
        <button type="button" className="btn" disabled={movements.isFetchingNextPage} onClick={() => void movements.fetchNextPage()}>
          {t('stock.ledger.more')}
        </button>
      )}
    </OverlayPanel>
  );
}
