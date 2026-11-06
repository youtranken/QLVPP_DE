import { useTranslation } from 'react-i18next';
import { OverlayPanel, type PanelNav } from '@/ui/overlay-panel';
import { LoadError, Loading } from '@/ui/load-state';
import { useFormatTime } from '@/lib/format-time';
import { useDirectoryNames } from '@/features/directory/use-all-users';
import { useUnitName } from '@/features/units/units.api';
import { useMovements, type StockMovement } from './stock.api';
import { StockTitle } from './stock-dialog-parts';
import { signed } from './stock-input';
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

function Actions({ item, onAction }: Pick<Props, 'item' | 'onAction'>) {
  const { t } = useTranslation();
  return (
    <>
      <button type="button" className="btn btn--sm" onClick={() => onAction('purchase')}>
        {t('stock.actions.buyOutside')}
      </button>
      <button type="button" className="btn btn--sm" onClick={() => onAction('count')}>
        {t('stock.page.count')}
      </button>
      <IssueButton item={item} className="btn btn--sm" onClick={() => onAction('issue')} />
    </>
  );
}

export function MovementsDrawer({ item, groupName, onAction, onClose, nav }: Props) {
  const { t } = useTranslation();
  const unit = useUnitName(item.unit);
  const movements = useMovements(item.id);
  const names = useDirectoryNames();
  const formatTime = useFormatTime();
  const nameOf = (sub: string) => names.data?.get(sub) ?? sub;
  const rows = movements.data?.pages.flatMap((p) => p.items) ?? [];
  const after = balancesAfter(rows, item.stock_qty);

  const tagText = (m: StockMovement) => {
    if (m.reason !== 'issue') return t(`stock.ledger.reasons.${m.reason}`);
    return m.recipient_sub ? t('stock.ledger.reasons.issue', { name: nameOf(m.recipient_sub) }) : t('stock.ledger.reasons.issueShared');
  };

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
      <div className="sk-balance">
        <b className="sk-balance__n num">{item.stock_qty}</b>
        <StockBadge row={item} />
        <span className="sk-balance__owed">{t('stock.ledger.held', { n: item.held > 0 ? item.held : t('common.empty') })}</span>
      </div>
      {movements.isPending && <Loading />}
      {movements.isError && <LoadError onRetry={() => void movements.refetch()} />}
      {movements.isSuccess && rows.length === 0 && <p className="sk-empty">{t('stock.ledger.empty')}</p>}
      <ol className="sk-ledger">
        {rows.map((m, i) => (
          <li key={m.id}>
            <div className="sk-ledger__head">
              <span className={TAG_CLASS[m.reason]}>{tagText(m)}</span>
              <b className="num sk-ledger__delta" data-sign={m.delta > 0 ? 'in' : 'out'}>{signed(m.delta)}</b>
              <span className="sk-ledger__after num">{t('stock.ledger.after', { qty: after[i] })}</span>
            </div>
            {m.note && <p className="sk-ledger__note">{m.note}</p>}
            <small>{t('stock.ledger.meta', { time: formatTime(m.created_at), actor: nameOf(m.actor_sub) })}</small>
          </li>
        ))}
      </ol>
      {movements.hasNextPage && (
        <button type="button" className="btn" disabled={movements.isFetchingNextPage} onClick={() => void movements.fetchNextPage()}>
          {t('stock.ledger.more')}
        </button>
      )}
    </OverlayPanel>
  );
}
