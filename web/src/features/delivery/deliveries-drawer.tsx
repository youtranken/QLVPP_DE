import { useTranslation } from 'react-i18next';
import { formatVnStamp } from '@/lib/format-time';
import { OverlayPanel, type PanelNav } from '@/ui/overlay-panel';
import { LoadError } from '@/ui/load-state';
import { Skeleton } from '@/ui/skeleton';
import { useLineDeliveries, type BacklogLine } from './backlog.api';
import { useBacklogFormat } from './backlog-format';

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bl-stat">
      <span>{label}</span>
      <b className="num">{value}</b>
    </div>
  );
}

const ROWS = { shape: 'row', count: 3 } as const;

// Chỉ xem: GĐ1 không có hoàn tác đợt giao (FR-44)
export function DeliveriesDrawer({ line, onClose, nav }: { line: BacklogLine; onClose: () => void; nav?: Omit<PanelNav, 'prevLabel' | 'nextLabel'> }) {
  const { t } = useTranslation();
  const f = useBacklogFormat();
  const query = useLineDeliveries(line.line_id);
  const head = query.data?.line;
  const rounds = query.data?.items ?? [];
  const unit = f.unit(line.unit);

  return (
    <OverlayPanel
      open
      onClose={onClose}
      title={t('delivery.backlog.deliveries.title', { person: f.person(line) })}
      nav={nav && { ...nav, prevLabel: t('delivery.backlog.deliveries.prev'), nextLabel: t('delivery.backlog.deliveries.next') }}
    >
      <small className="drawer-eyebrow">{t('delivery.backlog.deliveries.eyebrow', { name: f.name(line), month: f.monthShort(line.period_ym) })}</small>
      {query.isPending && <Skeleton {...ROWS} />}
      {query.isError && <LoadError onRetry={() => void query.refetch()} />}
      {head && (
        <div className="bl-stats">
          <Stat label={t('delivery.backlog.deliveries.registered')} value={head.qty} />
          <Stat label={t('delivery.backlog.deliveries.delivered')} value={head.delivered_qty} />
          {head.cancelled_qty > 0 ? (
            <Stat label={t('delivery.backlog.deliveries.cancelledStat')} value={head.cancelled_qty} />
          ) : (
            <Stat label={t('delivery.backlog.deliveries.owed')} value={head.qty - head.delivered_qty} />
          )}
        </div>
      )}
      {query.isSuccess && rounds.length === 0 && <p className="empty">{t('delivery.backlog.deliveries.empty')}</p>}
      {rounds.length > 0 && (
        <ol className="bl-rounds" aria-label={t('delivery.backlog.deliveries.list')}>
          {rounds.map((r) => (
            <li key={r.id}>
              <b>{t('delivery.backlog.deliveries.round', { qty: r.qty, unit })}</b>
              <small>{t('delivery.backlog.deliveries.roundMeta', { time: formatVnStamp(r.created_at), actor: r.actor_name ?? r.actor_sub })}</small>
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
    </OverlayPanel>
  );
}
