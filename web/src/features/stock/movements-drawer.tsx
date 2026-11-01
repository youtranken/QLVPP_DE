import { useTranslation } from 'react-i18next';
import { Drawer, DrawerClose, DrawerTitle } from '@/ui/drawer';
import { Icon } from '@/ui/icon';
import { LoadError, Loading } from '@/ui/load-state';
import { useFormatTime } from '@/lib/format-time';
import { useDirectoryNames } from '@/features/directory/use-all-users';
import { useUnitName } from '@/features/units/units.api';
import { useMovements, type StockMovement } from './stock.api';
import { balancesAfter, type StockRow } from './stock-rows';
import { IssueButton, StockBadge, type StockAction } from './stock-table';

const TAG_CLASS: Record<StockMovement['reason'], string> = {
  purchase: 'tag tag--ok',
  adjust: 'tag tag--warn',
  issue: 'tag tag--info',
  delivery: 'tag tag--brand',
  return: 'tag tag--outline',
};

// Dấu trừ thật (U+2212) để số âm không bị đọc như gạch nối
const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

interface Props {
  item: StockRow;
  groupName: string;
  onAction: (a: StockAction) => void;
  onClose: () => void;
}

export function MovementsDrawer({ item, groupName, onAction, onClose }: Props) {
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
    <Drawer open onOpenChange={(o) => !o && onClose()}>
      <div className="drawer-header sk-drawer-head">
        <div className="sk-drawer-head__text">
          <small className="drawer-eyebrow">{t('stock.ledger.eyebrow', { group: groupName, unit })}</small>
          <DrawerTitle className="sheet-title">{t('stock.ledger.title', { name: item.name })}</DrawerTitle>
        </div>
        <DrawerClose asChild>
          <button type="button" className="sheet-close" aria-label={t('common.close')}>
            <Icon name="x" />
          </button>
        </DrawerClose>
      </div>
      <div className="drawer-body">
        <div className="sk-balance">
          <b className="sk-balance__n num">{item.stock_qty}</b>
          <StockBadge state={item.stock_state} />
          <span className="sk-balance__owed">{t('stock.ledger.owed', { n: item.owed > 0 ? item.owed : t('common.empty') })}</span>
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
      </div>
      <div className="drawer-footer sk-drawer-foot">
        <button type="button" className="btn btn--sm" onClick={() => onAction('purchase')}>
          {t('stock.page.purchase')}
        </button>
        <button type="button" className="btn btn--sm" onClick={() => onAction('adjust')}>
          {t('stock.page.adjust')}
        </button>
        <IssueButton item={item} className="btn btn--sm" onClick={() => onAction('issue')} />
      </div>
    </Drawer>
  );
}
