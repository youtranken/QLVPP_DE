import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { Drawer, DrawerClose, DrawerDescription, DrawerTitle } from '@/ui/drawer';
import { LoadError, Loading } from '@/ui/load-state';
import { useLineDeliveries, type BacklogLine } from './backlog.api';
import { useBacklogFormat } from './backlog-format';

// Chỉ xem: GĐ1 không có hoàn tác đợt giao (FR-44)
export function DeliveriesDrawer({ line, onClose }: { line: BacklogLine; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const query = useLineDeliveries(line.line_id);
  const head = query.data?.line;
  const rounds = query.data?.items ?? [];

  return (
    <Drawer open onOpenChange={(o) => !o && onClose()} width={460}>
      <div className="sheet-header">
        <DrawerTitle className="sheet-title">{t('delivery.backlog.deliveries.title', { name: f.name(line) })}</DrawerTitle>
        <DrawerClose asChild>
          <button type="button" className="sheet-close" aria-label={t('common.close')}>
            ✕
          </button>
        </DrawerClose>
      </div>
      <div className="sheet-body">
        <DrawerDescription className="bl-meta">
          {t('delivery.backlog.deliveries.meta', { person: f.person(line), month: f.month(line.period_ym) })}
        </DrawerDescription>
        {query.isPending && <Loading />}
        {query.isError && <LoadError onRetry={() => void query.refetch()} />}
        {query.isSuccess && rounds.length === 0 && <p className="empty">{t('delivery.backlog.deliveries.empty')}</p>}
        {rounds.length > 0 && (
          <ol className="bl-rounds" aria-label={t('delivery.backlog.deliveries.list')}>
            {rounds.map((r) => (
              <li key={r.id}>
                {t('delivery.backlog.deliveries.round', { time: formatVnStamp(r.created_at), qty: r.qty, actor: r.actor_name ?? r.actor_sub })}
              </li>
            ))}
          </ol>
        )}
        {head && head.cancelled_qty > 0 && (
          <p className="bl-cancelled">
            {head.cancel_note
              ? t('delivery.backlog.deliveries.cancelled', { n: head.cancelled_qty, reason: head.cancel_note })
              : t('delivery.backlog.deliveries.cancelledNoReason', { n: head.cancelled_qty })}
          </p>
        )}
      </div>
    </Drawer>
  );
}
