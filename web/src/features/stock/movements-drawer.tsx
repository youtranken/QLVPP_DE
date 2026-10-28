import { useTranslation } from 'react-i18next';
import { Dialog, DialogClose, DialogTitle } from '@/ui/dialog';
import { LoadError, Loading } from '@/ui/load-state';
import { useFormatTime } from '@/lib/format-time';
import type { AdminItem } from '@/features/catalog/catalog.api';
import { useDirectoryNames, useMovements, type StockMovement } from '@/features/stock/stock.api';

const TAG_CLASS: Record<StockMovement['reason'], string> = {
  purchase: 'tag tag--ok',
  adjust: 'tag tag--warn',
  issue: 'tag tag--info',
  delivery: 'tag tag--brand',
  return: 'tag',
};

// Dấu trừ thật (U+2212) để số âm không bị đọc/nhìn như gạch nối
const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);

export function MovementsDrawer({ item, onClose }: { item: AdminItem; onClose: () => void }) {
  const { t } = useTranslation();
  const movements = useMovements(item.id);
  const names = useDirectoryNames();
  const formatTime = useFormatTime();
  const nameOf = (sub: string) => names.data?.get(sub) ?? sub;
  const rows = movements.data?.pages.flatMap((p) => p.items) ?? [];

  const tagText = (m: StockMovement) => {
    if (m.reason !== 'issue') return t(`stock.ledger.reasons.${m.reason}`);
    return m.recipient_sub
      ? t('stock.ledger.reasons.issue', { name: nameOf(m.recipient_sub) })
      : t('stock.ledger.reasons.issueShared');
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} className="sheet ledger-sheet">
      <div className="sheet-header">
        <DialogTitle className="sheet-title">{t('stock.ledger.title', { name: item.name })}</DialogTitle>
        <DialogClose asChild>
          <button type="button" className="sheet-close" aria-label={t('common.close')}>
            ✕
          </button>
        </DialogClose>
      </div>
      <div className="sheet-body">
        {movements.isPending && <Loading />}
        {movements.isError && <LoadError onRetry={() => void movements.refetch()} />}
        {movements.isSuccess && rows.length === 0 && <p className="empty">{t('stock.ledger.empty')}</p>}
        <ol className="ledger">
          {rows.map((m) => (
            <li key={m.id}>
              <div className="ledger-head">
                <span className={TAG_CLASS[m.reason]}>{tagText(m)}</span>
                <b className={`num ledger-delta ${m.delta > 0 ? 'is-in' : 'is-out'}`}>{signed(m.delta)}</b>
              </div>
              {m.note && <p className="ledger-note">{m.note}</p>}
              <small>{t('stock.ledger.meta', { time: formatTime(m.created_at), actor: nameOf(m.actor_sub) })}</small>
            </li>
          ))}
        </ol>
        {movements.hasNextPage && (
          <button
            type="button"
            className="btn"
            disabled={movements.isFetchingNextPage}
            onClick={() => void movements.fetchNextPage()}
          >
            {t('stock.ledger.more')}
          </button>
        )}
      </div>
    </Dialog>
  );
}
