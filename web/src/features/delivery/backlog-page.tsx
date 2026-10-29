import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { EmptyState, Loading, LoadError } from '@/ui/load-state';
import { BACKLOG_BY, parseBy, useBacklog, type BacklogBy, type BacklogLine } from './backlog.api';
import { BacklogGroup, type LineAction } from './backlog-group';
import { CancelDialog } from './cancel-dialog';
import { DeliverMoreDialog } from './deliver-more-dialog';
import { DeliveriesDrawer } from './deliveries-drawer';
import { useRefreshAfterDelivery } from './delivery.api';
import '@/features/admin/admin.css';
import './delivery.css';

const NOTICES = new Set(['STALE_UPDATE', 'PERIOD_NOT_LOCKED', 'LINE_NOT_REVIEWED', 'LINE_REJECTED', 'LINE_NOT_FOUND', 'REQUEST_NOT_FOUND', 'NOTHING_LEFT']);

const BY_LABEL: Record<BacklogBy, string> = { item: 'delivery.backlog.byItem', person: 'delivery.backlog.byPerson' };

function BySwitch({ by, onChange }: { by: BacklogBy; onChange: (by: BacklogBy) => void }) {
  const { t } = useTranslation();
  return (
    <div className="bl-switch" role="group" aria-label={t('delivery.backlog.by')}>
      {BACKLOG_BY.map((b) => (
        <button key={b} type="button" className="btn bl-by" aria-pressed={by === b} onClick={() => onChange(b)}>
          {t(BY_LABEL[b])}
        </button>
      ))}
    </div>
  );
}

export function BacklogPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const by = parseBy(params.get('by'));
  const query = useBacklog(by);
  const refresh = useRefreshAfterDelivery();
  const [open, setOpen] = useState<{ action: LineAction; line: BacklogLine } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const close = () => setOpen(null);
  const done = async () => {
    if (open) await refresh(open.line.request_id);
    close();
  };
  // Lỗi trạng thái (vừa giao/hủy ở nơi khác, kỳ chưa khóa…): bản đang xem đã cũ → tải lại cả danh sách
  const onNotice = (code: string) => {
    setNotice(code);
    reloadOpen();
    close();
  };
  const reloadOpen = () => {
    if (open) void refresh(open.line.request_id);
  };
  const act = (action: LineAction, line: BacklogLine) => {
    setNotice(null);
    setOpen({ action, line });
  };
  const groups = query.data?.groups ?? [];

  return (
    <div className="a-stack">
      <div className="a-toolbar">
        <BySwitch by={by} onChange={(b) => setParams({ by: b })} />
      </div>
      {notice && (
        <p role="alert" className="alert alert--warn">
          {t(`delivery.backlog.notice.${NOTICES.has(notice) ? notice : 'UNKNOWN'}`)}
        </p>
      )}
      {query.isError && <LoadError onRetry={() => void query.refetch()} />}
      {query.isPending && <Loading />}
      {query.isSuccess && groups.length === 0 && (
        <section className="a-panel">
          <EmptyState title={t('delivery.backlog.empty')} hint={t('delivery.backlog.emptyHint')} />
        </section>
      )}
      {groups.map((g) => (
        <BacklogGroup key={g.key} group={g} by={by} onAction={act} />
      ))}
      {open?.action === 'deliver' && <DeliverMoreDialog line={open.line} onDone={done} onNotice={onNotice} onStale={reloadOpen} onClose={close} />}
      {open?.action === 'cancel' && <CancelDialog line={open.line} onDone={done} onNotice={onNotice} onClose={close} />}
      {open?.action === 'history' && <DeliveriesDrawer line={open.line} onClose={close} />}
    </div>
  );
}
